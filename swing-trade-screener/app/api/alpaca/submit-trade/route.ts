// =============================================================================
// POST /api/alpaca/submit-trade
// Receives a ScreenerResult, calculates position sizing, deduplicates,
// and submits a single bracket order (entry limit + stop loss + T1 take profit).
//
// Fixes applied:
//   1. MAX_NOTIONAL cap prevents absurdly large positions from tight stops
//   2. Bracket order replaces OTO + separate T1 — avoids "held for orders" block
//   3. "cannot be sold short" caught as a skip, not an error
//   4. Dedup checks ticker only (any direction) to prevent long/short conflict
// =============================================================================

import { NextRequest } from "next/server";
import type { ScreenerResult } from "@/types";
import type { AlpacaTrade } from "@/types/alpaca";
import { submitOrder } from "@/lib/alpaca/client";
import { addTrade, alreadySubmittedToday } from "@/lib/alpaca/trades";

const RISK_DOLLARS = 1000;  // 1% of $100k account
const MAX_NOTIONAL = 10000; // hard cap per position — $10k × 10 = $100k max exposure

interface SubmitTradeBody {
  result: ScreenerResult;
}

export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString();
  let ticker = "UNKNOWN";

  try {
    const body: SubmitTradeBody = await req.json();
    const { result } = body;

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

    // Validate stop distance (catches inverted stops and zero-distance setups)
    const stopDistance =
      direction === "long"
        ? entryPrice - stopPrice
        : stopPrice - entryPrice;

    if (stopDistance <= 0) {
      console.warn(
        `[alpaca] [${timestamp}] Skipping ${ticker} — invalid stop distance: entry=${entryPrice} stop=${stopPrice}`
      );
      return Response.json({ skipped: true, reason: "Invalid stop distance", ticker });
    }

    // Dedup: ticker only — prevents submitting both long and short on same symbol
    const isDuplicate = await alreadySubmittedToday(ticker);
    if (isDuplicate) {
      return Response.json({ skipped: true, reason: "Already submitted today", ticker });
    }

    // Position sizing: risk-based, capped at MAX_NOTIONAL
    const byRisk = Math.floor(RISK_DOLLARS / stopDistance);
    const byNotional = Math.floor(MAX_NOTIONAL / entryPrice);
    const totalShares = Math.min(byRisk, byNotional);

    if (totalShares === 0) {
      console.warn(
        `[alpaca] [${timestamp}] Skipping ${ticker} — 0 shares calculated (stopDistance=${stopDistance.toFixed(4)}, entryPrice=${entryPrice})`
      );
      return Response.json({ skipped: true, reason: "0 shares calculated", ticker });
    }

    const t1Qty = Math.floor(totalShares / 2);
    const phase2Qty = totalShares - t1Qty;

    // Submit single bracket order: entry limit + stop loss + T1 take profit.
    // Bracket keeps all legs atomic — no "held for orders" conflict with a
    // separate T1 sell, which was the failure mode of the prior OTO approach.
    const entrySide = direction === "long" ? "buy" : "sell";
    const bracketBody: Record<string, unknown> = {
      symbol: ticker,
      qty: String(totalShares),
      side: entrySide,
      type: "limit",
      limit_price: String(entryPrice.toFixed(2)),
      time_in_force: "day",
      order_class: "bracket",
      stop_loss: {
        stop_price: String(stopPrice.toFixed(2)),
      },
      take_profit: {
        limit_price: String(t1Price.toFixed(2)),
      },
    };

    const bracketOrder = await submitOrder(bracketBody);

    const trade: AlpacaTrade = {
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
      primaryOrderId: bracketOrder.id,
      t1OrderId: bracketOrder.id, // bracket handles T1 internally
      phase: 1,
      submittedAt: timestamp,
      t1FilledAt: null,
      closedAt: null,
      outcome: "open",
    };

    await addTrade(trade);

    console.log(
      `[alpaca] [${timestamp}] Submitted ${direction.toUpperCase()} ${ticker} — ${totalShares} shares @ ${entryPrice.toFixed(2)} | stop ${stopPrice.toFixed(2)} | T1 ${t1Price.toFixed(2)} [bracket]`
    );

    return Response.json({ success: true, tradeId: trade.tradeId, ticker });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // 422 = untradeable asset (not shortable, delisted, not found, etc.) — skip gracefully
    if (message.includes("Alpaca API 422:")) {
      console.warn(`[alpaca] [${timestamp}] Skipping ${ticker} — untradeable: ${message}`);
      return Response.json({ skipped: true, reason: "Untradeable asset", ticker });
    }

    // Buying power exhausted — account is full, skip cleanly (not an error)
    if (message.includes("insufficient buying power")) {
      console.warn(`[alpaca] [${timestamp}] Skipping ${ticker} — insufficient buying power`);
      return Response.json({ skipped: true, reason: "Insufficient buying power", ticker });
    }

    console.error(`[alpaca] [${timestamp}] submit-trade error: ${message}`);
    return Response.json({ error: message, success: false }, { status: 200 });
  }
}
