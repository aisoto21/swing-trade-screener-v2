import type { OHLCVBar } from "@/types";
import type { Timeframe } from "@/types";
import { DAILY_BARS, FOUR_HOUR_BARS, FIFTEEN_MIN_BARS } from "@/constants/indicators";
import { generateMockOHLCV } from "@/lib/utils/mockData";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? "";
const FINNHUB_BASE = "https://finnhub.io/api/v1";

const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY ?? "";
const TWELVE_DATA_BASE = "https://api.twelvedata.com";

/**
 * Fetch OHLCV via Finnhub (1D and 4H) or Twelve Data (15M).
 * Falls back to mock data only when the relevant API key is missing or the call fails.
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

  if (timeframe === "15M") {
    return fetchTwelveData15M(ticker, barsNeeded);
  }

  return fetchFinnhub(ticker, timeframe, barsNeeded);
}

// ─── Finnhub: 1D and 4H ──────────────────────────────────────────────────────

async function fetchFinnhub(
  ticker: string,
  timeframe: Timeframe,
  barsNeeded: number
): Promise<OHLCVBar[]> {
  if (!FINNHUB_API_KEY) {
    return generateMockOHLCV(ticker, timeframe, barsNeeded);
  }

  try {
    // 4H: fetch 1H candles and aggregate; 1D: fetch daily candles
    const resolution = timeframe === "1D" ? "D" : "60";
    const toTs = Math.floor(Date.now() / 1000);
    const lookback = timeframe === "1D" ? 400 : 60; // days
    const fromTs = toTs - lookback * 24 * 60 * 60;

    const url = `${FINNHUB_BASE}/stock/candle?symbol=${ticker}&resolution=${resolution}&from=${fromTs}&to=${toTs}&token=${FINNHUB_API_KEY}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);

    const data = await res.json();
    if (data.s !== "ok" || !data.t || data.t.length === 0) {
      throw new Error(`Finnhub no data: ${data.s}`);
    }

    let mapped: OHLCVBar[] = data.t.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString(),
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i],
      volume: data.v[i] ?? 0,
    }));

    if (timeframe === "4H") {
      mapped = aggregateTo4H(mapped);
    }

    return mapped.slice(-barsNeeded);
  } catch (err) {
    console.error(`[dataFetcher] Finnhub failed for ${ticker} (${timeframe}):`, err);
    return generateMockOHLCV(ticker, timeframe, barsNeeded);
  }
}

// ─── Twelve Data: 15M ────────────────────────────────────────────────────────

async function fetchTwelveData15M(
  ticker: string,
  barsNeeded: number
): Promise<OHLCVBar[]> {
  if (!TWELVE_DATA_API_KEY) {
    return generateMockOHLCV(ticker, "15M", barsNeeded);
  }

  try {
    // Free tier returns up to 5000 bars per call; 14 days of 15M = ~390 bars
    const url = `${TWELVE_DATA_BASE}/time_series?symbol=${ticker}&interval=15min&outputsize=${barsNeeded}&apikey=${TWELVE_DATA_API_KEY}&format=JSON`;
    const res = await fetch(url);

    if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);

    const data = await res.json();

    if (data.status === "error") {
      throw new Error(`Twelve Data error: ${data.message}`);
    }

    if (!data.values || data.values.length === 0) {
      throw new Error("Twelve Data returned no values");
    }

    // Twelve Data returns newest-first; reverse to oldest-first
    const mapped: OHLCVBar[] = data.values
      .reverse()
      .map((bar: { datetime: string; open: string; high: string; low: string; close: string; volume: string }) => ({
        date: new Date(bar.datetime).toISOString(),
        open: parseFloat(bar.open),
        high: parseFloat(bar.high),
        low: parseFloat(bar.low),
        close: parseFloat(bar.close),
        volume: parseFloat(bar.volume) || 0,
      }));

    return mapped.slice(-barsNeeded);
  } catch (err) {
    console.error(`[dataFetcher] Twelve Data failed for ${ticker} (15M):`, err);
    return generateMockOHLCV(ticker, "15M", barsNeeded);
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