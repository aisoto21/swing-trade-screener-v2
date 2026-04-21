// =============================================================================
// POST /api/alpaca/close-trade
// Body: { tradeId: string, exitPrice: number }
// Manually closes an open trade, calculates outcome, persists to Redis.
// =============================================================================

import { getTrades, updateTrade } from "@/lib/alpaca/trades";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tradeId, exitPrice } = body as { tradeId: string; exitPrice: number };

    if (!tradeId || typeof exitPrice !== "number" || exitPrice <= 0) {
      return Response.json({ error: "Invalid tradeId or exitPrice" }, { status: 400 });
    }

    const trades = await getTrades();
    const trade = trades.find((t) => t.tradeId === tradeId);
    if (!trade) {
      return Response.json({ error: "Trade not found" }, { status: 404 });
    }

    const outcome: "win" | "loss" =
      trade.direction === "long"
        ? exitPrice > trade.entryPrice
          ? "win"
          : "loss"
        : exitPrice < trade.entryPrice
        ? "win"
        : "loss";

    const timestamp = new Date().toISOString();
    await updateTrade(tradeId, {
      phase: "closed",
      closedAt: timestamp,
      exitPrice,
      outcome,
    });

    return Response.json({ ok: true, outcome, exitPrice });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
