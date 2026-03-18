import type { AnalystRating } from "@/types";
import type { MarketBreadth } from "@/lib/utils/marketBreadth";

const MOMENTUM_WEIGHT = 0.35;
const TREND_WEIGHT = 0.35;
const VOLUME_WEIGHT = 0.3;

/**
 * Get breadth multiplier: >70% above 50 SMA boosts longs, <40% penalizes longs / boosts shorts
 */
function getBreadthMultiplier(
  breadth: MarketBreadth | null | undefined,
  bias: "LONG" | "SHORT"
): number {
  if (!breadth) return 1;
  if (breadth.percentAbove50SMA > 70) {
    return bias === "LONG" ? 1.05 : 0.9;
  }
  if (breadth.percentAbove50SMA < 40) {
    return bias === "LONG" ? 0.9 : 1.05;
  }
  return 1;
}

/**
 * Composite score 0-100, optionally adjusted by market breadth
 */
export function compositeScore(
  momentum: number,
  trend: number,
  volume: number,
  breadth?: MarketBreadth | null,
  bias?: "LONG" | "SHORT"
): number {
  const raw =
    momentum * MOMENTUM_WEIGHT +
    trend * TREND_WEIGHT +
    volume * VOLUME_WEIGHT;
  const mult = breadth != null && bias ? getBreadthMultiplier(breadth, bias) : 1;
  return Math.min(100, Math.max(0, raw * mult));
}

/**
 * Convert composite score to analyst rating
 */
export function scoreToAnalystRating(
  score: number,
  bias: "LONG" | "SHORT"
): AnalystRating {
  if (bias === "LONG") {
    if (score >= 75) return "Strong Buy";
    if (score >= 60) return "Buy";
    if (score >= 45) return "Speculative Buy";
    return "Watch";
  } else {
    if (score >= 75) return "Strong Sell";
    if (score >= 60) return "Sell";
    if (score >= 45) return "Speculative Sell";
    return "Watch";
  }
}
