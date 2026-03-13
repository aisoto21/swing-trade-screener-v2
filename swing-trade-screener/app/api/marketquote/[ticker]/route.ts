import { NextRequest } from "next/server";
import yahooFinance from "yahoo-finance2";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  try {
    const q = await yahooFinance.quote(ticker);

    const extPrice = q.postMarketPrice ?? q.preMarketPrice ?? null;
    const extChange = q.postMarketChangePercent ?? q.preMarketChangePercent ?? null;
    const extAbsChange = q.postMarketChange ?? q.preMarketChange ?? null;
    const regularPrice = q.regularMarketPrice ?? 0;

    return Response.json(
      {
        ticker,
        price: extPrice ?? regularPrice,
        change: extAbsChange ?? q.regularMarketChange ?? 0,
        changePercent: extChange ?? q.regularMarketChangePercent ?? 0,
        prevClose: q.regularMarketPreviousClose ?? 0,
        isExtendedHours: extPrice != null,
      },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
