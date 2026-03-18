import type {
  OHLCVBar,
  SetupResult,
  TradeParameters,
  Bias,
  SetupGrade,
  HoldDuration,
  AnalystRating,
} from "@/types";
import type { RSIData } from "@/types";
import type { MACDData } from "@/types";
import type { BollingerBandsData } from "@/types";
import type { VWAPData } from "@/types";
import type { VolumeAnalysis } from "@/types";
import type { SupportResistanceLevel } from "@/types";
import type { FibonacciLevels } from "@/types";
import type { CandlestickPattern } from "@/types";
import type { GapAnalysis, SectorRSResult } from "@/types";
import type { MarketBreadth } from "@/lib/utils/marketBreadth";
import { SMA_50_PERIOD, SMA_200_PERIOD } from "@/constants/indicators";
import { sma50, sma200 } from "@/lib/indicators/sma";
import { ema9 } from "@/lib/indicators/ema";
import { momentumScore } from "./momentumScore";
import { trendScore } from "./trendScore";
import { volumeScore } from "./volumeScore";
import { compositeScore, scoreToAnalystRating } from "./compositeScore";
import { computePositionSizing, computeKellyPositionSize } from "@/lib/utils/positionSizing";
import { computeRiskReward } from "@/lib/utils/riskReward";
import { checkEconomicRisk } from "@/lib/utils/economicCalendar";
import { computeMTFScore } from "./multiTimeframeScore";

interface IndicatorContext {
  daily: OHLCVBar[];
  fourHour: OHLCVBar[];
  fifteenMin: OHLCVBar[];
  rsiDaily: RSIData;
  rsi4H: RSIData;
  rsi15M: RSIData;
  macdDaily: MACDData;
  macd4H: MACDData;
  bbDaily: BollingerBandsData;
  bb4H: BollingerBandsData;
  vwap4H: VWAPData;
  vwap15M: VWAPData;
  volumeDaily: VolumeAnalysis;
  volume4H: VolumeAnalysis;
  srDaily: SupportResistanceLevel[];
  fibDaily: FibonacciLevels;
  patternsDaily: CandlestickPattern[];
  patterns4H: CandlestickPattern[];
  sma50Daily: number[];
  sma200Daily: number[];
  ema9Daily: number[];
  ema9_4H: number[];
  ema9_15M: number[];
  sma50_4H: number[];
  accountSize: number;
  riskPerTrade: number;
  sizingMethod?: "fixed_risk" | "half_kelly" | "full_kelly";
  kellyParams?: { closedTrades: number; winRate: number; avgWinPercent: number; avgLossPercent: number };
  gapAnalysis?: GapAnalysis;
  sectorRS?: SectorRSResult;
  breadth?: MarketBreadth | null;
}

