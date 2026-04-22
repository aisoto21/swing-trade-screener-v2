// =============================================================================
// POST /api/cron/check-t1-fills
// Triggered externally every minute during market hours via cron-job.org.
// No authentication required — market-hours guard runs server-side.
//
// Lifecycle handled:
//   [10B] Queued trades → submit at market open
//   [10C] Stale pending entries (>7 calendar days) → cancel + mark expired
//   Phase 1 bracket fills:
//     → stop leg fills   : exitReason='stop_loss', closed
//     → T1 leg fills     : transition to phase 2, submit GTC OCO for phase2Qty
//     → expired/canceled : bracket void before entry → removed from tracking
//   Phase 2 OCO fills:
//     → take_profit (limit) fills : exitReason='t2', closed (win)
//     → stop_loss (trailing) fills: exitReason='trailing_stop', closed
//     → expired/canceled          : OCO void → closed at T1 result
//   [10D] At market close (is_open transitions false) → save daily snapshot
//   [10E] Partial entry fills → recalculate t1Qty/phase2Qty
//   [10F] Entry fill detected → record slippage vs intended entryPrice
// =============================================================================

import { getTrades, updateTrade, saveSnapshot } from "@/lib/alpaca/trades";
import { getOrder, submitOrder, cancelOrder, getClock, getAccount } from "@/lib/alpaca/client";
import type { AlpacaTrade } from "@/types/alpaca";

// ─── helpers ────────────────────────────────────────────────────────────────

// Market hours guard: 9:30 AM – 4:05 PM ET, Mon–Fri (buffer for close snapshot)
function isMarketHours(): boolean {
  const now = new Date();
  const etTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const day = etTime.getDay();
  if (day === 0 || day === 6) return false;

  const totalMinutes = etTime.getHours() * 60 + etTime.getMinutes();
  return totalMinutes >= 9 * 60 + 30 && totalMinutes < 16 * 60 + 5;
}

// Redis key for tracking whether last cron run saw market open (for snapshot trigger)
const LAST_OPEN_KEY = "alpaca:cron:last_was_open";

