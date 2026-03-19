import { NextRequest } from "next/server";
import type { ScreenerFilters } from "@/types";
import { screenTicker, getMarketRegime } from "@/lib/screener";
import { computeMarketBreadthFromAggregates } from "@/lib/utils/marketBreadth";
import type { BreadthDataPoint } from "@/lib/utils/marketBreadth";
import { SCREENING_UNIVERSE } from "@/constants/universe";

const DEFAULT_FILTERS: ScreenerFilters = {
  minPrice: 10,
  minVolume: 500000,
  minMarketCap: 300_000_000,
  biasFilter: "BOTH",
  minSetupGrade: "B",
  minRR: 1.5,
  accountSize: 25000,
  riskPerTrade: 0.01,
  includeBearishSetups: true,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const filters: ScreenerFilters = { ...DEFAULT_FILTERS, ...body.filters };
    const useMock = process.env.USE_MOCK_DATA === "true";
    const tickers = SCREENING_UNIVERSE.map((s) => s.ticker);
    const batchSize = 20;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const regime = await getMarketRegime(useMock);
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: "regime", data: regime }) + "\n"
            )
          );

          const breadthPoints: BreadthDataPoint[] = [];

          for (let i = 0; i < tickers.length; i += batchSize) {
            const batch = tickers.slice(i, i + batchSize);
            const results = await Promise.allSettled(
              batch.map((t) => screenTicker(t, filters, useMock))
            );
            const processed = Math.min(i + batch.length, tickers.length);
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: "progress",
                  data: { current: processed, total: tickers.length },
                }) + "\n"
              )
            );
            for (const r of results) {
              if (r.status === "fulfilled" && r.value) {
                if (r.value.breadthData) breadthPoints.push(r.value.breadthData);
                if (r.value.result) {
                  controller.enqueue(
                    encoder.encode(
                      JSON.stringify({ type: "result", data: r.value }) + "\n"
                    )
                  );
                }
              }
            }
          }

          const breadth = computeMarketBreadthFromAggregates(breadthPoints);
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: "breadth", data: breadth }) + "\n"
            )
          );

          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "done" }) + "\n")
          );
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                data: { message: String(err) },
              }) + "\n"
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "private, max-age=900",
      },
    });
  } catch (err) {
    return Response.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
