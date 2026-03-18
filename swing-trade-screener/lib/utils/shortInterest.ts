import type { ShortInterestData } from "@/types";

/**
 * Fetch short interest from yahoo-finance2 quoteSummary (summaryDetail).
 * Finnhub /stock/short-interest is available on paid plans.
 */
export async function getShortInterest(ticker: string): Promise<ShortInterestData | undefined> {
  try {
    const yahooFinance = await import("yahoo-finance2").then((m) => m.default);
    const quoteSummary = (yahooFinance as { quoteSummary?: (symbol: string, opts: { modules: string[] }) => Promise<Record<string, unknown>> }).quoteSummary;
    if (!quoteSummary) return undefined;

    const result = await quoteSummary(ticker, { modules: ["summaryDetail"] });
    const summary = result?.summaryDetail as { shortPercentOfFloat?: number; shortRatio?: number } | undefined;
    if (!summary) return undefined;

    const raw = Number(summary.shortPercentOfFloat ?? 0);
    const shortPercentOfFloat = raw <= 1 ? raw * 100 : raw;
    const shortRatio = Number(summary.shortRatio ?? 0);
    if (shortPercentOfFloat <= 0 && shortRatio <= 0) return undefined;

    return {
      shortPercentOfFloat,
      shortRatio,
      isHighShortInterest: shortPercentOfFloat > 10,
      squeezeCandidate: shortPercentOfFloat > 15,
      source: "yahoo",
    };
  } catch {
    return undefined;
  }
}
