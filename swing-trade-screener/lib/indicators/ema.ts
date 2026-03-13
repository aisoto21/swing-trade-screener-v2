import type { OHLCVBar } from "@/types";
import { EMA_9_PERIOD, EMA_20_PERIOD } from "@/constants/indicators";

/**
 * Exponential Moving Average
 * multiplier = 2 / (period + 1)
 */
export function ema(closes: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += closes[j];
      }
      result.push(sum / period);
    } else {
      const emaValue = (closes[i] - result[i - 1]) * multiplier + result[i - 1];
      result.push(emaValue);
    }
  }
  return result;
}

/**
 * 9-period EMA
 */
export function ema9(bars: OHLCVBar[]): number[] {
  const closes = bars.map((b) => b.close);
  return ema(closes, EMA_9_PERIOD);
}

/**
 * 20-period EMA (for Bollinger Band midline)
 */
export function ema20(bars: OHLCVBar[]): number[] {
  const closes = bars.map((b) => b.close);
  return ema(closes, EMA_20_PERIOD);
}
