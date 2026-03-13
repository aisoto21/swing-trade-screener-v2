import type { OHLCVBar } from "@/types";
import type { Timeframe } from "@/types";
import { DAILY_BARS, FOUR_HOUR_BARS, FIFTEEN_MIN_BARS } from "@/constants/indicators";
import { generateMockOHLCV } from "@/lib/utils/mockData";

/**
 * Fetch OHLCV via Yahoo Finance (yahoo-finance2).
 * Completely free, no API key required.
 * Falls back to mock data only if the fetch fails.
 */
export async function fetchOHLCV(
  ticker: string,
  timeframe: Timeframe,
  useMock: boolean = false
): Promise<OHLCVBar[]> {
  const barsNeeded =
    timeframe === "1D"
      ? DAILY_BARS
      : timeframe === "4H"
      ? FOUR_HOUR_BARS
      : FIFTEEN_MIN_BARS;

  if (useMock) {
    return generateMockOHLCV(ticker, timeframe, barsNeeded);
  }

  return fetchYahooFinance(ticker, timeframe, barsNeeded);
}

// ─── Yahoo Finance ────────────────────────────────────────────────────────────

async function fetchYahooFinance(
  ticker: string,
  timeframe: Timeframe,
  barsNeeded: number
): Promise<OHLCVBar[]> {
  try {
    // Dynamic import so it only runs server-side
    const yf = await import("yahoo-finance2");
    const yahooFinance = yf.default ?? yf;

    // Map our timeframe to Yahoo interval + how far back to look
    const interval =
      timeframe === "1D" ? "1d" : timeframe === "4H" ? "1h" : "15m";

    // How many days of history to request
    const lookbackDays =
      timeframe === "1D"
        ? barsNeeded + 50           // extra buffer for weekends/holidays
        : timeframe === "4H"
        ? Math.ceil((barsNeeded * 4) / 6.5) + 10  // ~6.5 trading hours/day
        : Math.ceil((barsNeeded * 0.25) / 6.5) + 5;

    const period1 = new Date();
    period1.setDate(period1.getDate() - lookbackDays);

    const result = await yahooFinance.chart(ticker, {
      period1,
      interval: interval as "1d" | "1h" | "15m",
    });

    if (!result?.quotes || result.quotes.length === 0) {
      throw new Error(`Yahoo Finance returned no data for ${ticker}`);
    }

    let bars: OHLCVBar[] = result.quotes
      .filter(
        (q) =>
          q.open != null &&
          q.high != null &&
          q.low != null &&
          q.close != null
      )
      .map((q) => ({
        date: new Date(q.date).toISOString(),
        open: q.open as number,
        high: q.high as number,
        low: q.low as number,
        close: q.close as number,
        volume: q.volume ?? 0,
      }));

    // For 4H: Yahoo only provides 1H candles — aggregate to 4H
    if (timeframe === "4H") {
      bars = aggregateTo4H(bars);
    }

    return bars.slice(-barsNeeded);
  } catch (err) {
    console.error(`[dataFetcher] Yahoo Finance failed for ${ticker} (${timeframe}):`, err);
    return generateMockOHLCV(ticker, timeframe, barsNeeded);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function aggregateTo4H(bars: OHLCVBar[]): OHLCVBar[] {
  const result: OHLCVBar[] = [];
  for (let i = 0; i < bars.length; i += 4) {
    const chunk = bars.slice(i, i + 4);
    if (!chunk.length) break;
    result.push({
      date: chunk[0].date,
      open: chunk[0].open,
      high: Math.max(...chunk.map((b) => b.high)),
      low: Math.min(...chunk.map((b) => b.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((s, b) => s + b.volume, 0),
    });
  }
  return result;
}
