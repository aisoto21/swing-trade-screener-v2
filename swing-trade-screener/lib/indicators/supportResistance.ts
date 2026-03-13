import type { OHLCVBar } from "@/types";
import type { SupportResistanceLevel } from "@/types";
import { SR_PIVOT_LOOKBACK, SR_MIN_TOUCHES } from "@/constants/indicators";

/**
 * Find pivot highs and lows
 */
function findPivots(bars: OHLCVBar[], left: number = 2, right: number = 2): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = left; i < bars.length - right; i++) {
    let isHigh = true;
    for (let j = 1; j <= left; j++) {
      if (bars[i].high <= bars[i - j].high) isHigh = false;
    }
    for (let j = 1; j <= right; j++) {
      if (bars[i].high <= bars[i + j].high) isHigh = false;
    }
    if (isHigh) highs.push(bars[i].high);

    let isLow = true;
    for (let j = 1; j <= left; j++) {
      if (bars[i].low >= bars[i - j].low) isLow = false;
    }
    for (let j = 1; j <= right; j++) {
      if (bars[i].low >= bars[i + j].low) isLow = false;
    }
    if (isLow) lows.push(bars[i].low);
  }
  return { highs, lows };
}

/**
 * Cluster nearby levels and count touches
 */
function clusterLevels(
  levels: number[],
  tolerance: number,
  bars: OHLCVBar[]
): Array<{ price: number; touches: number }> {
  const clusters: Array<{ price: number; count: number }> = [];
  for (const level of levels) {
    const existing = clusters.find((c) => Math.abs(c.price - level) / level < tolerance);
    if (existing) {
      existing.price = (existing.price * existing.count + level) / (existing.count + 1);
      existing.count++;
    } else {
      clusters.push({ price: level, count: 1 });
    }
  }

  const result: Array<{ price: number; touches: number }> = [];
  for (const cluster of clusters) {
    let touches = 0;
    for (const bar of bars) {
      const range = bar.high - bar.low;
      const tol = Math.max(tolerance * bar.close, range * 0.02);
      if (Math.abs(bar.high - cluster.price) <= tol || Math.abs(bar.low - cluster.price) <= tol || 
          (bar.low <= cluster.price && bar.high >= cluster.price)) {
        touches++;
      }
    }
    if (touches >= SR_MIN_TOUCHES) {
      result.push({ price: cluster.price, touches });
    }
  }
  return result;
}

/**
 * Support and Resistance levels
 */
export function supportResistance(bars: OHLCVBar[]): SupportResistanceLevel[] {
  const slice = bars.slice(-SR_PIVOT_LOOKBACK);
  if (slice.length < 10) return [];

  const { highs, lows } = findPivots(slice);
  const tolerance = 0.02;
  const resistanceLevels = clusterLevels(highs, tolerance, slice);
  const supportLevels = clusterLevels(lows, tolerance, slice);

  const currentPrice = slice[slice.length - 1]?.close ?? 0;
  const result: SupportResistanceLevel[] = [];

  for (const { price, touches } of resistanceLevels) {
    if (price > currentPrice) {
      result.push({
        price,
        type: "resistance",
        touches,
        strength: touches / 5,
        distanceFromPrice: ((price - currentPrice) / currentPrice) * 100,
      });
    }
  }

  for (const { price, touches } of supportLevels) {
    if (price < currentPrice) {
      result.push({
        price,
        type: "support",
        touches,
        strength: touches / 5,
        distanceFromPrice: ((currentPrice - price) / currentPrice) * 100,
      });
    }
  }

  result.sort((a, b) => {
    if (a.type === "support" && b.type === "support") return b.price - a.price;
    if (a.type === "resistance" && b.type === "resistance") return a.price - b.price;
    return 0;
  });

  const nearestSupport = result.filter((r) => r.type === "support").sort((a, b) => b.price - a.price)[0];
  const nearestResistance = result.filter((r) => r.type === "resistance").sort((a, b) => a.price - b.price)[0];

  const output: SupportResistanceLevel[] = [];
  if (nearestSupport) output.push(nearestSupport);
  if (nearestResistance) output.push(nearestResistance);

  return output;
}