export function classifySetups(ctx: IndicatorContext): Array<SetupResult & { tradeParams: TradeParameters }> {
  const setups: Array<SetupResult & { tradeParams: TradeParameters }> = [];
  const price = ctx.daily[ctx.daily.length - 1]?.close ?? 0;

  const s50 = ctx.sma50Daily[ctx.sma50Daily.length - 1];
  const s200 = ctx.sma200Daily[ctx.sma200Daily.length - 1];
  const e9 = ctx.ema9Daily[ctx.ema9Daily.length - 1];
  const e9_4H = ctx.ema9_4H[ctx.ema9_4H.length - 1];
  const s50_4H = ctx.sma50_4H[ctx.sma50_4H.length - 1];
  const s50Prev = ctx.sma50Daily[ctx.sma50Daily.length - 2];
  const s200Prev = ctx.sma200Daily[ctx.sma200Daily.length - 2];

  const nearestSupport = ctx.srDaily.find((s) => s.type === "support")?.price ?? price * 0.95;
  const nearestResistance = ctx.srDaily.find((s) => s.type === "resistance")?.price ?? price * 1.05;

  const support = ctx.srDaily.filter((s) => s.type === "support").sort((a, b) => b.price - a.price)[0];
  const resistance = ctx.srDaily.filter((s) => s.type === "resistance").sort((a, b) => a.price - b.price)[0];

  const stopBelowSupport = support ? support.price * 0.995 : price * 0.97;
  const stopAboveResistance = resistance ? resistance.price * 1.005 : price * 1.03;

  const lastDaily = ctx.daily[ctx.daily.length - 1];
  const last4H = ctx.fourHour[ctx.fourHour.length - 1];
  const last15M = ctx.fifteenMin[ctx.fifteenMin.length - 1];
  const rsiLast = ctx.rsiDaily.values[ctx.rsiDaily.values.length - 1];
  const macdHistLast = ctx.macdDaily.histogram[ctx.macdDaily.histogram.length - 1];
  const vwapLast = ctx.vwap15M.values[ctx.vwap15M.values.length - 1] ?? 0;
  const lastCandleBullish15M =
    last15M && last15M.close > last15M.open;

  for (const bias of ["LONG", "SHORT"] as Bias[]) {
    const mtf = computeMTFScore(
      bias,
      {
        price,
        sma50: s50 ?? 0,
        rsi: rsiLast ?? 50,
        macdHist: macdHistLast ?? 0,
      },
      {
        price,
        ema9: e9_4H ?? 0,
        volumeRatio: ctx.volume4H.currentVsAvg,
      },
      {
        price,
        vwap: vwapLast,
        lastCandleBullish: lastCandleBullish15M,
      }
    );

    if (mtf.alignedCount === 0) continue;

    const sectorMod = ctx.sectorRS
      ? ctx.sectorRS.sectorRank <= 2
        ? 1
        : ctx.sectorRS.sectorRank >= 10
        ? -1
        : 0
      : 0;
    const applyGradeMod = (g: SetupGrade, mod: 1 | 0 | -1): SetupGrade => {
      const order: Record<SetupGrade, number> = { "A+": 4, A: 3, B: 2, C: 1 };
      const grades: SetupGrade[] = ["C", "B", "A", "A+"];
      const totalMod = mod + sectorMod;
      const newOrder = Math.max(1, Math.min(4, order[g] + totalMod));
      return grades[newOrder - 1];
    };

    const mom = momentumScore(
      bias === "LONG" ? ctx.rsiDaily : ctx.rsiDaily,
      bias === "LONG" ? ctx.macdDaily : ctx.macdDaily,
      bias
    );
    const trend = trendScore(
      ctx.daily,
      ctx.sma50Daily,
      ctx.sma200Daily,
      ctx.ema9Daily,
      bias
    );
    const vol = volumeScore(bias === "LONG" ? ctx.volumeDaily : ctx.volumeDaily, bias);
    const composite = compositeScore(mom, trend, vol, ctx.breadth, bias);
    const analystRating = scoreToAnalystRating(composite, bias);

    const confirmingFactors: string[] = [];
    const riskFactors: string[] = [];

    if (ctx.rsiDaily.oversold) confirmingFactors.push("RSI oversold");
    if (ctx.rsiDaily.overbought) confirmingFactors.push("RSI overbought");
    if (ctx.rsiDaily.divergence === "bullish") confirmingFactors.push("Regular bullish RSI divergence");
    if (ctx.rsiDaily.divergence === "hidden_bullish") confirmingFactors.push("Hidden bullish divergence (trend continuation)");
    if (ctx.rsiDaily.divergence === "bearish") confirmingFactors.push("Regular bearish RSI divergence");
    if (ctx.rsiDaily.divergence === "hidden_bearish") confirmingFactors.push("Hidden bearish divergence (trend continuation)");
    if (ctx.sectorRS?.isLeadingSector) confirmingFactors.push(`Sector (${ctx.sectorRS.sectorETF}) is #${ctx.sectorRS.sectorRank} ranked`);
    if (ctx.sectorRS?.isWeakSector) riskFactors.push(`Sector (${ctx.sectorRS.sectorETF}) is #${ctx.sectorRS.sectorRank} ranked — weak`);
    confirmingFactors.push(mtf.description);
    if (ctx.volumeDaily.currentVsAvg >= 1.5) {
      confirmingFactors.push(`Volume ${ctx.volumeDaily.currentVsAvg.toFixed(1)}x avg`);
    }
    if (ctx.fibDaily.within1Percent && ctx.fibDaily.nearestLevel) {
      confirmingFactors.push(`At ${ctx.fibDaily.nearestLevel.level} Fib`);
    }
    for (const p of ctx.patternsDaily) {
      if (p.type === (bias === "LONG" ? "bullish" : "bearish")) {
        confirmingFactors.push(`${p.name} on Daily`);
      }
    }

    if (!isNaN(s200) && price < s200 && bias === "LONG") riskFactors.push("Below 200 SMA");
    if (!isNaN(s200) && price > s200 && bias === "SHORT") riskFactors.push("Above 200 SMA");

    if (bias === "LONG") {
      if (!isNaN(s50) && !isNaN(s200Prev) && !isNaN(s50Prev) && s50 > s200 && s50Prev <= s200Prev) {
        const tp = computeTradeParams(
          ctx,
          bias,
          "Golden Cross",
          "Daily",
          applyGradeMod("A+", mtf.gradeModifier),
          [...confirmingFactors, "50 SMA crossed above 200 SMA"],
          riskFactors,
          price,
          [nearestSupport, price],
          stopBelowSupport,
          [resistance?.price ?? price * 1.05, price * 1.1, price * 1.15],
          "Extended Swing"
        );
        if (tp) setups.push(tp);
      }

      if (!isNaN(e9_4H) && Math.abs(price - e9_4H) / price < 0.02 && ctx.volume4H.currentVsAvg > 1) {
        const tp = computeTradeParams(
          ctx,
          bias,
          "9 EMA Bounce",
          "4H",
          applyGradeMod("A", mtf.gradeModifier),
          [...confirmingFactors, "Price at 9 EMA on 4H"],
          riskFactors,
          price,
          [e9_4H * 0.998, e9_4H * 1.002],
          stopBelowSupport,
          [resistance?.price ?? price * 1.05, price * 1.1, price * 1.15],
          "Short Swing"
        );
        if (tp) setups.push(tp);
      }

      if (ctx.vwap4H.priceAbove && ctx.volume4H.currentVsAvg >= 1.5) {
        const tp = computeTradeParams(
          ctx,
          bias,
          "VWAP Reclaim",
          "4H",
          applyGradeMod("A", mtf.gradeModifier),
          [...confirmingFactors, "Price above VWAP with volume"],
          riskFactors,
          price,
          [price * 0.998, price * 1.002],
          stopBelowSupport,
          [resistance?.price ?? price * 1.05, price * 1.1, price * 1.15],
          "Short Swing"
        );
        if (tp) setups.push(tp);
      }

      if (ctx.bbDaily.squeeze && ctx.bbDaily.touchingUpper && ctx.volumeDaily.currentVsAvg >= 1.5) {
        const tp = computeTradeParams(
          ctx,
          bias,
          "Bollinger Band Squeeze Breakout",
          "Daily",
          applyGradeMod("A", mtf.gradeModifier),
          [...confirmingFactors, "BB squeeze breakout with volume"],
          riskFactors,
          price,
          [price * 0.998, price * 1.002],
          stopBelowSupport,
          [ctx.bbDaily.upper[ctx.bbDaily.upper.length - 1] ?? price * 1.05, price * 1.1, price * 1.15],
          "Swing"
        );
        if (tp) setups.push(tp);
      }

      if (
        !isNaN(e9) &&
        !isNaN(s50) &&
        !isNaN(s200) &&
        price > e9 &&
        e9 > s50 &&
        s50 > s200 &&
        price <= s50 * 1.02
      ) {
        const tp = computeTradeParams(
          ctx,
          bias,
          "MA Stack Pullback",
          "Daily",
          applyGradeMod("A", mtf.gradeModifier),
          [...confirmingFactors, "Pullback to 50 SMA in uptrend"],
          riskFactors,
          price,
          [s50 * 0.998, s50 * 1.002],
          stopBelowSupport,
          [resistance?.price ?? price * 1.05, price * 1.1, price * 1.15],
          "Swing"
        );
        if (tp) setups.push(tp);
      }

      if (
        ctx.macdDaily.crossover === "bullish" &&
        ctx.rsiDaily.values[ctx.rsiDaily.values.length - 1] < 60 &&
        !isNaN(ctx.macdDaily.macdLine[ctx.macdDaily.macdLine.length - 1]) &&
        ctx.macdDaily.macdLine[ctx.macdDaily.macdLine.length - 1] < 0
      ) {
        const tp = computeTradeParams(
          ctx,
          bias,
          "MACD Bullish Cross + RSI < 60",
          "4H",
          applyGradeMod("B", mtf.gradeModifier),
          [...confirmingFactors, "MACD crossover below zero"],
          riskFactors,
          price,
          [price * 0.998, price * 1.002],
          stopBelowSupport,
          [resistance?.price ?? price * 1.05, price * 1.1, price * 1.15],
          "Short Swing"
        );
        if (tp) setups.push(tp);
      }

      if (
        ctx.fibDaily.within1Percent &&
        ctx.fibDaily.nearestLevel &&
        ["38.2%", "50%", "61.8%"].includes(ctx.fibDaily.nearestLevel.level) &&
        ctx.patternsDaily.some((p) => p.type === "bullish")
      ) {
        const tp = computeTradeParams(
          ctx,
          bias,
          "Fibonacci Confluence Buy",
          "Daily",
          "A",
          [...confirmingFactors, "At key Fib + bullish candle"],
          riskFactors,
          price,
          [price * 0.998, price * 1.002],
          stopBelowSupport,
          [resistance?.price ?? price * 1.05, price * 1.1, price * 1.15],
          "Swing"
        );
        if (tp) setups.push(tp);
      }

      if (
        ctx.rsiDaily.oversold &&
        ctx.rsiDaily.divergence === "bullish" &&
        ctx.volumeDaily.currentVsAvg >= 1.5
      ) {
        const tp = computeTradeParams(
          ctx,
          bias,
          "Oversold RSI Reversal",
          "Daily",
          applyGradeMod("B", mtf.gradeModifier),
          [...confirmingFactors, "RSI oversold + divergence + volume"],
          riskFactors,
          price,
          [price * 0.998, price * 1.002],
          stopBelowSupport,
          [resistance?.price ?? price * 1.05, price * 1.1, price * 1.15],
          "Swing"
        );
        if (tp) setups.push(tp);
      }

      if (
        ctx.gapAnalysis?.setup &&
        ctx.gapAnalysis.bias === "LONG" &&
        ctx.volumeDaily.currentVsAvg >= 1
      ) {
        const gapDesc =
          ctx.gapAnalysis.gap?.type === "up"
            ? `Gap up ${(ctx.gapAnalysis.gap.sizePct * 100).toFixed(1)}%`
            : `Gap down ${(ctx.gapAnalysis.gap!.sizePct * 100).toFixed(1)}%`;
        const tp = computeTradeParams(
          ctx,
          bias,
          ctx.gapAnalysis.setup,
          "Daily",
          applyGradeMod("A", mtf.gradeModifier),
          [...confirmingFactors, gapDesc],
          riskFactors,
          price,
          [price * 0.998, price * 1.002],
          stopBelowSupport,
          [resistance?.price ?? price * 1.05, price * 1.1, price * 1.15],
          "Short Swing"
        );
        if (tp) setups.push(tp);
      }
    } else {
      if (!isNaN(s50) && !isNaN(s200Prev) && !isNaN(s50Prev) && s50 < s200 && s50Prev >= s200Prev) {
        const tp = computeTradeParams(
          ctx,
          bias,
          "Death Cross",
          "Daily",
          applyGradeMod("A+", mtf.gradeModifier),
          [...confirmingFactors, "50 SMA crossed below 200 SMA"],
          riskFactors,
          price,
          [price, nearestResistance],
          stopAboveResistance,
          [support?.price ?? price * 0.95, price * 0.9, price * 0.85],
          "Extended Swing"
        );
        if (tp) setups.push(tp);
      }

      if (!isNaN(e9_4H) && Math.abs(price - e9_4H) / price < 0.02 && ctx.volume4H.currentVsAvg > 1) {
        const tp = computeTradeParams(
          ctx,
          bias,
          "9 EMA Rejection",
          "4H",
          applyGradeMod("A", mtf.gradeModifier),
          [...confirmingFactors, "Price rejected at 9 EMA on 4H"],
          riskFactors,
          price,
          [e9_4H * 0.998, e9_4H * 1.002],
          stopAboveResistance,
          [support?.price ?? price * 0.95, price * 0.9, price * 0.85],
          "Short Swing"
        );
        if (tp) setups.push(tp);
      }

      if (!ctx.vwap4H.priceAbove && ctx.volume4H.currentVsAvg >= 1.5) {
        const tp = computeTradeParams(
          ctx,
          bias,
          "VWAP Rejection",
          "4H",
          applyGradeMod("A", mtf.gradeModifier),
          [...confirmingFactors, "Price rejected at VWAP"],
          riskFactors,
          price,
          [price * 0.998, price * 1.002],
          stopAboveResistance,
          [support?.price ?? price * 0.95, price * 0.9, price * 0.85],
          "Short Swing"
        );
        if (tp) setups.push(tp);
      }

      if (ctx.bbDaily.squeeze && ctx.bbDaily.touchingLower && ctx.volumeDaily.currentVsAvg >= 1.5) {
        const tp = computeTradeParams(
          ctx,
          bias,
          "Bollinger Band Squeeze Breakdown",
          "Daily",
          applyGradeMod("A", mtf.gradeModifier),
          [...confirmingFactors, "BB squeeze breakdown with volume"],
          riskFactors,
          price,
          [price * 0.998, price * 1.002],
          stopAboveResistance,
          [ctx.bbDaily.lower[ctx.bbDaily.lower.length - 1] ?? price * 0.95, price * 0.9, price * 0.85],
          "Swing"
        );
        if (tp) setups.push(tp);
      }

      if (
        !isNaN(e9) &&
        !isNaN(s50) &&
        !isNaN(s200) &&
        price < e9 &&
        e9 < s50 &&
        s50 < s200 &&
        price >= s50 * 0.98
      ) {
        const tp = computeTradeParams(
          ctx,
          bias,
          "MA Stack Short",
          "Daily",
          applyGradeMod("A", mtf.gradeModifier),
          [...confirmingFactors, "Bounce to 50 SMA in downtrend"],
          riskFactors,
          price,
          [s50 * 0.998, s50 * 1.002],
          stopAboveResistance,
          [support?.price ?? price * 0.95, price * 0.9, price * 0.85],
          "Swing"
        );
        if (tp) setups.push(tp);
      }

      if (
        ctx.macdDaily.crossover === "bearish" &&
        ctx.rsiDaily.values[ctx.rsiDaily.values.length - 1] > 40 &&
        !isNaN(ctx.macdDaily.macdLine[ctx.macdDaily.macdLine.length - 1]) &&
        ctx.macdDaily.macdLine[ctx.macdDaily.macdLine.length - 1] > 0
      ) {
        const tp = computeTradeParams(
          ctx,
          bias,
          "MACD Bearish Cross + RSI > 40",
          "4H",
          applyGradeMod("B", mtf.gradeModifier),
          [...confirmingFactors, "MACD crossover above zero"],
          riskFactors,
          price,
          [price * 0.998, price * 1.002],
          stopAboveResistance,
          [support?.price ?? price * 0.95, price * 0.9, price * 0.85],
          "Short Swing"
        );
        if (tp) setups.push(tp);
      }

      if (
        ctx.fibDaily.within1Percent &&
        ctx.fibDaily.nearestLevel &&
        ["50%", "61.8%"].includes(ctx.fibDaily.nearestLevel.level) &&
        ctx.patternsDaily.some((p) => p.type === "bearish")
      ) {
        const tp = computeTradeParams(
          ctx,
          bias,
          "Fibonacci Confluence Short",
          "Daily",
          applyGradeMod("A", mtf.gradeModifier),
          [...confirmingFactors, "At key Fib + bearish candle"],
          riskFactors,
          price,
          [price * 0.998, price * 1.002],
          stopAboveResistance,
          [support?.price ?? price * 0.95, price * 0.9, price * 0.85],
          "Swing"
        );
        if (tp) setups.push(tp);
      }

      if (
        ctx.rsiDaily.overbought &&
        ctx.rsiDaily.divergence === "bearish" &&
        ctx.volumeDaily.currentVsAvg >= 1.5
      ) {
        const tp = computeTradeParams(
          ctx,
          bias,
          "Overbought RSI Reversal",
          "Daily",
          applyGradeMod("B", mtf.gradeModifier),
          [...confirmingFactors, "RSI overbought + divergence + volume"],
          riskFactors,
          price,
          [price * 0.998, price * 1.002],
          stopAboveResistance,
          [support?.price ?? price * 0.95, price * 0.9, price * 0.85],
          "Swing"
        );
        if (tp) setups.push(tp);
      }

      if (
        ctx.gapAnalysis?.setup &&
        ctx.gapAnalysis.bias === "SHORT" &&
        ctx.volumeDaily.currentVsAvg >= 1
      ) {
        const gapDesc =
          ctx.gapAnalysis.gap?.type === "up"
            ? `Gap up ${(ctx.gapAnalysis.gap.sizePct * 100).toFixed(1)}%`
            : `Gap down ${(ctx.gapAnalysis.gap!.sizePct * 100).toFixed(1)}%`;
        const tp = computeTradeParams(
          ctx,
          bias,
          ctx.gapAnalysis.setup,
          "Daily",
          applyGradeMod("A", mtf.gradeModifier),
          [...confirmingFactors, gapDesc],
          riskFactors,
          price,
          [price * 0.998, price * 1.002],
          stopAboveResistance,
          [support?.price ?? price * 0.95, price * 0.9, price * 0.85],
          "Short Swing"
        );
        if (tp) setups.push(tp);
      }
    }
  }

  return setups;
}

