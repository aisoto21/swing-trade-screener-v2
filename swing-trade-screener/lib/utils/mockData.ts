import type { OHLCVBar } from "@/types";
import type { Timeframe } from "@/types";

/**
 * Generate realistic mock OHLCV data for offline development and testing
 */
export function generateMockOHLCV(
  ticker: string,
  timeframe: Timeframe,
  bars: number,
  basePrice: number = 100,
  trend: "up" | "down" | "sideways" = "up"
): OHLCVBar[] {
  const result: OHLCVBar[] = [];
  let price = basePrice;
  const now = new Date();
  const msPerBar =
    timeframe === "1D"
      ? 24 * 60 * 60 * 1000
      : timeframe === "4H"
      ? 4 * 60 * 60 * 1000
      : 15 * 60 * 1000;

  for (let i = bars - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * msPerBar);
    const volatility = 0.02;
    const drift =
      trend === "up" ? 0.001 : trend === "down" ? -0.001 : 0;
    const change = (Math.random() - 0.5) * 2 * volatility + drift;
    price = price * (1 + change);
    const open = price;
    const high = price * (1 + Math.random() * volatility * 0.5);
    const low = price * (1 - Math.random() * volatility * 0.5);
    const close = low + (high - low) * Math.random();
    const volume = Math.floor(1_000_000 + Math.random() * 2_000_000);

    result.push({
      date: date.toISOString(),
      open,
      high: Math.max(high, open, close),
      low: Math.min(low, open, close),
      close,
      volume,
    });
    price = close;
  }

  return result;
}

/**
 * Generate mock screener-style data for a ticker
 */
export function generateMockScreenerData(ticker: string) {
  const basePrice = 50 + Math.random() * 150;
  const daily = generateMockOHLCV(ticker, "1D", 200, basePrice, "up");
  const fourHour = generateMockOHLCV(ticker, "4H", 100, basePrice, "up");
  const fifteenMin = generateMockOHLCV(ticker, "15M", 96, basePrice, "up");

  return {
    daily,
    fourHour,
    fifteenMin,
    price: daily[daily.length - 1]?.close ?? basePrice,
    priceChangePercent: (Math.random() - 0.5) * 4,
    marketCap: 1e9 + Math.random() * 500e9,
    avgVolume: daily.slice(-20).reduce((s, b) => s + b.volume, 0) / 20,
  };
}
