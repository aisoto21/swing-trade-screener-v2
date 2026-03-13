/**
 * Contract recommendation engine — selects optimal options structure
 */

import type {
  SetupResult,
  TradeParameters,
  ContractRecommendation,
  OptionsChain,
  OptionsContract,
  IVAnalysis,
  OptionsGreeks,
} from "@/types";
import type { HoldDuration } from "@/types";
import { getOptionsChain } from "@/lib/utils/optionsData";
import { computeIVAnalysis } from "./ivAnalysis";
import { computeExpectedMove, assessTargetVsExpectedMove } from "./expectedMove";
import { computeSkew, getSkewInterpretation } from "./skewAnalysis";
import { detectUnusualActivity } from "./unusualActivity";
import {
  getDelta,
  getTheta,
  getVega,
  getGamma,
  computeThetaCliff,
  computeProbabilityOfProfit,
} from "./greeks";
import { recordIV } from "@/lib/utils/ivHistory";
import { getOptionsDataSource } from "@/lib/utils/optionsData";

const DTE_MAP: Record<HoldDuration, { min: number; max: number }> = {
  Scalp: { min: 14, max: 21 },
  "Short Swing": { min: 30, max: 45 },
  Swing: { min: 45, max: 60 },
  "Extended Swing": { min: 60, max: 90 },
};

interface SelectorInput {
  ticker: string;
  setup: SetupResult & { tradeParams: TradeParameters };
  accountSize: number;
  riskPerTrade: number;
  minIVP: number;
  minOI: number;
  allowNaked: boolean;
  allowSpreads: boolean;
  allowPMCC: boolean;
  earningsDaysAway?: number;
}

