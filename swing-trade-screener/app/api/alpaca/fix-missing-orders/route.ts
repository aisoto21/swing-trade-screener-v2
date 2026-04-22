// =============================================================================
// POST /api/alpaca/fix-missing-orders
// One-time manual fix: submits missing T1 limit orders AND missing stop loss
// orders for existing open positions where bracket legs are absent in Alpaca.
//
// T1 repair (phase === 1):
//   - Targets: t1OrderId is null/empty or === primaryOrderId
//   - Long  → sell limit at t1Price (sell to close above entry)
//   - Short → buy  limit at t1Price (buy to cover below entry)
//
// Stop loss repair (phase === 1, has live Alpaca position):
//   - Targets: trades with a live position but no bracket stop (orphaned from
//     early buggy runs that never submitted a stop alongside the entry)
//   - Long  → sell stop at stopPrice (below entry)
//   - Short → buy  stop at stopPrice (above entry)
//   - Skipped if stopPrice is missing or <= 0
//   - stopOrderId stored on trade after successful submission
//
// Call once from the browser after deploy to patch existing open positions.
// Safe to call multiple times — already-patched trades are skipped.
// =============================================================================

export const dynamic = "force-dynamic";

import { getTrades, updateTrade } from "@/lib/alpaca/trades";
import { submitOrder, getPosition } from "@/lib/alpaca/client";
import type { AlpacaTrade } from "@/types/alpaca";

interface PatchResult {
  ticker: string;
  tradeId: string;
  patchType: "t1" | "stop";
  status: "patched" | "skipped" | "failed";
  orderId?: string;
  reason?: string;
  error?: string;
}

export async function POST() {
  const timestamp = new Date().toISOString();

  try {
    const trades = await getTrades();
    const phase1Trades = trades.filter(
      (t): t is AlpacaTrade =>
        t.phase === 1 && t.status !== "orphaned" && t.status !== "queued"
    );

    const results: PatchResult[] = [];

    // =========================================================================
    // PASS 1: T1 limit order repair
    // =========================================================================
    const t1Targets = phase1Trades.filter(
      (t) => !t.t1OrderId || t.t1OrderId === t.primaryOrderId
    );

    for (const trade of t1Targets) {
      if (trade.t1Qty <= 0 || !trade.t1Price) {
        results.push({
          ticker: trade.ticker,
          tradeId: trade.tradeId,
          patchType: "t1",
          status: "skipped",
          reason: "t1Qty is 0 or t1Price missing",
        });
        continue;
      }

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
        console.log(`[fix-orders] [${timestamp}] Submitting T1 for ${trade.ticker}: ${JSON.stringify(t1Body)}`);
        const t1Order = await submitOrder(t1Body);
        await updateTrade(trade.tradeId, { t1OrderId: t1Order.id });
        console.log(`[fix-orders] [${timestamp}] T1 patched ${trade.ticker} — orderId=${t1Order.id}`);
        results.push({
          ticker: trade.ticker,
          tradeId: trade.tradeId,
          patchType: "t1",
          status: "patched",
          orderId: t1Order.id,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[fix-orders] [${timestamp}] T1 failed for ${trade.ticker}: ${msg}`);
        results.push({
          ticker: trade.ticker,
          tradeId: trade.tradeId,
          patchType: "t1",
          status: "failed",
          error: msg,
        });
      }
    }

    // =========================================================================
    // PASS 2: Stop loss order repair
    // Targets: phase 1 trades with a live Alpaca position but no stopOrderId
    // =========================================================================
    const stopTargets = phase1Trades.filter((t) => !t.stopOrderId);

    for (const trade of stopTargets) {
      if (!trade.stopPrice || trade.stopPrice <= 0) {
        results.push({
          ticker: trade.ticker,
          tradeId: trade.tradeId,
          patchType: "stop",
          status: "skipped",
          reason: "stopPrice missing or invalid",
        });
        continue;
      }

      // Only submit a stop if a live position actually exists — don't create
      // a naked stop order for a position that hasn't filled yet
      let hasPosition = false;
      try {
        const position = await getPosition(trade.ticker);
        hasPosition = position !== null;
      } catch {
        hasPosition = false;
      }

      if (!hasPosition) {
        results.push({
          ticker: trade.ticker,
          tradeId: trade.tradeId,
          patchType: "stop",
          status: "skipped",
          reason: "no live Alpaca position — entry may not have filled yet",
        });
        continue;
      }

      // Long → sell stop below entry; Short → buy stop above entry
      const stopSide = trade.direction === "long" ? "sell" : "buy";
      const stopBody: Record<string, unknown> = {
        symbol: trade.ticker,
        qty: String(trade.totalShares),
        side: stopSide,
        type: "stop",
        stop_price: String(trade.stopPrice.toFixed(2)),
        time_in_force: "gtc",
      };

      try {
        console.log(`[fix-orders] [${timestamp}] Submitting stop for ${trade.ticker}: ${JSON.stringify(stopBody)}`);
        const stopOrder = await submitOrder(stopBody);
        await updateTrade(trade.tradeId, { stopOrderId: stopOrder.id });
        console.log(`[fix-orders] [${timestamp}] Stop patched ${trade.ticker} — orderId=${stopOrder.id}`);
        results.push({
          ticker: trade.ticker,
          tradeId: trade.tradeId,
          patchType: "stop",
          status: "patched",
          orderId: stopOrder.id,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[fix-orders] [${timestamp}] Stop failed for ${trade.ticker}: ${msg}`);
        results.push({
          ticker: trade.ticker,
          tradeId: trade.tradeId,
          patchType: "stop",
          status: "failed",
          error: msg,
        });
      }
    }

    const t1Results = results.filter((r) => r.patchType === "t1");
    const stopResults = results.filter((r) => r.patchType === "stop");

    const summary = {
      t1:   { total: t1Results.length,   patched: t1Results.filter(r => r.status === "patched").length,   failed: t1Results.filter(r => r.status === "failed").length,   skipped: t1Results.filter(r => r.status === "skipped").length },
      stop: { total: stopResults.length, patched: stopResults.filter(r => r.status === "patched").length, failed: stopResults.filter(r => r.status === "failed").length, skipped: stopResults.filter(r => r.status === "skipped").length },
    };

    console.log(
      `[fix-orders] [${timestamp}] Done — T1: ${summary.t1.patched} patched, ${summary.t1.failed} failed, ${summary.t1.skipped} skipped | Stop: ${summary.stop.patched} patched, ${summary.stop.failed} failed, ${summary.stop.skipped} skipped`
    );

    return Response.json({ ok: true, summary, results, timestamp });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[fix-orders] [${timestamp}] top-level error: ${message}`);
    return Response.json({ ok: false, error: message });
  }
}
