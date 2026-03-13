import { NextRequest } from "next/server";
import * as yahooFinanceModule from "yahoo-finance2";

// Handle both CJS default export and ESM named exports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf: any =
  (yahooFinanceModule as any).default?.default ??
  (yahooFinanceModule as any).default ??
  yahooFinanceModule;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  try {
    const q = await yf.quote(ticker);

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
