export const FEATURES = {
  OPTIONS_LAYER: false,
  OPTIONS_CHAIN_DATA: false,
  GREEKS_DISPLAY: false,
  IV_RANK_COLUMN: false,
  CONTRACT_RECOMMENDER: false,
  STRUCTURE_ENGINE: false,
  UNUSUAL_ACTIVITY_FLAG: false,
  IV_HISTORY_TRACKER: false,
} as const;

export type FeatureFlag = keyof typeof FEATURES;
