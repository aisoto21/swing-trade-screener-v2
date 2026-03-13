import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  try {
    // v7/finance/quote returns real-time + extended hours fields reliably
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,postMarketPrice,postMarketChange,postMarketChangePercent,preMarketPrice,preMarketChange,preMarketChangePercent`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);

    const data = await res.json();
    const q = data?.quoteResponse?.result?.[0];
    if (!q) throw new Error("No quote data returned");

    const regularPrice: number = q.regularMarketPrice ?? 0;
    const extPrice: number | null = q.postMarketPrice ?? q.preMarketPrice ?? null;
    const extChange: number | null = q.postMarketChange ?? q.preMarketChange ?? null;
    const extChangePct: number | null = q.postMarketChangePercent ?? q.preMarketChangePercent ?? null;
    const prevClose: number = q.regularMarketPreviousClose ?? regularPrice;

    const displayPrice = extPrice ?? regularPrice;
    const displayChange = extChange ?? q.regularMarketChange ?? 0;
    const displayChangePct = extChangePct ?? q.regularMarketChangePercent ?? 0;

    return Response.json(
      {
        ticker,
        price: displayPrice,
        change: displayChange,
        changePercent: displayChangePct,
        prevClose,
        isExtendedHours: extPrice != null,
      },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
