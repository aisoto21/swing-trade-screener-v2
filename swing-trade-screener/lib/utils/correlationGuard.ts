import type { OHLCVBar } from "@/types";
import type { TradeEntry } from "@/lib/stores/tradeLogStore";

export interface CorrelationWarning {
  ticker1: string;
  ticker2: string;
  correlation: number;
  sharedSector: boolean;
  warningLevel: "HIGH" | "MODERATE";
}

/**
 * Pearson correlation using daily closing price returns.
 * Returns value between -1 and 1.
 */
export function computePairCorrelation(
  barsA: OHLCVBar[],
  barsB: OHLCVBar[],
  period: number = 60
): number {
  const minLen = Math.min(barsA.length, barsB.length, period);
  if (minLen < 2) return 0;

  const closesA = barsA.slice(-minLen).map((b) => b.close);
  const closesB = barsB.slice(-minLen).map((b) => b.close);

  const returnsA: number[] = [];
  const returnsB: number[] = [];
  for (let i = 1; i < minLen; i++) {
    const rA = closesA[i - 1] !== 0 ? (closesA[i] - closesA[i - 1]) / closesA[i - 1] : 0;
    const rB = closesB[i - 1] !== 0 ? (closesB[i] - closesB[i - 1]) / closesB[i - 1] : 0;
    returnsA.push(rA);
    returnsB.push(rB);
  }

  const n = returnsA.length;
  const meanA = returnsA.reduce((s, r) => s + r, 0) / n;
  const meanB = returnsB.reduce((s, r) => s + r, 0) / n;

  let sumProduct = 0;
  let sumSqA = 0;
  let sumSqB = 0;
  for (let i = 0; i < n; i++) {
    const da = returnsA[i] - meanA;
    const db = returnsB[i] - meanB;
    sumProduct += da * db;
    sumSqA += da * da;
    sumSqB += db * db;
  }

  const denom = Math.sqrt(sumSqA * sumSqB);
  if (denom === 0) return 0;
  return Math.max(-1, Math.min(1, sumProduct / denom));
}

/**
 * Check portfolio for correlated long positions.
 * HIGH: correlation > 0.8 AND both positions > 2% of portfolio
 * MODERATE: correlation > 0.7 AND both positions > 1.5% of portfolio
 */
export function checkPortfolioCorrelation(
  openTrades: TradeEntry[],
  priceHistory: Record<string, OHLCVBar[]>,
  accountSize: number
): CorrelationWarning[] {
  const longs = openTrades.filter((t) => t.bias === "LONG");
  if (longs.length < 2 || accountSize <= 0) return [];

  const warnings: CorrelationWarning[] = [];

  for (let i = 0; i < longs.length; i++) {
    for (let j = i + 1; j < longs.length; j++) {
      const t1 = longs[i];
      const t2 = longs[j];
      const barsA = priceHistory[t1.ticker];
      const barsB = priceHistory[t2.ticker];
      if (!barsA || !barsB || barsA.length < 60 || barsB.length < 60) continue;

      const correlation = computePairCorrelation(barsA, barsB, 60);
      const exposure1 = (t1.entryPrice * t1.shares) / accountSize;
      const exposure2 = (t2.entryPrice * t2.shares) / accountSize;

      const sharedSector = (t1.sector ?? t1.ticker) === (t2.sector ?? t2.ticker);

      if (correlation > 0.8 && exposure1 > 0.02 && exposure2 > 0.02) {
        warnings.push({
          ticker1: t1.ticker,
          ticker2: t2.ticker,
          correlation,
          sharedSector,
          warningLevel: "HIGH",
        });
      } else if (correlation > 0.7 && exposure1 > 0.015 && exposure2 > 0.015) {
        warnings.push({
          ticker1: t1.ticker,
          ticker2: t2.ticker,
          correlation,
          sharedSector,
          warningLevel: "MODERATE",
        });
      }
    }
  }

  return warnings.sort((a, b) => {
    if (a.warningLevel === "HIGH" && b.warningLevel !== "HIGH") return -1;
    if (a.warningLevel !== "HIGH" && b.warningLevel === "HIGH") return 1;
    return b.correlation - a.correlation;
  });
}
