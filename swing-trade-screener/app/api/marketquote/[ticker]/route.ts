import { NextRequest } from "next/server";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "No API key configured" }, { status: 503 });
  }

  try {
    const res = await fetch(
      `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(ticker)}`,
      {
        headers: { "X-Finnhub-Token": apiKey },
        next: { revalidate: 60 },
      }
    );

    if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);

    const data = await res.json();

    // Finnhub quote: c=current, d=change, dp=changePercent, pc=prevClose
    return Response.json(
      {
        ticker,
        price: data.c,
        change: data.d,
        changePercent: data.dp,
        prevClose: data.pc,
      },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
