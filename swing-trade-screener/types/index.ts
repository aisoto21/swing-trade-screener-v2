// =============================================================================
// CORE DATA TYPES
// =============================================================================

export interface OHLCVBar {
  date: string; // ISO date string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe = "1D" | "4H" | "15M";

// Separate type for setup timeframe labels (avoids silent mismatch bug)
export type SetupTimeframe = "Daily" | "4H" | "15M";

// =============================================================================
// INDICATOR TYPES
// =============================================================================

export interface IndicatorResult {
  name: string;
  timeframe: Timeframe;
  values: number[] | number[][];
  metadata?: Record<string, unknown>;
}

export interface RSIData {
  values: number[];
  overbought: boolean;
  oversold: boolean;
  divergence?: "bullish" | "bearish" | null;
}

export interface MACDData {
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
  crossover?: "bullish" | "bearish" | null;
  zeroLineCross?: "bullish" | "bearish" | null;
}

export interface BollingerBandsData {
  upper: number[];
  middle: number[];
  lower: number[];
  squeeze: boolean;
  touchingUpper: boolean;
  touchingLower: boolean;
}

export interface VWAPData {
  values: number[];
  priceAbove: boolean;
  /** Present on anchored VWAP only */
  anchorIndex?: number;
  anchorDate?: string;
}

export interface SupportResistanceLevel {
  price: number;
  type: "support" | "resistance";
  touches: number;
  strength: number;
  distanceFromPrice: number; // percentage
}

export interface FibonacciLevels {
  retracement: Record<string, number>;
  extension: Record<string, number>;
  nearestLevel?: { level: string; price: number; type: "retracement" | "extension" };
  within1Percent: boolean;
}

export interface CandlestickPattern {
  name: string;
  type: "bullish" | "bearish";
  timeframe: Timeframe;
  confidence: "confirmed" | "unconfirmed";
  barIndex: number;
}

/**
 * Enhanced VolumeAnalysis with directional context signals.
 * The same volume reading means completely different things
 * depending on price location and candle close direction.
 */
export interface VolumeAnalysis {
  avgVolume20: number;
  currentVsAvg: number;
  classification: "Institutional Confirmation" | "Climactic / Exhaustion Risk" | "Weak / No Confirmation";
  volumeTrend: "expanding" | "contracting" | "neutral";
  obvSlope: "up" | "down" | "neutral";

  // ── New directional context fields ──────────────────────────────────────
  /** High volume + bullish close + price breaking above recent resistance */
  volumeOnBreakout: boolean;
  /** Climactic volume + close reversal (exhaustion signal) */
  volumeOnReversal: boolean;
  /** High volume + bearish close near resistance (smart money distribution) */
  distributionSignal: boolean;
  /** High volume + bullish close near support (institutional accumulation) */
  accumulationSignal: boolean;
}

/**
 * ATR analysis for stop validation and volatility context.
 */
export interface ATRData {
  values: number[];
  current: number;
  atrPercent: number; // ATR as % of price
  stopValidation?: {
    valid: boolean;
    atrMultiple: number;
    reason?: string;
  };
}

/**
 * Relative Strength vs. benchmark (SPY).
 * This is the single most important filter for long setups.
 */
export interface RSAnalysis {
  rs63: number;   // 1-quarter RS (core signal)
  rs252: number;  // 1-year RS (trend context)
  rating: number; // 0–100 approximation of IBD RS Rating
  trending: boolean;   // Short-term RS accelerating vs long-term
  rsNewHigh: boolean;  // RS line at 52-week high (leading signal)
  classification: "Leader" | "Outperformer" | "Neutral" | "Laggard" | "Avoid";
}

/**
 * Earnings risk context.
 */
export interface EarningsData {
  daysToEarnings: number;
  nextEarningsDate?: string;
  riskLevel: "HIGH" | "MODERATE" | "LOW" | "UNKNOWN";
  insideEarningsWindow: boolean; // within 14 days
}

// =============================================================================
// SETUP & TRADE TYPES
// =============================================================================

export type Bias = "LONG" | "SHORT";

export type SetupGrade = "A+" | "A" | "B" | "C";

export type EntryType = "Limit" | "Stop Limit" | "Market on Confirm";

export type StopType = "Hard Stop" | "Closing Stop";

export type HoldDuration =
  | "Scalp"
  | "Short Swing"
  | "Swing"
  | "Extended Swing";

export type AnalystRating =
  | "Strong Buy"
  | "Buy"
  | "Speculative Buy"
  | "Watch"
  | "Strong Sell"
  | "Sell"
  | "Speculative Sell";

export interface SetupResult {
  name: string;
  bias: Bias;
  timeframe: SetupTimeframe; // Fixed: was Timeframe (mismatch with "Daily" strings)
  grade: SetupGrade;
  confirmingFactors: string[];
  riskFactors: string[];
}

export interface TradeParameters {
  entry: {
    zone: [number, number];
    trigger: string;
    type: EntryType;
  };
  targets: {
    t1: { price: number; percentGain: number; partialPercent: number };
    t2: { price: number; percentGain: number; partialPercent: number };
    t3: { price: number; percentGain: number; partialPercent: number };
  };
  stop: {
    price: number;
    type: StopType;
    riskPercent: number;
    atrMultiple?: number; // How many ATRs from entry — context for trader
  };
  riskReward: {
    toT1: number;
    toT2: number;
    toT3: number;
  };
  positionSizing: {
    maxShares: number;
    maxDollarExposure: number;
    portfolioPercent: number;
    concentrationWarning: boolean;
  };
  holdDuration: HoldDuration;
  analystRating: AnalystRating;
}

// =============================================================================
// SCREENER TYPES
// =============================================================================

export type MarketRegime =
  | "Bull Market"
  | "Bear Market"
  | "Choppy/Sideways"
  | "Distribution"
  | "Accumulation";

export interface MarketRegimeResult {
  regime: MarketRegime;
  spyAbove50SMA: boolean;
  spyAbove200SMA: boolean;
  spyRSIAbove50: boolean;
  spyConfirmedDowntrend: boolean;
  timestamp: string;
}

export interface ScreenerFilters {
  minPrice: number;
  minVolume: number;
  minMarketCap: number;
  biasFilter: "LONG" | "SHORT" | "BOTH";
  minSetupGrade: SetupGrade;
  minRR: number;
  accountSize: number;
  riskPerTrade: number;
  excludeETFs?: boolean;
  excludeOTC?: boolean;
  excludeADRs?: boolean;
  sector?: string;
  includeBearishSetups?: boolean;
  // New filters
  minRSRating?: number;        // Min RS rating (0–100). Recommended: 70 for longs
  excludeEarningsRisk?: boolean; // Exclude tickers with earnings within 14 days
}

export interface ScreenerResult {
  ticker: string;
  companyName: string;
  sector: string;
  price: number;
  priceChangePercent: number;
  marketCap: number;
  setups: Array<SetupResult & { tradeParams: TradeParameters }>;
  primarySetup: SetupResult & { tradeParams: TradeParameters };
  volumeVsAvg: number;
  volumeClassification: VolumeAnalysis["classification"];
  keyConfirmingFactors: string[];
  analystRating: AnalystRating;
  timestamp: string;

