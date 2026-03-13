import type { OHLCVBar } from "@/types";
import type { Timeframe } from "@/types";
import { DAILY_BARS, FOUR_HOUR_BARS, FIFTEEN_MIN_BARS } from "@/constants/indicators";
import { generateMockOHLCV } from "@/lib/utils/mockData";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? "";
const FINNHUB_BASE = "https://finnhub.io/api/v1";

function toFinnhubResolution(timeframe: Timeframe): string {
  if (timeframe === "1D") return "D";
  if (timeframe === "4H") return "60"; // fetch 1H, aggregate to 4H
  return "15"; // 15M
}

/**
 * Fetch OHLCV data from Finnhub.
 * Falls back to mock data only when API key is missing or call fails.
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

  if (useMock || !FINNHUB_API_KEY) {
    return generateMockOHLCV(ticker, timeframe, barsNeeded);
  }

  try {
    const resolution = toFinnhubResolution(timeframe);
    const toTs = Math.floor(Date.now() / 1000);
    const lookbackDays =
      timeframe === "1D" ? 400 : timeframe === "4H" ? 120 : 30;
    const fromTs = toTs - lookbackDays * 24 * 60 * 60;

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
    console.error(
      `[dataFetcher] Finnhub failed for ${ticker} (${timeframe}):`,
      err
    );
    return generateMockOHLCV(ticker, timeframe, barsNeeded);
  }
}

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