function computeTradeParams(
  ctx: IndicatorContext,
  bias: Bias,
  name: string,
  timeframe: "Daily" | "4H" | "15M",
  grade: SetupGrade,
  confirming: string[],
  risk: string[],
  price: number,
  entryZone: [number, number],
  stopPrice: number,
  targets: [number, number, number],
  holdDuration: HoldDuration
): (SetupResult & { tradeParams: TradeParameters }) | null {
  const entryMid = (entryZone[0] + entryZone[1]) / 2;
  const riskAmount = Math.abs(entryMid - stopPrice);
  const rr = computeRiskReward(entryMid, stopPrice, targets[0], bias);

  if (rr < 1.5) return null;

  const useKelly =
    (ctx.sizingMethod === "half_kelly" || ctx.sizingMethod === "full_kelly") &&
    ctx.kellyParams &&
    ctx.kellyParams.closedTrades >= 20;

  const pos = useKelly
    ? computeKellyPositionSize(
        ctx.accountSize,
        ctx.kellyParams!.winRate,
        ctx.kellyParams!.avgWinPercent,
        ctx.kellyParams!.avgLossPercent,
        entryMid,
        stopPrice,
        ctx.sizingMethod!
      )
    : computePositionSizing(
        ctx.accountSize,
        ctx.riskPerTrade,
        entryMid,
        stopPrice,
        bias
      );

  const t1Gain = ((targets[0] - entryMid) / entryMid) * 100;
  const t2Gain = ((targets[1] - entryMid) / entryMid) * 100;
  const t3Gain = ((targets[2] - entryMid) / entryMid) * 100;

  const economicRisk = checkEconomicRisk(holdDuration);
  const economicRiskFactor =
    economicRisk.hasNearTermEvent &&
    economicRisk.riskLevel !== "NONE" &&
    economicRisk.nextEvent &&
    economicRisk.daysUntilEvent != null
      ? `${economicRisk.nextEvent.name} in ${economicRisk.daysUntilEvent} days — volatility risk`
      : null;

  const tradeParams: TradeParameters = {
    entry: {
      zone: entryZone,
      trigger: `15M candle close ${bias === "LONG" ? "above" : "below"} $${entryZone[1].toFixed(2)} with volume > ${(ctx.volume4H.avgVolume20 * 0.5).toLocaleString()}`,
      type: "Limit",
    },
    targets: {
      t1: { price: targets[0], percentGain: bias === "LONG" ? t1Gain : -t1Gain, partialPercent: 50 },
      t2: { price: targets[1], percentGain: bias === "LONG" ? t2Gain : -t2Gain, partialPercent: 30 },
      t3: { price: targets[2], percentGain: bias === "LONG" ? t3Gain : -t3Gain, partialPercent: 20 },
    },
    stop: {
      price: stopPrice,
      type: "Hard Stop",
      riskPercent: (riskAmount / entryMid) * 100,
    },
    riskReward: {
      toT1: rr,
      toT2: computeRiskReward(entryMid, stopPrice, targets[1], bias),
      toT3: computeRiskReward(entryMid, stopPrice, targets[2], bias),
    },
    positionSizing: pos,
    holdDuration,
    analystRating: scoreToAnalystRating(
      compositeScore(
        momentumScore(ctx.rsiDaily, ctx.macdDaily, bias),
        trendScore(ctx.daily, ctx.sma50Daily, ctx.sma200Daily, ctx.ema9Daily, bias),
        volumeScore(ctx.volumeDaily, bias),
        ctx.breadth,
        bias
      ),
      bias
    ),
    economicRisk: economicRisk.hasNearTermEvent ? economicRisk : undefined,
  };

  const finalRisk = economicRiskFactor ? [...risk, economicRiskFactor] : risk;

  return {
    name,
    bias,
    timeframe,
    grade,
    confirmingFactors: confirming,
    riskFactors: finalRisk,
    tradeParams,
  };
}
