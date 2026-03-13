import { NextRequest } from "next/server";
import { fetchOHLCV } from "@/lib/dataFetcher";
import { rsiFull } from "@/lib/indicators/rsi";
import { macdFull } from "@/lib/indicators/macd";
import { bollingerBands } from "@/lib/indicators/bollingerBands";
import { sma50, sma200 } from "@/lib/indicators/sma";
import { ema9 } from "@/lib/indicators/ema";
import { vwap } from "@/lib/indicators/vwap";
import { fibonacci } from "@/lib/indicators/fibonacci";
import { supportResistance } from "@/lib/indicators/supportResistance";
import { volumeAnalysis } from "@/lib/indicators/volumeAnalysis";

/**
 * Compute indicators for a given ticker and timeframe
 * GET /api/indicators?ticker=AAPL&timeframe=1D
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get("ticker") ?? "AAPL";
    const timeframe = (searchParams.get("timeframe") ?? "1D") as "1D" | "4H" | "15M";
    const useMock = process.env.USE_MOCK_DATA === "true";

    const bars = await fetchOHLCV(ticker, timeframe, useMock);
    if (bars.length < 50) {
      return Response.json(
        { error: "Insufficient data for indicator computation" },
        { status: 400 }
      );
    }

    const result = {
      ticker,
      timeframe,
      bars: bars.slice(-100),
      rsi: rsiFull(bars),
      macd: macdFull(bars),
      bollingerBands: bollingerBands(bars),
      sma50: sma50(bars),
      sma200: timeframe === "1D" ? sma200(bars) : null,
      ema9: ema9(bars),
      vwap: timeframe !== "1D" ? vwap(bars) : null,
      fibonacci: timeframe === "1D" ? fibonacci(bars) : null,
      supportResistance: timeframe === "1D" ? supportResistance(bars) : null,
      volumeAnalysis: volumeAnalysis(bars),
    };

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
