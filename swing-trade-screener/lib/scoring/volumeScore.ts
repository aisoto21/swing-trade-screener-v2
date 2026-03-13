import type { VolumeAnalysis } from "@/types";
import { VOLUME_INSTITUTIONAL, VOLUME_CLIMACTIC } from "@/constants/indicators";

/**
 * Volume score 0-100 (higher = better volume confirmation)
 */
export function volumeScore(vol: VolumeAnalysis, bias: "LONG" | "SHORT"): number {
  let score = 50;

  if (vol.currentVsAvg >= VOLUME_INSTITUTIONAL && vol.currentVsAvg < VOLUME_CLIMACTIC) {
    score += 25;
  } else if (vol.currentVsAvg >= VOLUME_CLIMACTIC) {
    score += 10;
  } else if (vol.currentVsAvg < 1) {
    score -= 20;
  }

  if (vol.volumeTrend === "expanding") score += 10;
  else if (vol.volumeTrend === "contracting") score -= 10;

  if (bias === "LONG" && vol.obvSlope === "up") score += 10;
  else if (bias === "SHORT" && vol.obvSlope === "down") score += 10;
  else if (vol.obvSlope === "neutral") score += 5;

  return Math.max(0, Math.min(100, score));
}
