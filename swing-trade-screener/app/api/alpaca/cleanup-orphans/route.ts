// =============================================================================
// POST /api/alpaca/cleanup-orphans
// Scans all non-closed Redis trade records and checks whether a matching
// live position OR open order exists on Alpaca for each one.
//
// A trade is considered an orphan if ALL of the following are true:
//   1. phase !== "closed" and status !== "orphaned" already
//   2. No live Alpaca position for the ticker
//   3. No valid primaryOrderId, OR the order is in a terminal/dead state
//
// Orphaned records are marked status: "orphaned" in Redis so they are
// filtered out of the Auto Testing UI and stat calculations.
//
// Call once manually from the browser to clean up legacy buggy records.
// Safe to call multiple times — already-orphaned records are skipped.
// =============================================================================

export const dynamic = "force-dynamic";

import { getTrades, updateTrade } from "@/lib/alpaca/trades";
import { getPosition, getOrder } from "@/lib/alpaca/client";

// Order statuses that mean the order is still alive on Alpaca
const ACTIVE_ORDER_STATUSES = new Set([
  "new",
  "accepted",
  "pending_new",
  "accepted_for_bidding",
  "partially_filled",
  "held",
  "calculated",
  "pending_cancel",
  "pending_replace",
]);

interface OrphanResult {
  ticker: string;
  tradeId: string;
  status: "orphaned" | "kept" | "skipped";
  reason?: string;
}

export async function POST() {
  const timestamp = new Date().toISOString();

  try {
    const trades = await getTrades();

    // Only check trades that are non-closed and not already orphaned/queued
    const candidates = trades.filter(
      (t) =>
        t.phase !== "closed" &&
        t.status !== "orphaned" &&
        t.status !== "queued"
    );

    const results: OrphanResult[] = [];

    for (const trade of candidates) {
      try {
        // 1. No primaryOrderId at all — definitely orphaned
        if (!trade.primaryOrderId) {
          await updateTrade(trade.tradeId, { status: "orphaned" });
          results.push({
            ticker: trade.ticker,
            tradeId: trade.tradeId,
            status: "orphaned",
            reason: "no primaryOrderId",
          });
          continue;
        }

        // 2. Live position exists — real trade, keep it
        const position = await getPosition(trade.ticker);
        if (position) {
          results.push({
            ticker: trade.ticker,
            tradeId: trade.tradeId,
            status: "kept",
            reason: "live position exists",
          });
          continue;
        }

        // 3. Check if the order is still alive on Alpaca
        let orderIsActive = false;
        try {
          const order = await getOrder(trade.primaryOrderId);
          orderIsActive = ACTIVE_ORDER_STATUSES.has(order.status);
        } catch {
          // 404 or other error — order doesn't exist on Alpaca
          orderIsActive = false;
        }

        if (orderIsActive) {
          results.push({
            ticker: trade.ticker,
            tradeId: trade.tradeId,
            status: "kept",
            reason: "open order exists",
          });
          continue;
        }

        // 4. No position + no active order → orphan
        await updateTrade(trade.tradeId, { status: "orphaned" });
        results.push({
          ticker: trade.ticker,
          tradeId: trade.tradeId,
          status: "orphaned",
          reason: "no position and no active order",
        });
      } catch (err) {
        // Non-fatal — log and skip this trade
        console.error(
          `[cleanup-orphans] [${timestamp}] Check failed for ${trade.ticker} (${trade.tradeId}): ${err}`
        );
        results.push({
          ticker: trade.ticker,
          tradeId: trade.tradeId,
          status: "skipped",
          reason: String(err),
        });
      }
    }

    const orphaned = results.filter((r) => r.status === "orphaned").length;
    const kept = results.filter((r) => r.status === "kept").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    console.log(
      `[cleanup-orphans] [${timestamp}] Done — ${orphaned} orphaned, ${kept} kept, ${skipped} skipped`
    );

    return Response.json({
      ok: true,
      total: candidates.length,
      orphaned,
      kept,
      skipped,
      results,
      timestamp,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cleanup-orphans] [${timestamp}] top-level error: ${message}`);
    return Response.json({ ok: false, error: message });
  }
}
