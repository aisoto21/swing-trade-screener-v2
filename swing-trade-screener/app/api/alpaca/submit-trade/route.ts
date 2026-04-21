// =============================================================================
// POST /api/alpaca/submit-trade
// Receives a ScreenerResult, calculates fixed-fractional position sizing,
// deduplicates, submits entry+stop (OTO) and T1 limit orders to Alpaca,
// persists the AlpacaTrade record to KV.
// =============================================================================

import { NextRequest } from "next/server";
import type { ScreenerResult } from "@/types";
import type { AlpacaTrade } from "@/types/alpaca";
import { submitOrder } from "@/lib/alpaca/client";
import { addTrade, alreadySubmittedToday } from "@/lib/alpaca/trades";

// Fixed fractional: $100k account, 1% risk = $1,000 per trade.
const RISK_DOLLARS = 1000;

interface SubmitTradeBody {
  result: ScreenerResult;
}

export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    const body: SubmitTradeBody = await req.json();
    const { result } = body;

    if (!result?.primarySetup?.tradeParams) {
      return Response.json({ error: "Invalid setup payload" }, { status: 400 });
    }

    const { primarySetup, ticker } = result;
    const { tradeParams } = primarySetup;

    const direction: "long" | "short" =
      primarySetup.bias === "LONG" ? "long" : "short";
    const setupType = primarySetup.name;
    const grade = primarySetup.grade;

    // Entry = high end of entry zone
    const entryPrice = tradeParams.entry.zone[1];
    const stopPrice = tradeParams.stop.price;
    const t1Price = tradeParams.targets.t1.price;
    const t2Price = tradeParams.targets.t2.price;

    // Validate stop distance
    const stopDistance =
      direction === "long"
        ? entryPrice - stopPrice
        : stopPrice - entryPrice;

    if (stopDistance <= 0 || entryPrice === stopPrice) {
      console.warn(
        `[alpaca] [${timestamp}] Skipping ${ticker} — invalid stop distance: entry=${entryPrice} stop=${stopPrice}`
      );
      return Response.json({
        skipped: true,
        reason: "Invalid stop distance",
        ticker,
      });
    }

    // Deduplicate
    const isDuplicate = await alreadySubmittedToday(ticker, direction, setupType);
    if (isDuplicate) {
      return Response.json({
        skipped: true,
        reason: "Already submitted today",
        ticker,
      });
    }

    // Fixed fractional position sizing
    const totalShares = Math.floor(RISK_DOLLARS / stopDistance);
    if (totalShares === 0) {
      console.warn(
        `[alpaca] [${timestamp}] Skipping ${ticker} — calculated 0 shares (stop distance: ${stopDistance.toFixed(4)})`
      );
      return Response.json({ skipped: true, reason: "0 shares calculated", ticker });
    }

    const t1Qty = Math.floor(totalShares / 2);
    const phase2Qty = totalShares - t1Qty;

    // --- Submit primary order: OTO (entry limit + stop loss leg) ---
    const entrySide = direction === "long" ? "buy" : "sell";
    const primaryBody: Record<string, unknown> = {
      symbol: ticker,
      qty: String(totalShares),
      side: entrySide,
      type: "limit",
      limit_price: String(entryPrice.toFixed(2)),
      time_in_force: "day",
      order_class: "oto",
      stop_loss: {
        stop_price: String(stopPrice.toFixed(2)),
      },
    };

    const primaryOrder = await submitOrder(primaryBody);

    // --- Submit T1 order: separate limit order (take-profit at T1) ---
    const t1Side = direction === "long" ? "sell" : "buy";
    const t1Body: Record<string, unknown> = {
      symbol: ticker,
      qty: String(t1Qty),
      side: t1Side,
      type: "limit",
      limit_price: String(t1Price.toFixed(2)),
      time_in_force: "day",
    };

    const t1Order = await submitOrder(t1Body);

    // --- Persist trade ---
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
      primaryOrderId: primaryOrder.id,
      t1OrderId: t1Order.id,
      phase: 1,
      submittedAt: timestamp,
      t1FilledAt: null,
      closedAt: null,
      outcome: "open",
    };

    await addTrade(trade);

    console.log(
      `[alpaca] [${timestamp}] Submitted ${direction.toUpperCase()} ${ticker} — ${totalShares} shares @ ${entryPrice} | stop ${stopPrice} | T1 ${t1Price} (${t1Qty} shares)`
    );

    return Response.json({ success: true, tradeId: trade.tradeId, ticker });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[alpaca] [${timestamp}] submit-trade error: ${message}`);
    // Do NOT return 500 — screener UI must not crash
    return Response.json({ error: message, success: false }, { status: 200 });
  }
}
