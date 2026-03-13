import type { OHLCVBar } from "@/types";

/**
 * Trend score 0-100 based on price vs MAs
 */
export function trendScore(
  bars: OHLCVBar[],
  sma50: number[],
  sma200: number[],
  ema9: number[],
  bias: "LONG" | "SHORT"
): number {
  let score = 50;
  const lastIdx = bars.length - 1;
  const price = bars[lastIdx]?.close ?? 0;

  const s50 = sma50[lastIdx];
  const s200 = sma200[lastIdx];
  const e9 = ema9[lastIdx];

  if (bias === "LONG") {
    if (!isNaN(s50) && price > s50) score += 10;
    if (!isNaN(s200) && price > s200) score += 15;
    if (!isNaN(e9) && price > e9) score += 10;
    if (!isNaN(s50) && !isNaN(s200) && s50 > s200) score += 15;
  } else {
    if (!isNaN(s50) && price < s50) score += 10;
    if (!isNaN(s200) && price < s200) score += 15;
    if (!isNaN(e9) && price < e9) score += 10;
    if (!isNaN(s50) && !isNaN(s200) && s50 < s200) score += 15;
  }

  return Math.max(0, Math.min(100, score));
}
