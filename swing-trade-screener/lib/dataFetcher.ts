import type { OHLCVBar } from "@/types";
import type { Timeframe } from "@/types";
import { DAILY_BARS, FOUR_HOUR_BARS, FIFTEEN_MIN_BARS } from "@/constants/indicators";
import { generateMockOHLCV } from "@/lib/utils/mockData";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

export async function fetchOHLCV(
  ticker: string,
  timeframe: Timeframe,
  useMock: boolean = false
): Promise<OHLCVBar[]> {
  const barsNeeded =
    timeframe === "1D" ? DAILY_BARS : timeframe === "4H" ? FOUR_HOUR_BARS : FIFTEEN_MIN_BARS;

  if (useMock) return generateMockOHLCV(ticker, timeframe, barsNeeded);

  return fetchYahoo(ticker, timeframe, barsNeeded);
}

async function fetchYahoo(
  ticker: string,
  timeframe: Timeframe,
  barsNeeded: number
): Promise<OHLCVBar[]> {
  try {
    const interval = timeframe === "1D" ? "1d" : timeframe === "4H" ? "1h" : "15m";

    // How many days of history to request
    const lookbackDays =
      timeframe === "1D" ? barsNeeded + 60
      : timeframe === "4H" ? Math.ceil((barsNeeded * 4) / 6.5) + 15
      : Math.ceil((barsNeeded * 0.25) / 6.5) + 5;

    const range = `${lookbackDays}d`;

    const url = `${YAHOO_BASE}/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      next: { revalidate: 300 },
    });

    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error("No chart data returned");

    const timestamps: number[] = result.timestamp ?? [];
    const ohlcv = result.indicators?.quote?.[0];
    if (!ohlcv || timestamps.length === 0) throw new Error("No OHLCV data in response");

    let bars: OHLCVBar[] = timestamps
      .map((ts: number, i: number) => ({
        date: new Date(ts * 1000).toISOString(),
        open: ohlcv.open?.[i] ?? 0,
        high: ohlcv.high?.[i] ?? 0,
        low: ohlcv.low?.[i] ?? 0,
        close: ohlcv.close?.[i] ?? 0,
        volume: ohlcv.volume?.[i] ?? 0,
      }))
      .filter((b) => b.open && b.close);

    if (timeframe === "4H") bars = aggregateTo4H(bars);

    return bars.slice(-barsNeeded);
  } catch (err) {
    console.error(`[dataFetcher] Yahoo failed for ${ticker} (${timeframe}):`, err);
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
