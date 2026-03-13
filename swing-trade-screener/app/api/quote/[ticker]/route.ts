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

    const useMock = process.env.USE_MOCK_DATA === "true";
    const result = await analyzeTicker(ticker.toUpperCase(), useMock);

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
