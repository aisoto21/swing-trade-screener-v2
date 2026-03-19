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
  divergence?: "bullish" | "bearish" | "hidden_bullish" | "hidden_bearish" | null;
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

export interface VolumeAnalysis {
  avgVolume20: number;
  currentVsAvg: number;
  classification: "Institutional Confirmation" | "Climactic / Exhaustion Risk" | "Weak / No Confirmation";
  volumeTrend: "expanding" | "contracting" | "neutral";
  obvSlope: "up" | "down" | "neutral";
}

export interface ATRData {
  current: number;      // Raw ATR value in dollars
  atrPercent: number;   // ATR as % of price
}

export interface EarningsData {
  daysToEarnings: number;
  nextEarningsDate?: string;
  riskLevel: "HIGH" | "MODERATE" | "LOW" | "UNKNOWN";
}

export interface GapInfo {
  type: "up" | "down";
  sizePct: number;
  top: number;
  bottom: number;
  filled: boolean;
  barIndex: number;
}

export interface GapAnalysis {
  gap: GapInfo | null;
  setup: "Gap and Go" | "Gap Fill" | "Gap Rejection" | null;
  bias: "LONG" | "SHORT" | null;
}

export interface SectorRSResult {
  sector: string;
  sectorETF: string;
  sectorRS: number;
  sectorRank: number;
  sectorTrend: "improving" | "deteriorating" | "stable";
  isLeadingSector: boolean;
  isWeakSector: boolean;
}

export interface NewsSentiment {
  sentiment: "positive" | "negative" | "neutral";
  headlineCount: number;
  negativeHeadlines: string[];
  positiveHeadlines: string[];
  hasHighImpactNews: boolean;
  riskFlag: boolean;
}

export type { RSAnalysis } from "@/lib/indicators/relativeStrength";

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

export interface EconomicEvent {
  date: string;
  name: string;
  impact: "HIGH" | "MEDIUM";
  description: string;
}

export interface EconomicRisk {
  hasNearTermEvent: boolean;
  nextEvent?: EconomicEvent;
  daysUntilEvent?: number;
  riskLevel: "HIGH" | "MODERATE" | "NONE";
}

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
  timeframe: Timeframe;
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
  economicRisk?: EconomicRisk;
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

export type SizingMethod = "fixed_risk" | "half_kelly" | "full_kelly";

export interface KellyParams {
  closedTrades: number;
  winRate: number;
  avgWinPercent: number;
  avgLossPercent: number;
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
  sizingMethod?: SizingMethod;
  kellyParams?: KellyParams;
  excludeETFs?: boolean;
  excludeOTC?: boolean;
  excludeADRs?: boolean;
  sector?: string;
  includeBearishSetups?: boolean;
  minRSRating?: number;
  excludeEarningsRisk?: boolean;
}

export interface WallStreetConsensus {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  totalAnalysts: number;
  consensusLabel: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell" | "No Coverage";
  meanPriceTarget?: number;
  highPriceTarget?: number;
  lowPriceTarget?: number;
  upsideToMean?: number;
  edgeScreenAgreement: "agrees" | "disagrees" | "neutral";
}

export interface ShortInterestData {
  shortPercentOfFloat: number;
  shortRatio: number;
  isHighShortInterest: boolean;
  squeezeCandidate: boolean;
  source: "yahoo" | "finnhub";
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
  wallStreetConsensus?: WallStreetConsensus;
  gapAnalysis?: GapAnalysis;
  sectorRS?: SectorRSResult;
  newsSentiment?: NewsSentiment;
  shortInterest?: ShortInterestData;
  rsAnalysis?: RSAnalysis;
  atr?: ATRData;
  earnings?: EarningsData;
  preMarketContext?: import("@/lib/utils/marketHours").PreMarketContext;
  timestamp: string;
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
  wallStreetConsensus?: WallStreetConsensus;
  gapAnalysis?: GapAnalysis;
  sectorRS?: SectorRSResult;
  newsSentiment?: NewsSentiment;
  preMarketContext?: import("@/lib/utils/marketHours").PreMarketContext;
  timestamp: string;
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
