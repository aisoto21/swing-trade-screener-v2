import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d&includePrePost=true`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);

    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error("No meta data returned");

    // Use currentTradingPeriod to detect extended hours
    const tradingPeriods = data?.chart?.result?.[0]?.meta?.currentTradingPeriod;
    const now = Math.floor(Date.now() / 1000);
    const postStart = tradingPeriods?.post?.start ?? 0;
    const postEnd = tradingPeriods?.post?.end ?? 0;
    const preStart = tradingPeriods?.pre?.start ?? 0;
    const preEnd = tradingPeriods?.pre?.end ?? 0;

    const isPostMarket = now >= postStart && now <= postEnd;
    const isPreMarket = now >= preStart && now <= preEnd;
    const isExtendedHours = isPostMarket || isPreMarket;

    const regularPrice: number = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0;
    const extPrice: number | null =
      meta.postMarketPrice ?? meta.preMarketPrice ?? null;

    // Fall back to last quote in the 1m data as the most current price
    const quotes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const lastQuote = [...quotes].reverse().find((p: number | null) => p != null) ?? null;

    const displayPrice = isExtendedHours && extPrice ? extPrice : (lastQuote ?? regularPrice);
    const prevClose: number = meta.chartPreviousClose ?? meta.regularMarketPrice ?? 0;
    const change = displayPrice - prevClose;
    const changePercent = prevClose ? (change / prevClose) * 100 : 0;

    return Response.json(
      {
        ticker,
        price: displayPrice,
        change,
        changePercent,
        prevClose,
        isExtendedHours,
        // debug fields - remove later
        _meta_postMarketPrice: meta.postMarketPrice,
        _meta_preMarketPrice: meta.preMarketPrice,
        _meta_regularMarketPrice: meta.regularMarketPrice,
        _lastQuote: lastQuote,
        _isPostMarket: isPostMarket,
        _isPreMarket: isPreMarket,
        _postWindow: `${new Date(postStart * 1000).toLocaleTimeString()} - ${new Date(postEnd * 1000).toLocaleTimeString()}`,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
