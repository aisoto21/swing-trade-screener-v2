/**
 * IV Rank, IV Percentile, Trend, IV vs HV
 */

import type { IVAnalysis } from "@/types";
import { getIVHistory } from "@/lib/utils/ivHistory";

export async function computeIVRank(ticker: string, currentIV: number): Promise<number> {
  const history = await getIVHistory(ticker);
  if (history.length < 2) return 0;

  const low = Math.min(...history);
  const high = Math.max(...history);
  if (high === low) return 50;

  return Math.max(0, Math.min(100, ((currentIV - low) / (high - low)) * 100));
}

export async function computeIVPercentile(ticker: string, currentIV: number): Promise<number> {
  const history = await getIVHistory(ticker);
  if (history.length < 2) return 0;

  const below = history.filter((v) => v < currentIV).length;
  return (below / history.length) * 100;
}

export async function getIVTrend(ticker: string, currentIV: number): Promise<"expanding" | "contracting" | "stable"> {
  const history = await getIVHistory(ticker);
  if (history.length < 20) return "stable";

  const recent5 = history.slice(-5);
  const recent20 = history.slice(-20);
  const avg5 = recent5.reduce((a, b) => a + b, 0) / recent5.length;
  const avg20 = recent20.reduce((a, b) => a + b, 0) / recent20.length;

  const diff5 = (currentIV - avg5) / (avg5 || 0.01);
  const diff20 = (currentIV - avg20) / (avg20 || 0.01);

  if (diff5 > 0.1 && diff20 > 0.05) return "expanding";
  if (diff5 < -0.1 && diff20 < -0.05) return "contracting";
  return "stable";
}

export function compareIVtoHV(
  currentIV: number,
  historicalVol30d: number
): "rich" | "fair" | "cheap" {
  if (historicalVol30d <= 0) return "fair";

  const ratio = currentIV / historicalVol30d;
  if (ratio > 1.2) return "rich";
  if (ratio < 0.8) return "cheap";
  return "fair";
}

export async function computeIVAnalysis(
  ticker: string,
  currentIV: number,
  historicalVol30d?: number
): Promise<IVAnalysis> {
  const [ivRank, ivPercentile, ivTrend] = await Promise.all([
    computeIVRank(ticker, currentIV),
    computeIVPercentile(ticker, currentIV),
    getIVTrend(ticker, currentIV),
  ]);

  const history = await getIVHistory(ticker);
  const ivVsHV = historicalVol30d
    ? compareIVtoHV(currentIV, historicalVol30d)
    : "fair";

  return {
    currentIV,
    ivRank,
    ivPercentile,
    ivTrend,
    ivVsHV,
    historicalDaysAvailable: history.length,
  };
}
