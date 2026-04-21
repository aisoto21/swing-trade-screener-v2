// GET /api/alpaca/trades
// Returns all stored AlpacaTrade records from KV for the Auto Testing tab.

import { getTrades } from "@/lib/alpaca/trades";

export async function GET() {
  try {
    const trades = await getTrades();
    return Response.json({ trades });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[alpaca] trades GET error: ${message}`);
    return Response.json({ trades: [], error: message }, { status: 200 });
  }
}
