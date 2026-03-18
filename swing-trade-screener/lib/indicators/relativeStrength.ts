import type { OHLCVBar } from "@/types";

/**
 * Relative Strength vs. benchmark (typically SPY)
 *
 * RS = (Stock % Return over N days) / (Benchmark % Return over N days) × 100
 *
 * RS > 100  → stock outperforming benchmark (bullish)
 * RS < 100  → stock underperforming benchmark (bearish)
 * RS = 100  → stock moving in lockstep with benchmark
 */
export function computeRS(
  stockBars: OHLCVBar[],
  benchmarkBars: OHLCVBar[],
  period: number = 63 // ~1 quarter of trading days
): number {
  if (stockBars.length < period + 1 || benchmarkBars.length < period + 1) {
    return 100; // Neutral fallback — not enough data
  }

  const stockNow = stockBars[stockBars.length - 1].close;
  const stockThen = stockBars[stockBars.length - 1 - period].close;
  const benchNow = benchmarkBars[benchmarkBars.length - 1].close;
  const benchThen = benchmarkBars[benchmarkBars.length - 1 - period].close;

  if (!stockThen || !benchThen) return 100;

  const stockReturn = stockNow / stockThen;
  const benchReturn = benchNow / benchThen;

  if (!benchReturn) return 100;

  return (stockReturn / benchReturn) * 100;
}

/**
 * Build a rolling RS line (array of RS values over time).
 * Aligns the two bar arrays by using the shorter length.
 */
export function rsLine(
  stockBars: OHLCVBar[],
  benchmarkBars: OHLCVBar[],
  period: number = 63
): number[] {
  const len = Math.min(stockBars.length, benchmarkBars.length);
  const result: number[] = new Array(period).fill(NaN);

  for (let i = period; i < len; i++) {
    const stockSlice = stockBars.slice(0, i + 1);
    const benchSlice = benchmarkBars.slice(0, i + 1);
    result.push(computeRS(stockSlice, benchSlice, period));
  }

  return result;
}

/**
 * Is RS trending higher? Short-term RS accelerating vs. longer-term RS.
 *
 * A stock where RS63 = 95 but RS20 = 108 is gaining relative momentum —
 * institutions are rotating into it. This is often a leading signal.
 */
export function isRSTrending(
  stockBars: OHLCVBar[],
  benchmarkBars: OHLCVBar[]
): boolean {
  const rs20 = computeRS(stockBars, benchmarkBars, 20);
  const rs63 = computeRS(stockBars, benchmarkBars, 63);
  return rs20 > rs63;
}

/**
 * RS Rank — roughly approximates the IBD-style RS Rating.
 * Weights recent performance more heavily than older performance.
 *
 * Formula: weighted average of 4 quarterly periods, most recent = 2x weight
 * Result: 0–100 (higher = stronger RS)
 *
 * Note: A true IBD RS Rating ranks a stock against all ~8000 US equities.
 * This is a self-contained approximation using the benchmark as proxy.
 * RS > 80 → top quartile, worth pursuing long setups
 * RS < 40 → avoid long setups regardless of technicals
 */
export function rsRating(
  stockBars: OHLCVBar[],
  benchmarkBars: OHLCVBar[]
): number {
  const rs63 = computeRS(stockBars, benchmarkBars, 63);
  const rs126 = computeRS(stockBars, benchmarkBars, 126);
  const rs189 = computeRS(stockBars, benchmarkBars, 189);
  const rs252 = computeRS(stockBars, benchmarkBars, 252);

  // Weight: 40% most recent quarter, 20% each for prior three
  const weightedRS = rs63 * 0.4 + rs126 * 0.2 + rs189 * 0.2 + rs252 * 0.2;

  // Normalize to 0-100 using a sigmoid-like curve
  // RS of 100 = neutral (50), RS of 120 = strong (roughly 80), RS of 80 = weak (roughly 20)
  const normalized = 50 + (weightedRS - 100) * 1.5;
  return Math.max(0, Math.min(100, normalized));
}

/**
 * Checks if a stock is showing "RS new high" — RS line making a new
 * 52-week high while price may still be consolidating.
 * This is one of the highest-conviction early entry signals.
 */
export function isRSNewHigh(
  stockBars: OHLCVBar[],
  benchmarkBars: OHLCVBar[],
  lookback: number = 252
): boolean {
  const len = Math.min(stockBars.length, benchmarkBars.length, lookback + 1);
  if (len < 21) return false;

  const rs = rsLine(stockBars.slice(-len), benchmarkBars.slice(-len), 20);
  const validRS = rs.filter((v) => !isNaN(v));
  if (validRS.length < 5) return false;

  const currentRS = validRS[validRS.length - 1];
  const maxRS = Math.max(...validRS.slice(0, -1));

  return currentRS > maxRS;
}

export interface RSAnalysis {
  rs63: number;        // 1-quarter RS
  rs252: number;       // 1-year RS
  rating: number;      // 0-100 IBD-style rating approximation
  trending: boolean;   // Short-term RS accelerating
  rsNewHigh: boolean;  // RS line at 52-week high
  classification: "Leader" | "Outperformer" | "Neutral" | "Laggard" | "Avoid";
}

export function computeRSAnalysis(
  stockBars: OHLCVBar[],
  benchmarkBars: OHLCVBar[]
): RSAnalysis {
  const rs63 = computeRS(stockBars, benchmarkBars, 63);
  const rs252 = computeRS(stockBars, benchmarkBars, 252);
  const rating = rsRating(stockBars, benchmarkBars);
  const trending = isRSTrending(stockBars, benchmarkBars);
  const rsNewHighVal = isRSNewHigh(stockBars, benchmarkBars);

  let classification: RSAnalysis["classification"];
  if (rating >= 85 && trending) classification = "Leader";
  else if (rating >= 70) classification = "Outperformer";
  else if (rating >= 45) classification = "Neutral";
  else if (rating >= 25) classification = "Laggard";
  else classification = "Avoid";

  return { rs63, rs252, rating, trending, rsNewHigh: rsNewHighVal, classification };
}
