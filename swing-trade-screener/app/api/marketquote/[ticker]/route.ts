import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);

    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error("No data returned from Yahoo");

    // Yahoo meta fields:
    // regularMarketPrice - current/last regular session price
    // postMarketPrice    - after hours price (if available)
    // preMarketPrice     - pre-market price (if available)
    // chartPreviousClose - previous close
    const regularPrice: number = meta.regularMarketPrice ?? 0;
    const extPrice: number | null = meta.postMarketPrice ?? meta.preMarketPrice ?? null;
    const prevClose: number = meta.chartPreviousClose ?? meta.previousClose ?? regularPrice;

    const displayPrice = extPrice ?? regularPrice;
    const change = displayPrice - prevClose;
    const changePercent = prevClose ? (change / prevClose) * 100 : 0;

    return Response.json(
      {
        ticker,
        price: displayPrice,
        change,
        changePercent,
        prevClose,
        isExtendedHours: extPrice != null,
      },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
