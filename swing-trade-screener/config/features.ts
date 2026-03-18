export const FEATURES = {
  // Phase 3 — Options
  OPTIONS_LAYER: false,
  OPTIONS_CHAIN_DATA: false,
  GREEKS_DISPLAY: false,
  IV_RANK_COLUMN: false,
  CONTRACT_RECOMMENDER: false,
  STRUCTURE_ENGINE: false,
  UNUSUAL_ACTIVITY_FLAG: false,
  IV_HISTORY_TRACKER: false,

  // Phase 4 — New
  PORTFOLIO_VIEW: true,
  TRADE_LOG: true,
  PERFORMANCE_ANALYTICS: true,
  SECTOR_RS: true,
  GAP_ANALYSIS: true,
  NEWS_SENTIMENT: false,
  CORRELATION_GUARD: true,
  MARKET_BREADTH: true,
  ECONOMIC_CALENDAR: true,
  KELLY_SIZING: false,
  POSITION_SCREENER: false,
  QUALITY_GROWTH_SCREENER: false,
  DEEP_VALUE_SCREENER: false,
  SHORT_INTEREST: false,
  PREMARKET_CONTEXT: false,
  MTF_SCORE: true,
  WALL_STREET_CONSENSUS: false,
} as const;

export type FeatureFlag = keyof typeof FEATURES;
