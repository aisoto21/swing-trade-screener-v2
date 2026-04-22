// =============================================================================
// POST /api/alpaca/submit-trade
// Receives a ScreenerResult + optional marketRegime, calculates position sizing,
// deduplicates, and either:
//   (a) submits a GTC bracket order for t1Qty shares if market is open, or
//   (b) stores the trade as status="queued" if market is closed.
//
// Fixes applied:
//   1. time_in_force: "gtc" — swing trades must persist across sessions
//   2. MAX_NOTIONAL cap prevents absurdly large positions from tight stops
//   3. Bracket for t1Qty (not totalShares) — leaves phase2Qty for OCO after T1
//   4. "cannot be sold short" / untradeable caught as a skip (422)
//   5. Dedup checks ticker only (any direction) to prevent long/short conflict
//   6. Asset tradability pre-check — skips delisted / inactive symbols
//   7. T1 price direction validation — skips inverted targets
//   8. Full bracket payload + response logged for diagnostics
//   9. [ISSUE 10A] Duplicate live position check — skips if position already open
//  10. [ISSUE 10B] Market clock check — queues trade if market closed
//  11. [ISSUE 10G] marketRegime stored on trade for regime breakdown analysis
// =============================================================================

import { NextRequest } from "next/server";
import type { ScreenerResult } from "@/types";
import type { AlpacaTrade } from "@/types/alpaca";
import { submitOrder, getAsset, getPosition, getClock } from "@/lib/alpaca/client";
import { addTrade, alreadySubmittedToday } from "@/lib/alpaca/trades";

const RISK_DOLLARS = 1000;  // 1% of $100k account
const MAX_NOTIONAL = 10000; // hard cap per position — $10k × 10 = $100k max exposure

interface SubmitTradeBody {
  result: ScreenerResult;
  marketRegime?: "bull" | "bear" | "neutral" | null;
}

