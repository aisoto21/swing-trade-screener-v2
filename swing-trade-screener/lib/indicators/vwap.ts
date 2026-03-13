import type { OHLCVBar } from "@/types";
import type { VWAPData } from "@/types";

/**
 * Volume Weighted Average Price - resets daily
 * For intraday (4H, 15M), compute VWAP per session
 */
export function vwap(bars: OHLCVBar[]): VWAPData {
  const result: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVol = 0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    cumulativeTPV += typicalPrice * bar.volume;
    cumulativeVol += bar.volume;
    result.push(cumulativeVol > 0 ? cumulativeTPV / cumulativeVol : bar.close);
  }

  const lastPrice = bars[bars.length - 1]?.close ?? 0;
  const lastVwap = result[result.length - 1] ?? 0;

  return {
    values: result,
    priceAbove: lastPrice > lastVwap,
  };
}
