// GET /api/alpaca/positions
// Returns current open positions from Alpaca for live P&L in the UI.
// Falls back to empty array if Alpaca is unreachable.

import { getPositions } from "@/lib/alpaca/client";

export async function GET() {
  try {
    const positions = await getPositions();
    return Response.json({ positions });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[alpaca] positions GET error: ${message}`);
    // Graceful fallback — UI will show entry price instead of current price
    return Response.json({ positions: [], error: message }, { status: 200 });
  }
}
