import type {
  OHLCVBar,
  SetupResult,
  TradeParameters,
  Bias,
  SetupGrade,
  HoldDuration,
} from "@/types";
import type { RSIData } from "@/types";
import type { MACDData } from "@/types";
import type { BollingerBandsData } from "@/types";
import type { VWAPData } from "@/types";
import type { VolumeAnalysis } from "@/types";
import type { SupportResistanceLevel } from "@/types";
import type { FibonacciLevels } from "@/types";
import type { CandlestickPattern } from "@/types";
import { momentumScore } from "./momentumScore";
import { trendScore } from "./trendScore";
import { volumeScore } from "./volumeScore";
import { compositeScore, scoreToAnalystRating } from "./compositeScore";
import { computePositionSizing } from "@/lib/utils/positionSizing";
import { computeRiskReward } from "@/lib/utils/riskReward";
import { validateStopVsATR } from "@/lib/indicators/atr";

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
  avwapLong: VWAPData;   // New: anchored VWAP from swing low
  avwapShort: VWAPData;  // New: anchored VWAP from swing high
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
  atrDaily: number[];    // New: ATR values for stop validation
  accountSize: number;
  riskPerTrade: number;
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

  // ATR for stop validation
  const atrCurrent = ctx.atrDaily[ctx.atrDaily.length - 1] ?? price * 0.02;

  const nearestSupport = ctx.srDaily.find((s) => s.type === "support")?.price ?? price * 0.95;
  const nearestResistance = ctx.srDaily.find((s) => s.type === "resistance")?.price ?? price * 1.05;

  const support = ctx.srDaily.filter((s) => s.type === "support").sort((a, b) => b.price - a.price)[0];
  const resistance = ctx.srDaily.filter((s) => s.type === "resistance").sort((a, b) => a.price - b.price)[0];

  // ATR-aware stops: use max(support-based stop, entry - 1.5×ATR)
  const stopBelowSupport = support
    ? Math.min(support.price * 0.995, price - atrCurrent * 1.5)
    : price - atrCurrent * 1.5;

  const stopAboveResistance = resistance
    ? Math.max(resistance.price * 1.005, price + atrCurrent * 1.5)
    : price + atrCurrent * 1.5;

  // Anchored VWAP context
  const avwapLongValue = ctx.avwapLong.values[ctx.avwapLong.values.length - 1] ?? price;
  const avwapShortValue = ctx.avwapShort.values[ctx.avwapShort.values.length - 1] ?? price;
  const priceAboveAvwapLong = price > avwapLongValue;
  const priceBelowAvwapShort = price < avwapShortValue;

  for (const bias of ["LONG", "SHORT"] as Bias[]) {
    const mom = momentumScore(ctx.rsiDaily, ctx.macdDaily, bias);
    const trend = trendScore(ctx.daily, ctx.sma50Daily, ctx.sma200Daily, ctx.ema9Daily, bias);
    const vol = volumeScore(ctx.volumeDaily, bias);
    const composite = compositeScore(mom, trend, vol);
    const analystRating = scoreToAnalystRating(composite, bias);

    const confirmingFactors: string[] = [];
    const riskFactors: string[] = [];

    if (ctx.rsiDaily.oversold) confirmingFactors.push("RSI oversold");
    if (ctx.rsiDaily.overbought) confirmingFactors.push("RSI overbought");
    if (ctx.rsiDaily.divergence === "bullish") confirmingFactors.push("Bullish RSI divergence");
    if (ctx.rsiDaily.divergence === "bearish") confirmingFactors.push("Bearish RSI divergence");
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

    // ── New: Volume directional signals ──────────────────────────────────
    if (bias === "LONG") {
      if (ctx.volumeDaily.accumulationSignal) confirmingFactors.push("Institutional accumulation signal");
      if (ctx.volumeDaily.volumeOnBreakout) confirmingFactors.push("Breakout on high volume");
      if (ctx.volumeDaily.distributionSignal) riskFactors.push("Distribution signal — smart money selling");
    } else {
      if (ctx.volumeDaily.distributionSignal) confirmingFactors.push("Distribution signal confirmed");
      if (ctx.volumeDaily.accumulationSignal) riskFactors.push("Accumulation detected — counter-trend risk");
    }

    // ── New: Anchored VWAP context ────────────────────────────────────────
    if (bias === "LONG" && priceAboveAvwapLong) {
      confirmingFactors.push("Above anchored VWAP (swing low)");
    } else if (bias === "LONG" && !priceAboveAvwapLong) {
      riskFactors.push("Below anchored VWAP — cost basis headwind");
    }
    if (bias === "SHORT" && priceBelowAvwapShort) {
      confirmingFactors.push("Below anchored VWAP (swing high)");
    }

    // ── Existing risk factors ─────────────────────────────────────────────
    if (!isNaN(s200) && price < s200 && bias === "LONG") riskFactors.push("Below 200 SMA");
    if (!isNaN(s200) && price > s200 && bias === "SHORT") riskFactors.push("Above 200 SMA");

    if (bias === "LONG") {
      // Golden Cross
      if (!isNaN(s50) && !isNaN(s200Prev) && !isNaN(s50Prev) && s50 > s200 && s50Prev <= s200Prev) {
        const tp = buildTradeParams(ctx, bias, "Golden Cross", "Daily", "A+",
          [...confirmingFactors, "50 SMA crossed above 200 SMA"], riskFactors,
          price, [nearestSupport, price], stopBelowSupport,
          [resistance?.price ?? price * 1.05, price * 1.1, price * 1.15],
          "Extended Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

      // 9 EMA Bounce
      if (!isNaN(e9_4H) && Math.abs(price - e9_4H) / price < 0.02 && ctx.volume4H.currentVsAvg > 1) {
        const tp = buildTradeParams(ctx, bias, "9 EMA Bounce", "4H", "A",
          [...confirmingFactors, "Price at 9 EMA on 4H"], riskFactors,
          price, [e9_4H * 0.998, e9_4H * 1.002], stopBelowSupport,
          [resistance?.price ?? price * 1.05, price * 1.1, price * 1.15],
          "Short Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

      // VWAP Reclaim — now using session 4H VWAP for intraday, AVWAP reclaim on daily
      if (ctx.vwap4H.priceAbove && ctx.volume4H.currentVsAvg >= 1.5) {
        const tp = buildTradeParams(ctx, bias, "VWAP Reclaim", "4H", "A",
          [...confirmingFactors, "Price reclaimed session VWAP with volume"], riskFactors,
          price, [price * 0.998, price * 1.002], stopBelowSupport,
          [resistance?.price ?? price * 1.05, price * 1.1, price * 1.15],
          "Short Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

      // Anchored VWAP Reclaim (daily) — stronger signal than session VWAP
      if (priceAboveAvwapLong && ctx.volumeDaily.currentVsAvg >= 1.5 &&
          price <= avwapLongValue * 1.01) {
        const tp = buildTradeParams(ctx, bias, "AVWAP Reclaim", "Daily", "A",
          [...confirmingFactors, "Price reclaimed anchored VWAP from swing low"], riskFactors,
          price, [avwapLongValue * 0.998, avwapLongValue * 1.002], stopBelowSupport,
          [resistance?.price ?? price * 1.05, price * 1.1, price * 1.15],
          "Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

      // BB Squeeze Breakout
      if (ctx.bbDaily.squeeze && ctx.bbDaily.touchingUpper && ctx.volumeDaily.currentVsAvg >= 1.5) {
        const tp = buildTradeParams(ctx, bias, "Bollinger Band Squeeze Breakout", "Daily", "A",
          [...confirmingFactors, "BB squeeze breakout with volume"], riskFactors,
          price, [price * 0.998, price * 1.002], stopBelowSupport,
          [ctx.bbDaily.upper[ctx.bbDaily.upper.length - 1] ?? price * 1.05, price * 1.1, price * 1.15],
          "Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

      // MA Stack Pullback
      if (!isNaN(e9) && !isNaN(s50) && !isNaN(s200) &&
          price > e9 && e9 > s50 && s50 > s200 && price <= s50 * 1.02) {
        const tp = buildTradeParams(ctx, bias, "MA Stack Pullback", "Daily", "A",
          [...confirmingFactors, "Pullback to 50 SMA in uptrend"], riskFactors,
          price, [s50 * 0.998, s50 * 1.002], stopBelowSupport,
          [resistance?.price ?? price * 1.05, price * 1.1, price * 1.15],
          "Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

      // MACD Bullish Cross
      if (ctx.macdDaily.crossover === "bullish" &&
          ctx.rsiDaily.values[ctx.rsiDaily.values.length - 1] < 60 &&
          !isNaN(ctx.macdDaily.macdLine[ctx.macdDaily.macdLine.length - 1]) &&
          ctx.macdDaily.macdLine[ctx.macdDaily.macdLine.length - 1] < 0) {
        const tp = buildTradeParams(ctx, bias, "MACD Bullish Cross + RSI < 60", "4H", "B",
          [...confirmingFactors, "MACD crossover below zero"], riskFactors,
          price, [price * 0.998, price * 1.002], stopBelowSupport,
          [resistance?.price ?? price * 1.05, price * 1.1, price * 1.15],
          "Short Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

      // Fibonacci Confluence
      if (ctx.fibDaily.within1Percent && ctx.fibDaily.nearestLevel &&
          ["38.2%", "50%", "61.8%"].includes(ctx.fibDaily.nearestLevel.level) &&
          ctx.patternsDaily.some((p) => p.type === "bullish")) {
        const tp = buildTradeParams(ctx, bias, "Fibonacci Confluence Buy", "Daily", "A",
          [...confirmingFactors, "At key Fib + bullish candle"], riskFactors,
          price, [price * 0.998, price * 1.002], stopBelowSupport,
          [resistance?.price ?? price * 1.05, price * 1.1, price * 1.15],
          "Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

      // Oversold RSI Reversal
      if (ctx.rsiDaily.oversold && ctx.rsiDaily.divergence === "bullish" &&
          ctx.volumeDaily.currentVsAvg >= 1.5) {
        const tp = buildTradeParams(ctx, bias, "Oversold RSI Reversal", "Daily", "B",
          [...confirmingFactors, "RSI oversold + divergence + volume"], riskFactors,
          price, [price * 0.998, price * 1.002], stopBelowSupport,
          [resistance?.price ?? price * 1.05, price * 1.1, price * 1.15],
          "Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

      // New: Accumulation + AVWAP setup
      if (ctx.volumeDaily.accumulationSignal && priceAboveAvwapLong) {
        const tp = buildTradeParams(ctx, bias, "Institutional Accumulation", "Daily", "A",
          [...confirmingFactors, "High-volume accumulation above AVWAP"], riskFactors,
          price, [price * 0.998, price * 1.002], stopBelowSupport,
          [resistance?.price ?? price * 1.05, price * 1.1, price * 1.15],
          "Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

    } else {
      // ── SHORT setups ────────────────────────────────────────────────────

      // Death Cross
      if (!isNaN(s50) && !isNaN(s200Prev) && !isNaN(s50Prev) && s50 < s200 && s50Prev >= s200Prev) {
        const tp = buildTradeParams(ctx, bias, "Death Cross", "Daily", "A+",
          [...confirmingFactors, "50 SMA crossed below 200 SMA"], riskFactors,
          price, [price, nearestResistance], stopAboveResistance,
          [support?.price ?? price * 0.95, price * 0.9, price * 0.85],
          "Extended Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

      // 9 EMA Rejection
      if (!isNaN(e9_4H) && Math.abs(price - e9_4H) / price < 0.02 && ctx.volume4H.currentVsAvg > 1) {
        const tp = buildTradeParams(ctx, bias, "9 EMA Rejection", "4H", "A",
          [...confirmingFactors, "Price rejected at 9 EMA on 4H"], riskFactors,
          price, [e9_4H * 0.998, e9_4H * 1.002], stopAboveResistance,
          [support?.price ?? price * 0.95, price * 0.9, price * 0.85],
          "Short Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

      // VWAP Rejection
      if (!ctx.vwap4H.priceAbove && ctx.volume4H.currentVsAvg >= 1.5) {
        const tp = buildTradeParams(ctx, bias, "VWAP Rejection", "4H", "A",
          [...confirmingFactors, "Price rejected at session VWAP"], riskFactors,
          price, [price * 0.998, price * 1.002], stopAboveResistance,
          [support?.price ?? price * 0.95, price * 0.9, price * 0.85],
          "Short Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

      // AVWAP Rejection (daily)
      if (priceBelowAvwapShort && ctx.volumeDaily.distributionSignal) {
        const tp = buildTradeParams(ctx, bias, "AVWAP Rejection", "Daily", "A",
          [...confirmingFactors, "Price rejected at anchored VWAP from swing high"], riskFactors,
          price, [price * 0.998, price * 1.002], stopAboveResistance,
          [support?.price ?? price * 0.95, price * 0.9, price * 0.85],
          "Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

      // BB Squeeze Breakdown
      if (ctx.bbDaily.squeeze && ctx.bbDaily.touchingLower && ctx.volumeDaily.currentVsAvg >= 1.5) {
        const tp = buildTradeParams(ctx, bias, "Bollinger Band Squeeze Breakdown", "Daily", "A",
          [...confirmingFactors, "BB squeeze breakdown with volume"], riskFactors,
          price, [price * 0.998, price * 1.002], stopAboveResistance,
          [ctx.bbDaily.lower[ctx.bbDaily.lower.length - 1] ?? price * 0.95, price * 0.9, price * 0.85],
          "Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

      // MA Stack Short
      if (!isNaN(e9) && !isNaN(s50) && !isNaN(s200) &&
          price < e9 && e9 < s50 && s50 < s200 && price >= s50 * 0.98) {
        const tp = buildTradeParams(ctx, bias, "MA Stack Short", "Daily", "A",
          [...confirmingFactors, "Bounce to 50 SMA in downtrend"], riskFactors,
          price, [s50 * 0.998, s50 * 1.002], stopAboveResistance,
          [support?.price ?? price * 0.95, price * 0.9, price * 0.85],
          "Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

      // MACD Bearish Cross
      if (ctx.macdDaily.crossover === "bearish" &&
          ctx.rsiDaily.values[ctx.rsiDaily.values.length - 1] > 40 &&
          !isNaN(ctx.macdDaily.macdLine[ctx.macdDaily.macdLine.length - 1]) &&
          ctx.macdDaily.macdLine[ctx.macdDaily.macdLine.length - 1] > 0) {
        const tp = buildTradeParams(ctx, bias, "MACD Bearish Cross + RSI > 40", "4H", "B",
          [...confirmingFactors, "MACD crossover above zero"], riskFactors,
          price, [price * 0.998, price * 1.002], stopAboveResistance,
          [support?.price ?? price * 0.95, price * 0.9, price * 0.85],
          "Short Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

      // Fibonacci Confluence Short
      if (ctx.fibDaily.within1Percent && ctx.fibDaily.nearestLevel &&
          ["50%", "61.8%"].includes(ctx.fibDaily.nearestLevel.level) &&
          ctx.patternsDaily.some((p) => p.type === "bearish")) {
        const tp = buildTradeParams(ctx, bias, "Fibonacci Confluence Short", "Daily", "A",
          [...confirmingFactors, "At key Fib + bearish candle"], riskFactors,
          price, [price * 0.998, price * 1.002], stopAboveResistance,
          [support?.price ?? price * 0.95, price * 0.9, price * 0.85],
          "Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

      // Overbought RSI Reversal
      if (ctx.rsiDaily.overbought && ctx.rsiDaily.divergence === "bearish" &&
          ctx.volumeDaily.currentVsAvg >= 1.5) {
        const tp = buildTradeParams(ctx, bias, "Overbought RSI Reversal", "Daily", "B",
          [...confirmingFactors, "RSI overbought + divergence + volume"], riskFactors,
          price, [price * 0.998, price * 1.002], stopAboveResistance,
          [support?.price ?? price * 0.95, price * 0.9, price * 0.85],
          "Swing", atrCurrent);
        if (tp) setups.push(tp);
      }

      // New: Distribution + AVWAP setup
      if (ctx.volumeDaily.distributionSignal && priceBelowAvwapShort) {
        const tp = buildTradeParams(ctx, bias, "Distribution Breakdown", "Daily", "A",
          [...confirmingFactors, "High-volume distribution below AVWAP"], riskFactors,
          price, [price * 0.998, price * 1.002], stopAboveResistance,
          [support?.price ?? price * 0.95, price * 0.9, price * 0.85],
          "Swing", atrCurrent);
        if (tp) setups.push(tp);
      }
    }
  }

  return setups;
}

/**
 * Build a validated trade parameter set.
 *
 * Key change from original: ATR-based stop validation.
 * If the stop doesn't make sense relative to ATR, the setup is rejected
 * rather than surfaced with a dangerously tight or comically wide stop.
 */
function buildTradeParams(
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
  holdDuration: HoldDuration,
  atrCurrent: number
): (SetupResult & { tradeParams: TradeParameters }) | null {
  const entryMid = (entryZone[0] + entryZone[1]) / 2;

  // ── ATR stop validation ──────────────────────────────────────────────────
  const stopValidation = validateStopVsATR(entryMid, stopPrice, atrCurrent);
  if (!stopValidation.valid) {
    // Don't surface setups with stops that will fail in real trading
    return null;
  }

  const rr = computeRiskReward(entryMid, stopPrice, targets[0], bias);
  if (rr < 1.5) return null;

  const pos = computePositionSizing(
    ctx.accountSize,
    ctx.riskPerTrade,
    entryMid,
    stopPrice,
    bias
  );

  const t1Gain = ((targets[0] - entryMid) / entryMid) * 100;
  const t2Gain = ((targets[1] - entryMid) / entryMid) * 100;
  const t3Gain = ((targets[2] - entryMid) / entryMid) * 100;

  const riskAmount = Math.abs(entryMid - stopPrice);

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
      atrMultiple: stopValidation.atrMultiple, // Surface for trader context
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
        volumeScore(ctx.volumeDaily, bias)
      ),
      bias
    ),
  };

  return {
    name,
    bias,
    timeframe,
    grade,
    confirmingFactors: confirming,
    riskFactors: risk,
    tradeParams,
  };
}
