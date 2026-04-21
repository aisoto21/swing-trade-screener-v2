// =============================================================================
// POST /api/cron/check-t1-fills
// Triggered externally every minute during market hours via cron-job.org.
// No authentication required — market-hours guard runs server-side.
//
// Phase 1 bracket lifecycle (t1Qty shares):
//   → stop_loss leg fills  : position stopped out → exitReason='stop_loss', closed
//   → take_profit leg fills: T1 hit → transition to phase 2, submit OCO for phase2Qty
//   → expired/canceled     : bracket void before entry → removed from tracking
//
// Phase 2 OCO lifecycle (phase2Qty shares, T2 limit + 2% trailing stop):
//   → take_profit (limit) fills : T2 hit → exitReason='t2', closed (win)
//   → stop_loss (trailing) fills: trail hit → exitReason='trailing_stop', closed
//   → expired/canceled          : OCO void → closed at T1 result
//
// Exit reason is determined by the filled leg's `type` field:
//   "stop" | "stop_limit" | "trailing_stop" → stop-side exit
//   "limit"                                 → profit-target exit
// =============================================================================

import { getTrades, updateTrade } from "@/lib/alpaca/trades";
import { getOrder, submitOrder } from "@/lib/alpaca/client";

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
    const phase2Trades = trades.filter((t) => t.phase === 2 && t.phase2OrderId);

    // =========================================================================
    // PHASE 1: Check bracket orders — detect stop_loss vs take_profit (T1) fill
    // =========================================================================
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
            exitReason: null,
          });
          console.log(
            `[cron] [${timestamp}] ${trade.ticker} bracket ${bracketOrder.status} without fill — removed`
          );
          continue;
        }

        // Check if an exit leg has fired
        const filledLeg = bracketOrder.legs?.find((l) => l.status === "filled");

        if (filledLeg) {
          const exitPrice = parseFloat(filledLeg.filled_avg_price ?? "0");

          // Determine which leg filled by type
          const isStopLeg =
            filledLeg.type === "stop" ||
            filledLeg.type === "stop_limit" ||
            filledLeg.type === "trailing_stop";

          if (isStopLeg) {
            // Stop loss hit — trade closed as a loss
            await updateTrade(trade.tradeId, {
              phase: "closed",
              closedAt: timestamp,
              exitPrice,
              outcome: "loss",
              exitReason: "stop_loss",
            });
            console.log(
              `[cron] [${timestamp}] ${trade.ticker} stop hit @ ${exitPrice} — closed (loss, stop_loss)`
            );
          } else {
            // Take profit (T1) filled — transition to phase 2
            // exitReason='t1' is the default; overridden to 't2'/'trailing_stop' when OCO closes
            await updateTrade(trade.tradeId, {
              phase: 2,
              t1FilledAt: timestamp,
              exitReason: "t1",
            });

            // Submit OCO for phase2Qty: T2 limit + 2% trailing stop
            if (trade.phase2Qty > 0) {
              const exitSide = trade.direction === "long" ? "sell" : "buy";
              const ocoBody: Record<string, unknown> = {
                symbol: trade.ticker,
                qty: String(trade.phase2Qty),
                side: exitSide,
                type: "limit",
                limit_price: String(trade.t2Price.toFixed(2)),
                time_in_force: "day",
                order_class: "oco",
                stop_loss: {
                  trail_percent: "2",
                },
              };

              console.log(
                `[cron] [${timestamp}] Submitting OCO for ${trade.ticker} phase2: ${JSON.stringify(ocoBody)}`
              );

              try {
                const ocoOrder = await submitOrder(ocoBody);
                await updateTrade(trade.tradeId, { phase2OrderId: ocoOrder.id });
                console.log(
                  `[cron] [${timestamp}] ${trade.ticker} T1 @ ${exitPrice} — OCO submitted (${trade.phase2Qty} shares, T2=${trade.t2Price.toFixed(2)}, trail=2%)`
                );
              } catch (ocoErr) {
                console.error(
                  `[cron] [${timestamp}] ${trade.ticker} T1 filled but OCO failed: ${ocoErr}`
                );
              }
            } else {
              // No phase2Qty — close trade as T1 win
              const outcome: "win" | "loss" =
                trade.direction === "long"
                  ? exitPrice > trade.entryPrice ? "win" : "loss"
                  : exitPrice < trade.entryPrice ? "win" : "loss";
              await updateTrade(trade.tradeId, {
                phase: "closed",
                closedAt: timestamp,
                exitPrice,
                outcome,
                exitReason: "t1",
              });
              console.log(
                `[cron] [${timestamp}] ${trade.ticker} T1 @ ${exitPrice} (no phase2) — closed (${outcome})`
              );
            }
          }
        }
      } catch (err) {
        console.error(
          `[cron] [${timestamp}] Phase 1 check failed for ${trade.ticker}: ${err}`
        );
      }
    }

    // =========================================================================
    // PHASE 2: Check OCO orders — T2 limit vs trailing stop fill
    // =========================================================================
    for (const trade of phase2Trades) {
      try {
        const ocoOrder = await getOrder(trade.phase2OrderId!);

        // OCO expired/cancelled without fill — close at T1 result (exitReason stays 't1')
        const voidStatuses = ["expired", "canceled", "done_for_day"];
        if (
          voidStatuses.includes(ocoOrder.status) &&
          !ocoOrder.legs?.some((l) => l.status === "filled")
        ) {
          await updateTrade(trade.tradeId, {
            phase: "closed",
            closedAt: timestamp,
            // exitReason retains 't1' from phase 1→2 transition
          });
          console.log(
            `[cron] [${timestamp}] ${trade.ticker} OCO ${ocoOrder.status} without fill — closed at T1`
          );
          continue;
        }

        // Check if an OCO leg has fired
        const filledOcoLeg = ocoOrder.legs?.find((l) => l.status === "filled");

        if (filledOcoLeg) {
          const exitPrice = parseFloat(filledOcoLeg.filled_avg_price ?? "0");

          const isTrailLeg =
            filledOcoLeg.type === "trailing_stop" ||
            filledOcoLeg.type === "stop" ||
            filledOcoLeg.type === "stop_limit";

          const exitReason = isTrailLeg ? "trailing_stop" : "t2";

          const outcome: "win" | "loss" =
            trade.direction === "long"
              ? exitPrice > trade.entryPrice ? "win" : "loss"
              : exitPrice < trade.entryPrice ? "win" : "loss";

          await updateTrade(trade.tradeId, {
            phase: "closed",
            closedAt: timestamp,
            exitPrice,
            outcome,
            exitReason,
          });

          console.log(
            `[cron] [${timestamp}] ${trade.ticker} phase2 closed via ${exitReason} @ ${exitPrice} | outcome: ${outcome}`
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
      checkedPhase1: phase1Trades.length,
      checkedPhase2: phase2Trades.length,
      timestamp,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron] [${timestamp}] top-level error: ${message}`);
    return Response.json({ ok: false, error: message });
  }
}
