import type { Bias } from "@/types";

/**
 * Risk/Reward ratio to target
 */
export function computeRiskReward(
  entry: number,
  stop: number,
  target: number,
  bias: Bias
): number {
  const risk = Math.abs(entry - stop);
  if (risk === 0) return 0;
  const reward = Math.abs(target - entry);
  return reward / risk;
}