// Days between two ISO timestamps
function calendarDaysSince(isoTimestamp: string): number {
  const then = new Date(isoTimestamp).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

// ─── main ────────────────────────────────────────────────────────────────────

export async function POST() {
  if (!isMarketHours()) {
    return Response.json({ skipped: true, reason: "Outside market hours" });
  }

  const timestamp = new Date().toISOString();

  try {
    // =========================================================================
    // CLOCK CHECK — detect open/close transitions for snapshot + queued submit
    // =========================================================================
    let clockIsOpen = true;
    try {
      const clock = await getClock();
      clockIsOpen = clock.is_open;
    } catch {
      // Proceed assuming open on clock failure
    }

    const trades = await getTrades();

    // =========================================================================
    // [ISSUE 10B] QUEUED TRADES — submit at market open
    // =========================================================================
    const queuedTrades = trades.filter((t) => t.status === "queued" && t.phase === 1);
    if (clockIsOpen && queuedTrades.length > 0) {
      for (const trade of queuedTrades) {
        try {
          const entrySide = trade.direction === "long" ? "buy" : "sell";
          const bracketBody: Record<string, unknown> = {
            symbol: trade.ticker,
            qty: String(trade.t1Qty),
            side: entrySide,
            type: "limit",
            limit_price: String(trade.entryPrice.toFixed(2)),
            time_in_force: "gtc",
            order_class: "bracket",
            stop_loss: {
              stop_price: String(trade.stopPrice.toFixed(2)),
            },
            take_profit: {
              limit_price: String(trade.t1Price.toFixed(2)),
            },
          };

          const bracketOrder = await submitOrder(bracketBody);
          await updateTrade(trade.tradeId, {
            primaryOrderId: bracketOrder.id,
            t1OrderId: bracketOrder.id,
            status: "active",
          });
          console.log(
            `[cron] [ALERT] QUEUED→SUBMITTED ${trade.ticker} — orderId=${bracketOrder.id}`
          );
        } catch (err) {
          console.error(`[cron] [${timestamp}] Failed to submit queued trade ${trade.ticker}: ${err}`);
        }
      }
    }

    // =========================================================================
    // [ISSUE 10C] STALE ENTRY CLEANUP — cancel pending entries >7 calendar days
    // =========================================================================
    const phase1Active = trades.filter((t) => t.phase === 1 && t.status !== "queued" && t.status !== "expired");
    for (const trade of phase1Active) {
      if (calendarDaysSince(trade.submittedAt) >= 7) {
        try {
          // Attempt to cancel the bracket order on Alpaca (ignore 404 if already gone)
          await cancelOrder(trade.primaryOrderId).catch(() => {});
          await updateTrade(trade.tradeId, {
            phase: "closed",
            status: "expired",
            closedAt: timestamp,
            exitReason: null,
          });
          console.log(
            `[cron] [ALERT] EXPIRED ${trade.ticker} — pending entry >7 days, cancelled orderId=${trade.primaryOrderId}`
          );
        } catch (err) {
          console.error(`[cron] [${timestamp}] Stale cleanup failed for ${trade.ticker}: ${err}`);
        }
      }
    }

    // Re-fetch trades after queued submission + stale cleanup
    const freshTrades = await getTrades();
    const phase1Trades = freshTrades.filter((t) => t.phase === 1 && t.status !== "queued" && t.status !== "expired");
    const phase2Trades = freshTrades.filter((t) => t.phase === 2 && t.phase2OrderId);

    // =========================================================================
    // PHASE 1: Check bracket orders — stop_loss vs take_profit (T1) fill
    // Also handles: [10E] partial fills, [10F] slippage tracking
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

        // [ISSUE 10E] Detect partial entry fill — recalculate t1Qty/phase2Qty
        if (bracketOrder.status === "partially_filled") {
          const filledQty = parseInt(bracketOrder.filled_qty ?? "0", 10);
          if (filledQty > 0 && filledQty !== trade.filledQty) {
            const newT1Qty = Math.max(Math.floor(filledQty / 2), 1);
            const newPhase2Qty = filledQty - newT1Qty;
            await updateTrade(trade.tradeId, {
              filledQty,
              t1Qty: newT1Qty,
              phase2Qty: newPhase2Qty,
            });
            console.log(
              `[cron] [ALERT] PARTIAL FILL ${trade.ticker} — filledQty=${filledQty}, recalc t1Qty=${newT1Qty} phase2Qty=${newPhase2Qty}`
            );
          }
        }

        // Check if an exit leg has fired
        const filledLeg = bracketOrder.legs?.find((l) => l.status === "filled");

        if (filledLeg) {
          const exitPrice = parseFloat(filledLeg.filled_avg_price ?? "0");

          // [ISSUE 10F] Slippage on entry fill (only first time — when entry itself fills)
          // The bracket's main order fills at entry; legs are stop/T1.
          // Entry slippage detected when bracket status transitions to filled (both legs activated).
          if (bracketOrder.status === "filled" && bracketOrder.filled_avg_price && !trade.filledEntryPrice) {
            const filledEntryPrice = parseFloat(bracketOrder.filled_avg_price);
            const slippage =
              trade.direction === "long"
                ? filledEntryPrice - trade.entryPrice
                : trade.entryPrice - filledEntryPrice;
            const slippageBps = Math.round((slippage / trade.entryPrice) * 10000);
            await updateTrade(trade.tradeId, {
              filledEntryPrice,
              filledQty: parseInt(bracketOrder.filled_qty ?? "0", 10),
              slippage: parseFloat(slippage.toFixed(4)),
              slippageBps,
            });
            if (Math.abs(slippageBps) >= 5) {
              console.log(
                `[cron] [ALERT] SLIPPAGE ${trade.ticker} — intended=${trade.entryPrice} filled=${filledEntryPrice} slippage=${slippage.toFixed(4)} (${slippageBps}bps)`
              );
            }
          }

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
              `[cron] [ALERT] STOP HIT ${trade.ticker} @ ${exitPrice} — closed (loss)`
            );
          } else {
            // Take profit (T1) filled — transition to phase 2
            await updateTrade(trade.tradeId, {
              phase: 2,
              t1FilledAt: timestamp,
              exitReason: "t1",
            });

            // Re-read trade to get updated t1Qty/phase2Qty (may have been recalculated by 10E)
            const freshTradeList = await getTrades();
            const updatedTrade = freshTradeList.find((t) => t.tradeId === trade.tradeId) ?? trade;

            // Submit GTC OCO for phase2Qty: T2 limit + 2% trailing stop
            if (updatedTrade.phase2Qty > 0) {
              const exitSide = trade.direction === "long" ? "sell" : "buy";
              const ocoBody: Record<string, unknown> = {
                symbol: trade.ticker,
                qty: String(updatedTrade.phase2Qty),
                side: exitSide,
                type: "limit",
                limit_price: String(trade.t2Price.toFixed(2)),
                time_in_force: "gtc",
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
                  `[cron] [ALERT] T1 HIT ${trade.ticker} @ ${exitPrice} — OCO submitted (${updatedTrade.phase2Qty} shares, T2=${trade.t2Price.toFixed(2)}, trail=2% GTC)`
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
                `[cron] [ALERT] T1 HIT ${trade.ticker} @ ${exitPrice} (no phase2) — closed (${outcome})`
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

          const alertLabel = exitReason === "t2" ? "T2 HIT" : "TRAIL STOP";
          console.log(
            `[cron] [ALERT] ${alertLabel} ${trade.ticker} @ ${exitPrice} | outcome: ${outcome}`
          );
        }
      } catch (err) {
        console.error(
          `[cron] [${timestamp}] Phase 2 check failed for ${trade.ticker}: ${err}`
        );
      }
    }

    // =========================================================================
    // [ISSUE 10D] DAILY SNAPSHOT — save at market close
    // Detect close by: market was open last check, now closed.
    // We approximate by checking if clock is_open=false within the 4:00–4:05 PM window.
    // =========================================================================
    if (!clockIsOpen) {
      try {
        const account = await getAccount();
        const allTrades = await getTrades();
        const closed = allTrades.filter((t) => t.phase === "closed");
        const open = allTrades.filter((t) => t.phase !== "closed");
        const wins = closed.filter((t) => t.outcome === "win").length;
        const losses = closed.filter((t) => t.outcome === "loss").length;
        const winRate = wins + losses > 0 ? wins / (wins + losses) : null;

        // Simple P&L proxy — count wins as +1R, losses as -1R * 0.5 (bracket targets 2:1 R/R)
        // Real P&L would require tracking exitPrice vs entryPrice * qty
        const closedWithPrices = closed.filter((t) => t.exitPrice && t.filledEntryPrice);
        const pnl = closedWithPrices.reduce((sum, t) => {
          const qty = t.filledQty ?? t.t1Qty;
          const entryFilled = t.filledEntryPrice ?? t.entryPrice;
          const pl =
            t.direction === "long"
              ? (t.exitPrice! - entryFilled) * qty
              : (entryFilled - t.exitPrice!) * qty;
          return sum + pl;
        }, 0);

        const etNow = new Date(
          new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
        );
        const dateStr = `${etNow.getFullYear()}-${String(etNow.getMonth() + 1).padStart(2, "0")}-${String(etNow.getDate()).padStart(2, "0")}`;

        await saveSnapshot({
          date: dateStr,
          equity: parseFloat(account.equity),
          openTrades: open.length,
          closedTrades: closed.length,
          winRate,
          pnl: parseFloat(pnl.toFixed(2)),
        });
        console.log(
          `[cron] [ALERT] SNAPSHOT saved for ${dateStr} — equity=${account.equity} winRate=${winRate !== null ? (winRate * 100).toFixed(1) + "%" : "n/a"} pnl=$${pnl.toFixed(2)}`
        );
      } catch (snapErr) {
        console.error(`[cron] [${timestamp}] Snapshot save failed: ${snapErr}`);
      }
    }

    return Response.json({
      ok: true,
      checkedPhase1: phase1Trades.length,
      checkedPhase2: phase2Trades.length,
      submittedQueued: queuedTrades.length,
      timestamp,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron] [${timestamp}] top-level error: ${message}`);
    return Response.json({ ok: false, error: message });
  }
}
