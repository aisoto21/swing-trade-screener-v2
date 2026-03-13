import { FEATURES } from "@/config/features";
import type { FeatureFlag } from "@/config/features";

export function useFeature(flag: FeatureFlag): boolean {
  return FEATURES[flag];
}
