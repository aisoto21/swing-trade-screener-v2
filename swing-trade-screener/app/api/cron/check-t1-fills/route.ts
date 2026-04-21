// =============================================================================
// POST /api/cron/check-t1-fills
// Triggered externally every minute during market hours via cron-job.org.
// No authentication required — market-hours guard runs server-side.
//
// Bracket order lifecycle:
//   Phase 1 (open):  entry limit pending or filled, stop+T1 legs active
//   → closed (win):  take_profit leg fills at T1 price
//   → closed (loss): stop_loss leg fills at stop price
//   → closed (void): bracket expired/cancelled before entry filled
//
// Alpaca bracket response shape (GET /v2/orders/{id}):
//   order.status = "filled" when entry leg fills (position is NOW open)
//   order.legs[].status = "filled" when an exit leg fires (position closed)
// =============================================================================

import { getTrades, updateTrade } from "@/lib/alpaca/trades";
import { getOrder } from "@/lib/alpaca/client";

// Market hours guard: 9:30 AM – 4:00 PM ET, Mon–Fri
function isMarketHours(): boolean {
  const now = new Date();
  const etTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const day = etTime.getDay();
  if (day === 0 || day === 6) return false;

  const totalMinutes = etTime.getHours() * 60 + etTime.getMinutes();
  return totalMinutes >= 9 * 60 + 30 && totalMinutes < 16 * 60;
}

export async function POST() {
  if (!isMarketHours()) {
    return Response.json({ skipped: true, reason: "Outside market hours" });
  }

  const timestamp = new Date().toISOString();

  try {
    const trades = await getTrades();
    const phase1Trades = trades.filter((t) => t.phase === 1);

    for (const trade of phase1Trades) {
      try {
        const bracketOrder = await getOrder(trade.primaryOrderId);

        // Bracket expired/cancelled before entry ever filled — remove from tracking
        const voidStatuses = ["expired", "canceled", "done_for_day"];
        if (
          voidStatuses.includes(bracketOrder.status) &&
          !bracketOrder.legs?.some((l) => l.status === "filled")
        ) {
          await updateTrade(trade.tradeId, {
            phase: "closed",
            closedAt: timestamp,
          });
          console.log(
            `[cron] [${timestamp}] ${trade.ticker} bracket ${bracketOrder.status} without fill — removed`
          );
          continue;
        }

        // Check if an exit leg has fired (position closed)
        const filledLeg = bracketOrder.legs?.find(
          (l) => l.status === "filled"
        );

        if (filledLeg) {
          const exitPrice = parseFloat(filledLeg.filled_avg_price ?? "0");

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
            exitPrice,
            outcome,
            t1FilledAt: timestamp,
          });

          console.log(
            `[cron] [${timestamp}] ${trade.ticker} bracket closed — exit ${exitPrice} | outcome: ${outcome}`
          );
        }
      } catch (err) {
        console.error(
          `[cron] [${timestamp}] Check failed for ${trade.ticker}: ${err}`
        );
      }
    }

    return Response.json({
      ok: true,
      checked: phase1Trades.length,
      timestamp,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron] [${timestamp}] top-level error: ${message}`);
    return Response.json({ ok: false, error: message });
  }
}
