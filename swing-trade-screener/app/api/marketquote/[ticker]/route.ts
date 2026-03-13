import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  try {
    const yf = await import("yahoo-finance2");
    const yahooFinance = yf.default ?? yf;

    const q = await yahooFinance.quote(ticker);

    const extPrice = q.postMarketPrice ?? q.preMarketPrice ?? null;
    const extChange = q.postMarketChangePercent ?? q.preMarketChangePercent ?? null;
    const extAbsChange = q.postMarketChange ?? q.preMarketChange ?? null;
    const regularPrice = q.regularMarketPrice ?? 0;

    const displayPrice = extPrice ?? regularPrice;
    const displayChangePercent = extChange ?? q.regularMarketChangePercent ?? 0;
    const displayChange = extAbsChange ?? q.regularMarketChange ?? 0;

    return Response.json(
      {
        ticker,
        price: displayPrice,
        change: displayChange,
        changePercent: displayChangePercent,
        prevClose: q.regularMarketPreviousClose ?? 0,
        isExtendedHours: extPrice != null,
      },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
