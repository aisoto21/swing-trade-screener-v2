import type { OHLCVBar } from "@/types";
import type { RSIData } from "@/types";
import { RSI_PERIOD, RSI_OVERBOUGHT, RSI_OVERSOLD } from "@/constants/indicators";

/**
 * Relative Strength Index — Wilder's smoothing (matches TradingView, Bloomberg, brokers)
 * Seed: simple average of first period gains/losses
 * Subsequent: avgGain = (prevAvgGain × (period - 1) + currentGain) / period
 */
export function rsi(closes: number[], period: number = RSI_PERIOD): number[] {
  if (closes.length < period + 1) {
    return new Array(closes.length).fill(NaN);
  }

  const result: number[] = new Array(period).fill(NaN);

  // Seed: simple average of first period
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  const seedRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(100 - 100 / (1 + seedRS));

  // Wilder's smoothing for remaining bars
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }

  return result;
}

/**
 * Find swing highs/lows in a series.
 * A swing high: value[i] is greater than `wing` bars on both sides.
 * A swing low:  value[i] is less than `wing` bars on both sides.
 */
function findSwingPoints(
  values: number[],
  wing: number = 3
): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];

  for (let i = wing; i < values.length - wing; i++) {
    if (isNaN(values[i])) continue;
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= wing; j++) {
      if (values[i] <= values[i - j] || values[i] <= values[i + j]) isHigh = false;
      if (values[i] >= values[i - j] || values[i] >= values[i + j]) isLow = false;
    }
    if (isHigh) highs.push(i);
    if (isLow) lows.push(i);
  }
  return { highs, lows };
}

/**
 * RSI with overbought/oversold and divergence detection (swing point based)
 */
export function rsiFull(bars: OHLCVBar[], period: number = RSI_PERIOD): RSIData {
  const closes = bars.map((b) => b.close);
  const values = rsi(closes, period);
  const lastIdx = values.length - 1;
  const lastValue = values[lastIdx];

  // ── Divergence detection using swing points ──────────────────────────────
  let divergence: "bullish" | "bearish" | "hidden_bullish" | "hidden_bearish" | null = null;

  if (lastIdx >= 30) {
    const recentBars = 40;
    const priceSlice = closes.slice(Math.max(0, lastIdx - recentBars), lastIdx + 1);
    const rsiSlice = values.slice(Math.max(0, lastIdx - recentBars), lastIdx + 1);

    const priceSwings = findSwingPoints(priceSlice, 3);
    const rsiSwings = findSwingPoints(rsiSlice, 3);

    if (priceSwings.highs.length >= 2 && rsiSwings.highs.length >= 2) {
      const pH1 = priceSlice[priceSwings.highs[priceSwings.highs.length - 2]];
      const pH2 = priceSlice[priceSwings.highs[priceSwings.highs.length - 1]];
      const rH1 = rsiSlice[rsiSwings.highs[rsiSwings.highs.length - 2]];
      const rH2 = rsiSlice[rsiSwings.highs[rsiSwings.highs.length - 1]];

      if (pH2 > pH1 && rH2 < rH1 && lastValue < 70) {
        divergence = "bearish";
      } else if (pH2 < pH1 && rH2 > rH1 && lastValue > 50) {
        divergence = "hidden_bearish";
      }
    }

    if (priceSwings.lows.length >= 2 && rsiSwings.lows.length >= 2) {
      const pL1 = priceSlice[priceSwings.lows[priceSwings.lows.length - 2]];
      const pL2 = priceSlice[priceSwings.lows[priceSwings.lows.length - 1]];
      const rL1 = rsiSlice[rsiSwings.lows[rsiSwings.lows.length - 2]];
      const rL2 = rsiSlice[rsiSwings.lows[rsiSwings.lows.length - 1]];

      if (pL2 < pL1 && rL2 > rL1 && lastValue > 30) {
        divergence = "bullish";
      } else if (pL2 > pL1 && rL2 < rL1 && lastValue < 50) {
        divergence = "hidden_bullish";
      }
    }
  }

  return {
    values,
    overbought: !isNaN(lastValue) && lastValue >= RSI_OVERBOUGHT,
    oversold: !isNaN(lastValue) && lastValue <= RSI_OVERSOLD,
    divergence,
  };
}
