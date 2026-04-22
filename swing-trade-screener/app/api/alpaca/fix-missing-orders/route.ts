// =============================================================================
// POST /api/alpaca/fix-missing-orders
// One-time manual fix: submits missing T1 limit orders for existing open
// positions where the bracket's take_profit leg is not showing in Alpaca.
//
// Targets trades where:
//   - phase === 1
//   - t1OrderId is null/empty (T1 never submitted)
//   - t1OrderId === primaryOrderId (bracket approach; T1 internal but not appearing)
//
// T1 side logic:
//   - Long position → sell (sell to close at T1 above entry)
//   - Short position → buy (buy to cover at T1 below entry)
//
// Call once from the browser after deploy to patch existing open positions.
// =============================================================================

export const dynamic = "force-dynamic";

import { getTrades, updateTrade } from "@/lib/alpaca/trades";
import { submitOrder } from "@/lib/alpaca/client";
import type { AlpacaTrade } from "@/types/alpaca";

interface PatchResult {
  ticker: string;
  tradeId: string;
  status: "patched" | "skipped" | "failed";
  t1OrderId?: string;
  reason?: string;
  error?: string;
}

export async function POST() {
  const timestamp = new Date().toISOString();

  try {
    const trades = await getTrades();

    // Identify trades needing a standalone T1 order
    const targets = trades.filter(
      (t): t is AlpacaTrade =>
        t.phase === 1 &&
        (!t.t1OrderId || t.t1OrderId === t.primaryOrderId)
    );

    const results: PatchResult[] = [];

    for (const trade of targets) {
      if (trade.t1Qty <= 0) {
        results.push({
          ticker: trade.ticker,
          tradeId: trade.tradeId,
          status: "skipped",
          reason: "t1Qty is 0",
        });
        continue;
      }

      // T1 side: sell for long (sell to close), buy for short (buy to cover)
      const t1Side = trade.direction === "long" ? "sell" : "buy";

      const t1Body: Record<string, unknown> = {
        symbol: trade.ticker,
        qty: String(trade.t1Qty),
        side: t1Side,
        type: "limit",
        limit_price: String(trade.t1Price.toFixed(2)),
        time_in_force: "gtc",
      };

      try {
        console.log(
          `[fix-t1] [${timestamp}] Submitting T1 for ${trade.ticker}: ${JSON.stringify(t1Body)}`
        );

        const t1Order = await submitOrder(t1Body);
        await updateTrade(trade.tradeId, { t1OrderId: t1Order.id });

        console.log(
          `[fix-t1] [${timestamp}] Patched ${trade.ticker} — t1OrderId=${t1Order.id}`
        );

        results.push({
          ticker: trade.ticker,
          tradeId: trade.tradeId,
          status: "patched",
          t1OrderId: t1Order.id,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[fix-t1] [${timestamp}] Failed for ${trade.ticker}: ${msg}`);
        results.push({
          ticker: trade.ticker,
          tradeId: trade.tradeId,
          status: "failed",
          error: msg,
        });
      }
    }

    const patched = results.filter((r) => r.status === "patched").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    console.log(
      `[fix-t1] [${timestamp}] Done — ${patched} patched, ${failed} failed, ${skipped} skipped`
    );

    return Response.json({
      ok: true,
      total: targets.length,
      patched,
      failed,
      skipped,
      results,
      timestamp,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[fix-t1] [${timestamp}] top-level error: ${message}`);
    return Response.json({ ok: false, error: message });
  }
}
