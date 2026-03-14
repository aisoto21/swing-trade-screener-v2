import { NextRequest } from "next/server";
import { analyzeTicker } from "@/lib/screener";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    if (!ticker) {
      return Response.json({ error: "Ticker required" }, { status: 400 });
    }

    const url = new URL(req.url);
    const accountSize = parseFloat(url.searchParams.get("accountSize") ?? "25000");
    const riskPerTrade = parseFloat(url.searchParams.get("riskPerTrade") ?? "0.01");

    const useMock = process.env.USE_MOCK_DATA === "true";
    const result = await analyzeTicker(ticker.toUpperCase(), useMock, accountSize, riskPerTrade);

    if (!result) {
      return Response.json({ error: "Ticker not found or insufficient data" }, { status: 404 });
    }

    return Response.json(result, {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    return Response.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
