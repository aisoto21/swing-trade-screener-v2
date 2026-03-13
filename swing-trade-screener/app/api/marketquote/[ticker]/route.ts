import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  try {
    const yahooFinance = (await import("yahoo-finance2")).default;
    yahooFinance.suppressNotices(["yahooSurvey"]);

    const q = await yahooFinance.quote(ticker);

    // Yahoo returns post/pre-market price in these fields
    const extPrice = q.postMarketPrice ?? q.preMarketPrice ?? null;
    const extChange = q.postMarketChangePercent ?? q.preMarketChangePercent ?? null;
    const regularPrice = q.regularMarketPrice ?? 0;

    const displayPrice = extPrice ?? regularPrice;
    const displayChangePercent = extChange ?? q.regularMarketChangePercent ?? 0;
    const displayChange = q.postMarketChange ?? q.preMarketChange ?? q.regularMarketChange ?? 0;

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
