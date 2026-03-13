import type { OHLCVBar } from "@/types";
import type { Timeframe } from "@/types";
import { DAILY_BARS, FOUR_HOUR_BARS, FIFTEEN_MIN_BARS } from "@/constants/indicators";
import { generateMockOHLCV } from "@/lib/utils/mockData";

/**
 * Fetch OHLCV data from Yahoo Finance (yahoo-finance2)
 * Falls back to mock data when API fails or for intraday when unavailable
 */
export async function fetchOHLCV(
  ticker: string,
  timeframe: Timeframe,
  useMock: boolean = false
): Promise<OHLCVBar[]> {
  if (useMock) {
    const bars = timeframe === "1D" ? DAILY_BARS : timeframe === "4H" ? FOUR_HOUR_BARS : FIFTEEN_MIN_BARS;
    return generateMockOHLCV(ticker, timeframe, bars);
  }

  const barsNeeded = timeframe === "1D" ? DAILY_BARS : timeframe === "4H" ? FOUR_HOUR_BARS : FIFTEEN_MIN_BARS;

  try {
    const yahooFinance = await import("yahoo-finance2").then((m) => m.default);
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 1);

    if (timeframe === "1D") {
      const result = await yahooFinance.historical(ticker, {
        period1: period1.toISOString().slice(0, 10),
        period2: new Date().toISOString().slice(0, 10),
      });
      if (!result || result.length === 0) throw new Error("No data");
      const mapped: OHLCVBar[] = result.slice(-barsNeeded).map((d: { date: Date; open: number; high: number; low: number; close: number; volume?: number }) => ({
        date: new Date(d.date).toISOString(),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume ?? 0,
      }));
      return mapped;
    }

    const interval = timeframe === "4H" ? "1h" : "15m";
    const chart = await (yahooFinance as { chart?: (symbol: string, opts: { interval: string; period1: string; period2: string }) => Promise<{ quotes?: Array<{ date: number; open: number; high: number; low: number; close: number; volume?: number }> }> }).chart?.(
      ticker,
      {
        interval,
        period1: period1.toISOString().slice(0, 10),
        period2: new Date().toISOString().slice(0, 10),
      }
    );

    if (chart?.quotes && chart.quotes.length > 0) {
      let mapped: OHLCVBar[] = chart.quotes.map((q) => ({
        date: new Date(q.date * 1000).toISOString(),
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume ?? 0,
      }));

      if (timeframe === "4H" && interval === "1h") {
        mapped = aggregateTo4H(mapped);
      }
      return mapped.slice(-barsNeeded);
    }
  } catch {
    // Fall through to mock
  }

  return generateMockOHLCV(ticker, timeframe, barsNeeded);
}

function aggregateTo4H(bars: OHLCVBar[]): OHLCVBar[] {
  const result: OHLCVBar[] = [];
  for (let i = 0; i < bars.length; i += 4) {
    const chunk = bars.slice(i, i + 4);
    if (chunk.length === 0) break;
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
