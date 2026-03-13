import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  try {
    const yahooFinance = (await import("yahoo-finance2")).default;
    yahooFinance.suppressNotices(["yahooSurvey"]);

    const quote = await yahooFinance.quote(ticker);

    return Response.json(
      {
        ticker,
        price: quote.regularMarketPrice ?? 0,
        change: quote.regularMarketChange ?? 0,
        changePercent: quote.regularMarketChangePercent ?? 0,
        prevClose: quote.regularMarketPreviousClose ?? 0,
      },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