  // ── New fields ────────────────────────────────────────────────────────────
  rsAnalysis?: RSAnalysis;
  earningsData?: EarningsData;
  atrData?: ATRData;
}

// =============================================================================
// DEEP ANALYSIS TYPES
// =============================================================================

export interface DeepAnalysisResult {
  ticker: string;
  companyName: string;
  sector: string;
  price: number;
  priceChangePercent: number;
  marketCap: number;
  ohlcv: Record<Timeframe, OHLCVBar[]>;
  indicators: {
    daily: Record<string, unknown>;
    fourHour: Record<string, unknown>;
    fifteenMin: Record<string, unknown>;
  };
  volumeAnalysis: VolumeAnalysis;
  supportResistance: SupportResistanceLevel[];
  fibonacci: FibonacciLevels;
  candlestickPatterns: CandlestickPattern[];
  setups: Array<SetupResult & { tradeParams: TradeParameters }>;
  primarySetup: SetupResult & { tradeParams: TradeParameters };
  analystRating: AnalystRating;
  analystRatingBreakdown: Record<string, number>;
  marketRegime: MarketRegimeResult;
  timestamp: string;

  // ── New fields ────────────────────────────────────────────────────────────
  rsAnalysis?: RSAnalysis;
  earningsData?: EarningsData;
  atrData?: ATRData;
}

// =============================================================================
// OPTIONS LAYER TYPES (Phase 3)
// =============================================================================

export interface IVAnalysis {
  currentIV: number;
  ivRank: number;
  ivPercentile: number;
  ivTrend: "expanding" | "contracting" | "stable";
  ivVsHV: "rich" | "fair" | "cheap";
  historicalDaysAvailable: number;
}

export interface OptionsGreeks {
  delta: number;
  theta: number;
  vega: number;
  gamma: number;
  probabilityOfProfit: number;
  thetaCliffWarning: boolean;
}

export type ContractStructure =
  | "long_call"
  | "long_put"
  | "bull_call_spread"
  | "bear_put_spread"
  | "pmcc"
  | "none";

export interface ContractRecommendation {
  structure: ContractStructure;
  ticker: string;
  expiration: string;
  longStrike: number;
  shortStrike?: number;
  contractType: "call" | "put";
  dte: number;
  midPrice: number;
  maxRisk: number;
  breakevenAtExpiration: number;
  contracts: number;
  totalPremium: number;
  greeks: OptionsGreeks;
  ivAnalysis: IVAnalysis;
  expectedMove: { up: number; down: number; pct: number };
  targetVsExpectedMove: "favorable" | "neutral" | "unfavorable";
  skewInterpretation: "favorable" | "neutral" | "warning";
  spreadQuality: "tight" | "acceptable" | "wide";
  earningsWarning: boolean;
  earningsDaysAway?: number;
  unusualActivity: boolean;
  unusualActivityDetail?: string;
  rationale: string[];
  warnings: string[];
  upgradeNote?: string;
}

export interface OptionsScreenerResult extends ScreenerResult {
  optionsRecommendation: ContractRecommendation | null;
  optionsEligible: boolean;
  optionsIneligibleReason?: string;
}

export interface OptionsContract {
  strike: number;
  expiration: string;
  type: "call" | "put";
  bid: number;
  ask: number;
  last: number;
  volume: number;
  openInterest: number;
  impliedVolatility?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

export interface OptionsChain {
  ticker: string;
  underlyingPrice: number;
  expirations: string[];
  calls: OptionsContract[];
  puts: OptionsContract[];
}
