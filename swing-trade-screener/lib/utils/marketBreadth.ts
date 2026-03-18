import type { OHLCVBar } from "@/types";

/** Per-ticker aggregate for breadth (avoids streaming full daily bars) */
export interface BreadthDataPoint {
  ticker: string;
  above50: boolean;
  above200: boolean;
  newHigh: boolean;
  newLow: boolean;
}

export interface MarketBreadth {
  percentAbove50SMA: number;
  percentAbove200SMA: number;
  newHighsCount: number;
  newLowsCount: number;
  newHighNewLowRatio: number;
  breadthClassification: "Healthy" | "Deteriorating" | "Weak" | "Oversold";
  breadthNote: string;
}

/**
 * Compute market breadth from ticker results.
 * Each result should have daily bars - we count % above 50/200 SMA and 52w highs/lows.
 */
export function computeMarketBreadth(
  tickerData: Array<{
    ticker: string;
    daily: OHLCVBar[];
  }>
): MarketBreadth {
  if (tickerData.length === 0) {
    return {
      percentAbove50SMA: 50,
      percentAbove200SMA: 50,
      newHighsCount: 0,
      newLowsCount: 0,
      newHighNewLowRatio: 1,
      breadthClassification: "Healthy",
      breadthNote: "Insufficient data",
    };
  }

  let above50 = 0;
  let above200 = 0;
  let newHighs = 0;
  let newLows = 0;

  for (const { daily } of tickerData) {
    if (daily.length < 200) continue;
    const close = daily[daily.length - 1]?.close ?? 0;
    const high52 = Math.max(...daily.slice(-252).map((b) => b.high));
    const low52 = Math.min(...daily.slice(-252).map((b) => b.low));
    const sma50 =
      daily.slice(-50).reduce((s, b) => s + b.close, 0) / 50;
    const sma200 =
      daily.slice(-200).reduce((s, b) => s + b.close, 0) / 200;

    if (close > sma50) above50++;
    if (close > sma200) above200++;
    if (close >= high52 * 0.99) newHighs++;
    if (close <= low52 * 1.01) newLows++;
  }

  const n = tickerData.filter((t) => t.daily.length >= 200).length;
  const percentAbove50SMA = n > 0 ? (above50 / n) * 100 : 50;
  const percentAbove200SMA = n > 0 ? (above200 / n) * 100 : 50;
  const newHighNewLowRatio =
    newLows > 0 ? newHighs / newLows : newHighs;

  let breadthClassification: MarketBreadth["breadthClassification"] = "Healthy";
  let breadthNote = "";

  if (percentAbove50SMA >= 70) {
    breadthClassification = "Healthy";
    breadthNote = "Broad participation — favorable for longs";
  } else if (percentAbove50SMA >= 50) {
    breadthClassification = "Deteriorating";
    breadthNote = "Moderate breadth — selective longs";
  } else if (percentAbove50SMA >= 40) {
    breadthClassification = "Weak";
    breadthNote = "Narrow breadth — caution on new longs";
  } else {
    breadthClassification = "Oversold";
    breadthNote = "Oversold breadth — potential bounce or continuation down";
  }

  return {
    percentAbove50SMA,
    percentAbove200SMA,
    newHighsCount: newHighs,
    newLowsCount: newLows,
    newHighNewLowRatio,
    breadthClassification,
    breadthNote,
  };
}

/**
 * Compute a single ticker's breadth contribution (for aggregation without streaming full bars)
 */
export function computeBreadthDataPoint(
  ticker: string,
  daily: OHLCVBar[]
): BreadthDataPoint | null {
  if (daily.length < 200) return null;
  const close = daily[daily.length - 1]?.close ?? 0;
  const high52 = Math.max(...daily.slice(-252).map((b) => b.high));
  const low52 = Math.min(...daily.slice(-252).map((b) => b.low));
  const sma50 = daily.slice(-50).reduce((s, b) => s + b.close, 0) / 50;
  const sma200 = daily.slice(-200).reduce((s, b) => s + b.close, 0) / 200;
  return {
    ticker,
    above50: close > sma50,
    above200: close > sma200,
    newHigh: close >= high52 * 0.99,
    newLow: close <= low52 * 1.01,
  };
}

/**
 * Compute market breadth from pre-aggregated per-ticker data
 */
export function computeMarketBreadthFromAggregates(
  aggregates: BreadthDataPoint[]
): MarketBreadth {
  if (aggregates.length === 0) {
    return {
      percentAbove50SMA: 50,
      percentAbove200SMA: 50,
      newHighsCount: 0,
      newLowsCount: 0,
      newHighNewLowRatio: 1,
      breadthClassification: "Healthy",
      breadthNote: "Insufficient data",
    };
  }
  const n = aggregates.length;
  const above50 = aggregates.filter((a) => a.above50).length;
  const above200 = aggregates.filter((a) => a.above200).length;
  const newHighs = aggregates.filter((a) => a.newHigh).length;
  const newLows = aggregates.filter((a) => a.newLow).length;
  const percentAbove50SMA = (above50 / n) * 100;
  const percentAbove200SMA = (above200 / n) * 100;
  const newHighNewLowRatio = newLows > 0 ? newHighs / newLows : newHighs;

  let breadthClassification: MarketBreadth["breadthClassification"] = "Healthy";
  let breadthNote = "";
  if (percentAbove50SMA >= 70) {
    breadthClassification = "Healthy";
    breadthNote = "Broad participation — favorable for longs";
  } else if (percentAbove50SMA >= 50) {
    breadthClassification = "Deteriorating";
    breadthNote = "Moderate breadth — selective longs";
  } else if (percentAbove50SMA >= 40) {
    breadthClassification = "Weak";
    breadthNote = "Narrow breadth — caution on new longs";
  } else {
    breadthClassification = "Oversold";
    breadthNote = "Oversold breadth — potential bounce or continuation down";
  }

  return {
    percentAbove50SMA,
    percentAbove200SMA,
    newHighsCount: newHighs,
    newLowsCount: newLows,
    newHighNewLowRatio,
    breadthClassification,
    breadthNote,
  };
}
