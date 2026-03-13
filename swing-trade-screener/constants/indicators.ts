/**
 * Indicator thresholds and parameters - no magic numbers in code
 */

// RSI
export const RSI_PERIOD = 14;
export const RSI_OVERBOUGHT = 70;
export const RSI_OVERSOLD = 30;

// MACD
export const MACD_FAST = 12;
export const MACD_SLOW = 26;
export const MACD_SIGNAL = 9;

// Moving Averages
export const SMA_50_PERIOD = 50;
export const SMA_200_PERIOD = 200;
export const EMA_9_PERIOD = 9;
export const EMA_20_PERIOD = 20;

// Bollinger Bands
export const BOLLINGER_PERIOD = 20;
export const BOLLINGER_STD = 2;
export const BOLLINGER_SQUEEZE_THRESHOLD = 0.15; // 15% of 52-week band width avg

// Volume
export const VOLUME_AVG_PERIOD = 20;
export const VOLUME_INSTITUTIONAL = 1.5; // 1.5x avg = institutional confirmation
export const VOLUME_CLIMACTIC = 2.5; // 2.5x avg = climactic/exhaustion
export const VOLUME_TREND_BARS = 5;

// Support/Resistance
export const SR_PIVOT_LOOKBACK = 50;
export const SR_MIN_TOUCHES = 2;

// Fibonacci
export const FIB_NEAR_THRESHOLD = 0.01; // 1% within level

// Risk/Reward
export const MIN_RR_RATIO = 1.5;

// Position Sizing
export const DEFAULT_ACCOUNT_SIZE = 25000;
export const DEFAULT_RISK_PER_TRADE = 0.01;
export const CONCENTRATION_WARNING_THRESHOLD = 0.05; // 5% of portfolio

// Pre-filters
export const MIN_PRICE = 10;
export const MIN_AVG_VOLUME = 500000;
export const MIN_MARKET_CAP = 300_000_000;

// Data bars per timeframe
export const DAILY_BARS = 200;
export const FOUR_HOUR_BARS = 100;
export const FIFTEEN_MIN_BARS = 96;
