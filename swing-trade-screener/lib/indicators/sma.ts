import type { OHLCVBar } from "@/types";
import { SMA_50_PERIOD, SMA_200_PERIOD } from "@/constants/indicators";

/**
 * Simple Moving Average
 */
export function sma(closes: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += closes[i - j];
      }
      result.push(sum / period);
    }
  }
  return result;
}

/**
 * 50-period SMA
 */
export function sma50(bars: OHLCVBar[]): number[] {
  const closes = bars.map((b) => b.close);
  return sma(closes, SMA_50_PERIOD);
}

/**
 * 200-period SMA
 */
export function sma200(bars: OHLCVBar[]): number[] {
  const closes = bars.map((b) => b.close);
  return sma(closes, SMA_200_PERIOD);
}
