// =============================================================================
// GET /api/alpaca/snapshots
// Returns daily portfolio snapshots for the performance history chart.
// Populated by the cron job at market close each trading day.
// =============================================================================

export const dynamic = "force-dynamic";

import { getSnapshots } from "@/lib/alpaca/trades";

export async function GET() {
  try {
    const snapshots = await getSnapshots();
    return Response.json({ snapshots });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ snapshots: [], error: message });
  }
}
