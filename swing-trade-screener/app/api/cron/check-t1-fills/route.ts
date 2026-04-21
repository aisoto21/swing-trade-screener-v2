// =============================================================================
// POST /api/cron/check-t1-fills
// Triggered externally every minute during market hours via cron-job.org.
// No authentication required — market-hours guard runs server-side.
//
// Phase 1 → Phase 2: when T1 order fills,
//   - cancel the original stop loss leg
//   - submit a 2% trailing stop for phase2Qty
//   - update KV: phase = 2, t1FilledAt = now
//
// Phase 2 → closed: when trailing stop fills,
//   - update KV: phase = 'closed', closedAt = now, outcome = win/loss
// =============================================================================

import { getTrades, updateTrade } from "@/lib/alpaca/trades";
import { getOrder, cancelOrder, submitOrder } from "@/lib/alpaca/client";

// Market hours guard: 9:30 AM – 4:00 PM ET, Mon–Fri
function isMarketHours(): boolean {
  const now = new Date();
  // Get ET time
  const etTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const day = etTime.getDay(); // 0 = Sun, 6 = Sat
  if (day === 0 || day === 6) return false;

  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const marketOpen = 9 * 60 + 30;  // 9:30 AM
  const marketClose = 16 * 60;     // 4:00 PM

  return totalMinutes >= marketOpen && totalMinutes < marketClose;
}

export async function POST() {
  if (!isMarketHours()) {
    return Response.json({ skipped: true, reason: "Outside market hours" });
  }

  const timestamp = new Date().toISOString();

  try {
    const trades = await getTrades();

    // --- Phase 1: check T1 fills ---
    const phase1Trades = trades.filter((t) => t.phase === 1);

    for (const trade of phase1Trades) {
      try {
        const t1Order = await getOrder(trade.t1OrderId);

        if (t1Order.status === "filled") {
          // 1. Get primary order's stop leg and cancel it
          try {
            const primaryOrder = await getOrder(trade.primaryOrderId);
            const stopLeg = primaryOrder.legs?.find(
              (leg) => leg.type === "stop" || leg.type === "stop_limit"
            );
            if (stopLeg) {
              await cancelOrder(stopLeg.id);
            }
          } catch (err) {
            console.warn(
              `[cron] [${timestamp}] ${trade.ticker} — could not cancel stop leg: ${err}`
            );
          }

          // 2. Submit trailing stop for phase2Qty
          const trailingSide = trade.direction === "long" ? "sell" : "buy";
          const trailingBody: Record<string, unknown> = {
            symbol: trade.ticker,
            qty: String(trade.phase2Qty),
            side: trailingSide,
            type: "trailing_stop",
            trail_percent: "2.0",
            time_in_force: "day",
          };

          const trailingOrder = await submitOrder(trailingBody);

          // 3. Update trade: phase = 2, store trailing stop order ID in t1OrderId slot
          //    (reusing t1OrderId field to track the trailing stop for phase 2 checks)
          await updateTrade(trade.tradeId, {
            phase: 2,
            t1FilledAt: timestamp,
            // Store trailing stop order ID in primaryOrderId for phase 2 check
            primaryOrderId: trailingOrder.id,
          });

          console.log(
            `[cron] [${timestamp}] ${trade.ticker} T1 filled — trailing stop submitted (${trade.phase2Qty} shares, 2%)`
          );
        }
      } catch (err) {
        console.error(
          `[cron] [${timestamp}] Phase 1 check failed for ${trade.ticker}: ${err}`
        );
      }
    }

    // --- Phase 2: check trailing stop fills ---
    const phase2Trades = trades.filter((t) => t.phase === 2);

    for (const trade of phase2Trades) {
      try {
        // primaryOrderId holds the trailing stop order ID after Phase 1 → 2 transition
        const trailingOrder = await getOrder(trade.primaryOrderId);

        if (trailingOrder.status === "filled") {
          const exitPrice = parseFloat(trailingOrder.filled_avg_price ?? "0");
          const outcome: "win" | "loss" =
            trade.direction === "long"
              ? exitPrice > trade.entryPrice
                ? "win"
                : "loss"
              : exitPrice < trade.entryPrice
              ? "win"
              : "loss";

          await updateTrade(trade.tradeId, {
            phase: "closed",
            closedAt: timestamp,
            outcome,
            exitPrice,
          });

          console.log(
            `[cron] [${timestamp}] ${trade.ticker} closed — exit ${exitPrice} | outcome: ${outcome}`
          );
        }
      } catch (err) {
        console.error(
          `[cron] [${timestamp}] Phase 2 check failed for ${trade.ticker}: ${err}`
        );
      }
    }

    return Response.json({
      ok: true,
      checked: { phase1: phase1Trades.length, phase2: phase2Trades.length },
      timestamp,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron] [${timestamp}] check-t1-fills top-level error: ${message}`);
    // Fail silently — cron retries on next interval
    return Response.json({ ok: false, error: message });
  }
}
