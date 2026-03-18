import type { OHLCVBar } from "@/types";
import type { VolumeAnalysis } from "@/types";
import {
  VOLUME_AVG_PERIOD,
  VOLUME_INSTITUTIONAL,
  VOLUME_CLIMACTIC,
  VOLUME_TREND_BARS,
} from "@/constants/indicators";

/**
 * On-Balance Volume
 */
function obv(bars: OHLCVBar[]): number[] {
  const result: number[] = [];
  let running = 0;
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) {
      running = bars[i].volume;
    } else {
      if (bars[i].close > bars[i - 1].close) running += bars[i].volume;
      else if (bars[i].close < bars[i - 1].close) running -= bars[i].volume;
    }
    result.push(running);
  }
  return result;
}

/**
 * Enhanced volume analysis with directional context.
 *
 * The key insight: the SAME volume reading means completely different things
 * depending on WHERE price is and HOW price closed.
 *
 *   High volume + price closing near highs above resistance = Breakout (bullish)
 *   High volume + bearish candle near resistance = Distribution (bearish)
 *   High volume + price closing near lows = Capitulation (watch for reversal)
 *   High volume + bullish engulf at support = Accumulation (bullish)
 */
export function volumeAnalysis(bars: OHLCVBar[]): VolumeAnalysis {
  if (bars.length < VOLUME_AVG_PERIOD) {
    return {
      avgVolume20: 0,
      currentVsAvg: 0,
      classification: "Weak / No Confirmation",
      volumeTrend: "neutral",
      obvSlope: "neutral",
      volumeOnBreakout: false,
      volumeOnReversal: false,
      distributionSignal: false,
      accumulationSignal: false,
    };
  }

  // ── Base metrics ──────────────────────────────────────────────────────────
  const recent = bars.slice(-VOLUME_AVG_PERIOD);
  const avgVolume20 =
    recent.reduce((s, b) => s + b.volume, 0) / VOLUME_AVG_PERIOD;
  const currentBar = bars[bars.length - 1];
  const prevBar = bars[bars.length - 2];
  const currentVolume = currentBar?.volume ?? 0;
  const currentVsAvg = avgVolume20 > 0 ? currentVolume / avgVolume20 : 0;

  let classification: VolumeAnalysis["classification"] = "Weak / No Confirmation";
  if (currentVsAvg >= VOLUME_CLIMACTIC) {
    classification = "Climactic / Exhaustion Risk";
  } else if (currentVsAvg >= VOLUME_INSTITUTIONAL) {
    classification = "Institutional Confirmation";
  }

  // ── Volume trend (expanding vs contracting) ────────────────────────────
  const trendBars = bars.slice(-VOLUME_TREND_BARS);
  const half = Math.floor(trendBars.length / 2);
  const volSumFirst = trendBars.slice(0, half).reduce((s, b) => s + b.volume, 0);
  const volSumSecond = trendBars.slice(half).reduce((s, b) => s + b.volume, 0);
  const volumeTrend: VolumeAnalysis["volumeTrend"] =
    volSumSecond > volSumFirst * 1.1
      ? "expanding"
      : volSumSecond < volSumFirst * 0.9
      ? "contracting"
      : "neutral";

  // ── OBV slope ─────────────────────────────────────────────────────────────
  const obvValues = obv(bars);
  const obvLast = obvValues[obvValues.length - 1] ?? 0;
  const obvPrev = obvValues[obvValues.length - 6] ?? obvLast;
  const obvSlope: VolumeAnalysis["obvSlope"] =
    obvLast > obvPrev * 1.01 ? "up" : obvLast < obvPrev * 0.99 ? "down" : "neutral";

  // ── Directional context signals ───────────────────────────────────────────
  const isHighVolume = currentVsAvg >= VOLUME_INSTITUTIONAL;
  const isBullishClose = currentBar && currentBar.close > currentBar.open;
  const isBearishClose = currentBar && currentBar.close < currentBar.open;

  // Close position within bar range (0 = low, 1 = high)
  const closePosition = currentBar
    ? (currentBar.close - currentBar.low) / (currentBar.high - currentBar.low || 1)
    : 0.5;

  // Recent resistance: highest high in last 20 bars (excluding current)
  const recentHigh = Math.max(...bars.slice(-21, -1).map((b) => b.high));
  // Recent support: lowest low in last 20 bars (excluding current)
  const recentLow = Math.min(...bars.slice(-21, -1).map((b) => b.low));

  const nearResistance = currentBar
    ? currentBar.close >= recentHigh * 0.98
    : false;
  const nearSupport = currentBar
    ? currentBar.close <= recentLow * 1.02
    : false;

  // ── Breakout signal ───────────────────────────────────────────────────────
  // High volume + bullish close + price breaking above recent resistance
  const volumeOnBreakout =
    isHighVolume &&
    isBullishClose &&
    closePosition > 0.6 && // closed in upper portion of bar
    currentBar != null &&
    currentBar.close > recentHigh;

  // ── Distribution signal ───────────────────────────────────────────────────
  // High volume + bearish close + price at or near recent resistance
  // Classic "smart money selling into retail buyers"
  const distributionSignal =
    isHighVolume &&
    isBearishClose &&
    nearResistance &&
    closePosition < 0.4; // closed in lower portion of bar

  // ── Reversal/exhaustion signal ────────────────────────────────────────────
  // Very high volume + close reversal — climactic selling or buying
  const volumeOnReversal =
    currentVsAvg >= VOLUME_CLIMACTIC &&
    prevBar != null &&
    currentBar != null &&
    // Price gap down then recovered OR gap up then rejected
    ((prevBar.close > prevBar.open && isBearishClose) ||
      (prevBar.close < prevBar.open && isBullishClose));

  // ── Accumulation signal ───────────────────────────────────────────────────
  // High volume + bullish close + price near support
  // Institutional buying at a known support level
  const accumulationSignal =
    isHighVolume &&
    isBullishClose &&
    nearSupport &&
    closePosition > 0.5 && // recovered off the lows
    obvSlope === "up";

  return {
    avgVolume20,
    currentVsAvg,
    classification,
    volumeTrend,
    obvSlope,
    volumeOnBreakout,
    volumeOnReversal,
    distributionSignal,
    accumulationSignal,
  };
}
