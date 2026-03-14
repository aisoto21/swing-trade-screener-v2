import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  try {
    // 1m interval with includePrePost=true captures the most recent
    // price including pre/after-hours trading
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d&includePrePost=true`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error("No data returned");

    const meta = result.meta;
    const prevClose: number = meta?.chartPreviousClose ?? meta?.regularMarketPrice ?? 0;

    // Most recent price from 1m candles (includes pre/post market)
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const currentPrice = [...closes].reverse().find((p) => p != null) ?? meta?.regularMarketPrice ?? 0;

    const change = currentPrice - prevClose;
    const changePercent = prevClose ? (change / prevClose) * 100 : 0;

    // Detect extended hours by comparing to regular market close time
    const regularClose = result.meta?.currentTradingPeriod?.regular?.end ?? 0;
    const timestamps: number[] = result.timestamp ?? [];
    const lastTimestamp = timestamps[timestamps.length - 1] ?? 0;
    const isExtendedHours = lastTimestamp > regularClose;

    return Response.json(
      {
        ticker,
        price: Number(currentPrice.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(4)),
        prevClose,
        isExtendedHours,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