export async function selectContract(input: SelectorInput): Promise<ContractRecommendation | null> {
  const chain = await getOptionsChain(input.ticker);
  if (!chain || chain.calls.length === 0) return null;

  const price = chain.underlyingPrice;
  const atmCall = chain.calls.reduce((a, b) =>
    Math.abs(a.strike - price) < Math.abs(b.strike - price) ? a : b
  );
  const currentIV = atmCall.impliedVolatility ?? 0.3;

  const ivAnalysis = await computeIVAnalysis(input.ticker, currentIV);
  await recordIV(input.ticker, currentIV, new Date().toISOString().slice(0, 10));

  if (ivAnalysis.ivPercentile >= input.minIVP) return null;

  const uoa = detectUnusualActivity(chain);
  const skew = computeSkew(chain);
  const skewInterp = getSkewInterpretation(skew, input.setup.bias);

  const holdDuration = input.setup.tradeParams.holdDuration;
  const dteRange = DTE_MAP[holdDuration] ?? { min: 45, max: 60 };
  const targetDTE = Math.floor((dteRange.min + dteRange.max) / 2);

  const expirations = chain.expirations
    .map((d) => ({ date: d, dte: Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) }))
    .filter((e) => e.dte >= dteRange.min && e.dte <= dteRange.max * 2);

  if (expirations.length === 0) return null;

  const expiration = expirations[0]?.date ?? chain.expirations[0];
  const dte = expirations[0]?.dte ?? targetDTE;

  const expectedMove = computeExpectedMove(price, currentIV, dte);
  const t1 = input.setup.tradeParams.targets.t1.price;
  const entryMid = (input.setup.tradeParams.entry.zone[0] + input.setup.tradeParams.entry.zone[1]) / 2;
  const targetVsExpected = assessTargetVsExpectedMove(t1, entryMid, expectedMove.pct);

  if (targetVsExpected === "unfavorable") {
    // Soft filter - still recommend but add warning
  }

  const earningsWarning = (input.earningsDaysAway ?? 999) <= dte;
  const earningsDays = input.earningsDaysAway;

  const contracts = input.setup.bias === "LONG" ? chain.calls : chain.puts;
  const filtered = contracts.filter(
    (c) =>
      c.expiration === expiration &&
      c.openInterest >= input.minOI &&
      ((c.bid + c.ask) / 2) > 0
  );

  if (filtered.length === 0) return null;

  const midPrice = (atmCall.bid + atmCall.ask) / 2 || atmCall.last;
  const spreadPct = atmCall.ask > 0 ? ((atmCall.ask - atmCall.bid) / midPrice) * 100 : 0;
  if (spreadPct >= 10) return null;

  const riskBudget = input.accountSize * input.riskPerTrade;
  const maxContracts = Math.min(10, Math.floor(riskBudget / (midPrice * 100)));
  if (maxContracts < 1) return null;

  const strike = atmCall.strike;
  const contractType = input.setup.bias === "LONG" ? "call" : "put";

  const delta = getDelta(strike, price, dte, currentIV, contractType);
  const theta = getTheta(strike, price, dte, currentIV, contractType);
  const vega = getVega(strike, price, dte, currentIV, contractType);
  const gamma = getGamma(strike, price, dte, currentIV, contractType);
  const pop = computeProbabilityOfProfit(delta, contractType);
  const thetaCliff = computeThetaCliff(expiration);

  const greeks: OptionsGreeks = {
    delta,
    theta: theta * 100,
    vega,
    gamma,
    probabilityOfProfit: pop,
    thetaCliffWarning: thetaCliff,
  };

  let structure: ContractRecommendation["structure"] = "none";
  const rationale: string[] = [];
  const warnings: string[] = [];

  if (ivAnalysis.ivPercentile < 30 && input.allowNaked) {
    structure = input.setup.bias === "LONG" ? "long_call" : "long_put";
    rationale.push(`IVP ${ivAnalysis.ivPercentile.toFixed(0)} — cheap IV favors buying premium outright`);
  } else if (ivAnalysis.ivPercentile < 50 && input.allowNaked) {
    structure = input.setup.bias === "LONG" ? "long_call" : "long_put";
    if (skew > 4 && input.allowSpreads) {
      structure = input.setup.bias === "LONG" ? "bull_call_spread" : "bear_put_spread";
      rationale.push("Steep skew (>4 pts) — debit spread reduces vega exposure");
    }
    rationale.push(`IVP ${ivAnalysis.ivPercentile.toFixed(0)} — moderate IV, ATM strike`);
  } else if (ivAnalysis.ivPercentile < 70 && input.allowSpreads) {
    structure = input.setup.bias === "LONG" ? "bull_call_spread" : "bear_put_spread";
    rationale.push(`IVP ${ivAnalysis.ivPercentile.toFixed(0)} — elevated IV, defined risk recommended`);
  } else if (ivAnalysis.ivPercentile >= 70) {
    if (input.allowSpreads) {
      structure = input.setup.bias === "LONG" ? "bull_call_spread" : "bear_put_spread";
      rationale.push("IV elevated — spread recommended to reduce vega exposure");
      warnings.push("IV elevated (IVP " + ivAnalysis.ivPercentile.toFixed(0) + ") — consider waiting for IV contraction");
    } else {
      structure = input.setup.bias === "LONG" ? "bull_call_spread" : "bear_put_spread";
      rationale.push("IV elevated — spread recommended");
    }
  }

  if (input.setup.grade === "A+" && ivAnalysis.ivPercentile < 40 && input.allowPMCC) {
    rationale.push("A+ setup with cheap IV — PMCC alternative available");
  }

  const breakeven = input.setup.bias === "LONG" ? strike + midPrice : strike - midPrice;
  const moveToBE = ((breakeven - price) / price) * 100;

  const source = getOptionsDataSource();
  const upgradeNote = source === "yahoo"
    ? "Greeks computed via Black-Scholes. Upgrade to Tradier for live chain data."
    : undefined;

  const finalStructure = structure === "none" ? (input.setup.bias === "LONG" ? "long_call" : "long_put") : structure;

  const shortStrikeVal = finalStructure.includes("spread")
    ? (input.setup.bias === "LONG"
        ? filtered.find((c) => c.strike > strike)?.strike ?? strike + 5
        : filtered.find((c) => c.strike < strike)?.strike ?? strike - 5)
    : undefined;

  return {
    structure: finalStructure,
    ticker: input.ticker,
    expiration,
    longStrike: strike,
    shortStrike: shortStrikeVal,
    contractType,
    dte,
    midPrice,
    maxRisk: midPrice * 100 * maxContracts,
    breakevenAtExpiration: breakeven,
    contracts: maxContracts,
    totalPremium: midPrice * 100 * maxContracts,
    greeks,
    ivAnalysis,
    expectedMove,
    targetVsExpectedMove: targetVsExpected,
    skewInterpretation: skewInterp,
    spreadQuality: spreadPct < 5 ? "tight" : spreadPct < 10 ? "acceptable" : "wide",
    earningsWarning,
    earningsDaysAway: earningsDays,
    unusualActivity: uoa.unusualActivity,
    unusualActivityDetail: uoa.detail,
    rationale,
    warnings: [
      ...warnings,
      ...(spreadPct >= 5 ? [`Bid/ask spread ${spreadPct.toFixed(1)}% — verify fill before entry`] : []),
      ...(thetaCliff ? [`Theta cliff in ${dte} days — close or roll before expiration`] : []),
    ],
    upgradeNote,
  };
}
