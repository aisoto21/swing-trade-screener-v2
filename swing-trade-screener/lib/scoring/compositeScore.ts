import type { AnalystRating } from "@/types";

const MOMENTUM_WEIGHT = 0.35;
const TREND_WEIGHT = 0.35;
const VOLUME_WEIGHT = 0.3;

/**
 * Composite score 0-100
 */
export function compositeScore(
  momentum: number,
  trend: number,
  volume: number
): number {
  return (
    momentum * MOMENTUM_WEIGHT +
    trend * TREND_WEIGHT +
    volume * VOLUME_WEIGHT
  );
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