export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString();
  let ticker = "UNKNOWN";

  try {
    const body: SubmitTradeBody = await req.json();
    const { result, marketRegime } = body;

    if (!result?.primarySetup?.tradeParams) {
      return Response.json({ error: "Invalid setup payload" }, { status: 400 });
    }

    ticker = result.ticker;
    const { primarySetup } = result;
    const { tradeParams } = primarySetup;

    const direction: "long" | "short" =
      primarySetup.bias === "LONG" ? "long" : "short";
    const setupType = primarySetup.name;
    const grade = primarySetup.grade;

    const entryPrice = tradeParams.entry.zone[1];
    const stopPrice = tradeParams.stop.price;
    const t1Price = tradeParams.targets.t1.price;
    const t2Price = tradeParams.targets.t2.price;

    // Asset tradability pre-check — prevents 404/422 on inactive symbols
    try {
      const asset = await getAsset(ticker);
      if (!asset.tradable || asset.status !== "active") {
        console.warn(
          `[alpaca] [ALERT] SKIPPED ${ticker} — not tradeable on Alpaca (tradable=${asset.tradable}, status=${asset.status})`
        );
        return Response.json({ skipped: true, reason: "Not tradeable on Alpaca", ticker });
      }
    } catch (assetErr) {
      // 404 = symbol not found on Alpaca — skip gracefully
      const assetMsg = assetErr instanceof Error ? assetErr.message : String(assetErr);
      console.warn(`[alpaca] [ALERT] SKIPPED ${ticker} — asset check failed: ${assetMsg}`);
      return Response.json({ skipped: true, reason: "Asset check failed", ticker });
    }

    // Validate stop distance (catches inverted stops and zero-distance setups)
    const stopDistance =
      direction === "long"
        ? entryPrice - stopPrice
        : stopPrice - entryPrice;

    if (stopDistance <= 0) {
      console.warn(
        `[alpaca] [ALERT] SKIPPED ${ticker} — invalid stop distance: entry=${entryPrice} stop=${stopPrice}`
      );
      return Response.json({ skipped: true, reason: "Invalid stop distance", ticker });
    }

    // Validate T1 price direction
    // Long bracket: take_profit must be ABOVE entry (sell higher = profit)
    // Short bracket: take_profit must be BELOW entry (buy lower = profit)
    if (direction === "long" && t1Price <= entryPrice) {
      console.warn(
        `[alpaca] [ALERT] SKIPPED ${ticker} — invalid T1 for long: t1=${t1Price} <= entry=${entryPrice}`
      );
      return Response.json({ skipped: true, reason: "Invalid T1 price (long)", ticker });
    }
    if (direction === "short" && t1Price >= entryPrice) {
      console.warn(
        `[alpaca] [ALERT] SKIPPED ${ticker} — invalid T1 for short: t1=${t1Price} >= entry=${entryPrice}`
      );
      return Response.json({ skipped: true, reason: "Invalid T1 price (short)", ticker });
    }

    // Dedup: ticker only — prevents submitting both long and short on same symbol
    const isDuplicate = await alreadySubmittedToday(ticker);
    if (isDuplicate) {
      console.log(`[alpaca] [ALERT] SKIPPED ${ticker} — already submitted today`);
      return Response.json({ skipped: true, reason: "Already submitted today", ticker });
    }

    // [ISSUE 10A] Duplicate live position check — skip if Alpaca already holds this symbol
    try {
      const existingPosition = await getPosition(ticker);
      if (existingPosition) {
        console.warn(
          `[alpaca] [ALERT] SKIPPED ${ticker} — live position already exists on Alpaca (qty=${existingPosition.qty})`
        );
        return Response.json({ skipped: true, reason: "Live position already exists", ticker });
      }
    } catch (posErr) {
      // Non-critical: if position check fails, proceed with submission
      console.warn(`[alpaca] [${timestamp}] ${ticker} position check warning: ${posErr}`);
    }

    // Position sizing: risk-based, capped at MAX_NOTIONAL
    const byRisk = Math.floor(RISK_DOLLARS / stopDistance);
    const byNotional = Math.floor(MAX_NOTIONAL / entryPrice);
    const totalShares = Math.min(byRisk, byNotional);

    if (totalShares === 0) {
      console.warn(
        `[alpaca] [ALERT] SKIPPED ${ticker} — 0 shares calculated (stopDistance=${stopDistance.toFixed(4)}, entryPrice=${entryPrice})`
      );
      return Response.json({ skipped: true, reason: "0 shares calculated", ticker });
    }

    const t1Qty = Math.max(Math.floor(totalShares / 2), 1); // at least 1 share
    const phase2Qty = totalShares - t1Qty;

    // [ISSUE 10B] Check market clock — queue if closed instead of submitting
    let isMarketOpen = false;
    try {
      const clock = await getClock();
      isMarketOpen = clock.is_open;
    } catch (clockErr) {
      // If clock check fails, assume market open (cron has its own guard)
      console.warn(`[alpaca] [${timestamp}] ${ticker} clock check failed, assuming open: ${clockErr}`);
      isMarketOpen = true;
    }

    const tradeBase: AlpacaTrade = {
      tradeId: crypto.randomUUID(),
      ticker,
      direction,
      setupType,
      grade,
      entryPrice,
      stopPrice,
      t1Price,
      t2Price,
      totalShares,
      t1Qty,
      phase2Qty,
      primaryOrderId: "",
      t1OrderId: "",
      phase: 1,
      status: isMarketOpen ? "active" : "queued",
      marketRegime: marketRegime ?? null,
      submittedAt: timestamp,
      t1FilledAt: null,
      closedAt: null,
      outcome: "open",
      exitReason: null,
    };

    if (!isMarketOpen) {
      // Queue the trade — cron will submit at next open
      await addTrade(tradeBase);
      console.log(
        `[alpaca] [ALERT] QUEUED ${ticker} — market closed, will submit at next open | ${direction.toUpperCase()} ${t1Qty}+${phase2Qty} shares @ ${entryPrice.toFixed(2)} | regime=${marketRegime ?? "unknown"}`
      );
      return Response.json({ queued: true, tradeId: tradeBase.tradeId, ticker });
    }

    // Submit bracket for t1Qty shares: entry limit (GTC) + stop loss + T1 take profit.
    // Bracket legs' sides are automatic — Alpaca infers them from the entry side:
    //   Long buy bracket:  stop_loss = sell (below entry), take_profit = sell (above entry)
    //   Short sell bracket: stop_loss = buy (above entry), take_profit = buy (below entry)
    // After T1 fills, the cron detects it and submits a GTC OCO for phase2Qty shares.
    const entrySide = direction === "long" ? "buy" : "sell";
    const bracketBody: Record<string, unknown> = {
      symbol: ticker,
      qty: String(t1Qty),
      side: entrySide,
      type: "limit",
      limit_price: String(entryPrice.toFixed(2)),
      time_in_force: "gtc",
      order_class: "bracket",
      stop_loss: {
        stop_price: String(stopPrice.toFixed(2)),
      },
      take_profit: {
        limit_price: String(t1Price.toFixed(2)),
      },
    };

    console.log(
      `[alpaca] [${timestamp}] Bracket payload for ${ticker}: ${JSON.stringify(bracketBody)}`
    );

    const bracketOrder = await submitOrder(bracketBody);

    console.log(
      `[alpaca] [${timestamp}] Bracket response for ${ticker}: ${JSON.stringify(bracketOrder)}`
    );

    const trade: AlpacaTrade = {
      ...tradeBase,
      primaryOrderId: bracketOrder.id,
      t1OrderId: bracketOrder.id, // bracket handles T1 internally via take_profit leg
    };

    await addTrade(trade);

    console.log(
      `[alpaca] [ALERT] SUBMITTED ${direction.toUpperCase()} ${ticker} — t1Qty=${t1Qty} phase2Qty=${phase2Qty} @ ${entryPrice.toFixed(2)} | stop ${stopPrice.toFixed(2)} | T1 ${t1Price.toFixed(2)} | T2 ${t2Price.toFixed(2)} | regime=${marketRegime ?? "unknown"} [bracket GTC]`
    );

    return Response.json({ success: true, tradeId: trade.tradeId, ticker });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // 422 = untradeable asset (not shortable, delisted, not found, etc.) — skip gracefully
    if (message.includes("Alpaca API 422:")) {
      console.warn(`[alpaca] [ALERT] SKIPPED ${ticker} — untradeable: ${message}`);
      return Response.json({ skipped: true, reason: "Untradeable asset", ticker });
    }

    // Buying power exhausted — account is full, skip cleanly (not an error)
    if (message.includes("insufficient buying power")) {
      console.warn(`[alpaca] [ALERT] SKIPPED ${ticker} — insufficient buying power`);
      return Response.json({ skipped: true, reason: "Insufficient buying power", ticker });
    }

    console.error(`[alpaca] [${timestamp}] submit-trade error: ${message}`);
    return Response.json({ error: message, success: false }, { status: 200 });
  }
}
