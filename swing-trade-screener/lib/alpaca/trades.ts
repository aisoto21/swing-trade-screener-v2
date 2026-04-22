// =============================================================================
// ALPACA TRADE PERSISTENCE — ioredis (TCP Redis)
// Uses KVRESTSTORAGE_REDIS_URL injected by Vercel's Redis integration.
// ioredis accepts redis:// and rediss:// connection strings, unlike @vercel/kv
// which requires an Upstash HTTP REST URL (https://).
// =============================================================================

import Redis from "ioredis";
import type { AlpacaTrade, DailySnapshot } from "@/types/alpaca";

// Module-level singleton — reused across warm invocations on the same instance.
// lazyConnect: true avoids connecting at module load time (safe for build phase).
const redis = new Redis(
  process.env.KVRESTSTORAGE_REDIS_URL ?? "redis://localhost:6379",
  {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
  }
);

const TRADES_KEY = "alpaca:trades";
const SNAPSHOTS_KEY = "alpaca:snapshots";

// Read all stored trades. Returns [] if key is empty or Redis is unreachable.
export async function getTrades(): Promise<AlpacaTrade[]> {
  try {
    const raw = await redis.get(TRADES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AlpacaTrade[];
  } catch {
    return [];
  }
}

// Overwrite the full trades list.
export async function saveTrades(trades: AlpacaTrade[]): Promise<void> {
  await redis.set(TRADES_KEY, JSON.stringify(trades));
}

// Get trades filtered by phase.
export async function getTradesByPhase(
  phase: AlpacaTrade["phase"]
): Promise<AlpacaTrade[]> {
  const trades = await getTrades();
  return trades.filter((t) => t.phase === phase);
}

// Append a new trade.
export async function addTrade(trade: AlpacaTrade): Promise<void> {
  const trades = await getTrades();
  trades.push(trade);
  await saveTrades(trades);
}

// Update a single trade by tradeId. Merges partial fields.
export async function updateTrade(
  tradeId: string,
  updates: Partial<AlpacaTrade>
): Promise<void> {
  const trades = await getTrades();
  const idx = trades.findIndex((t) => t.tradeId === tradeId);
  if (idx === -1) return;
  trades[idx] = { ...trades[idx], ...updates };
  await saveTrades(trades);
}

// Dedup check: has this ticker already been submitted today (any direction)?
// Checks ticker only to prevent long + short conflict on the same symbol.
export async function alreadySubmittedToday(ticker: string): Promise<boolean> {
  const trades = await getTrades();
  const todayPrefix = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  return trades.some(
    (t) => t.ticker === ticker && t.submittedAt.startsWith(todayPrefix)
  );
}

// =============================================================================
// DAILY SNAPSHOTS — equity curve persistence (ISSUE 10D)
// =============================================================================

// Read all stored daily snapshots. Returns [] on empty or error.
export async function getSnapshots(): Promise<DailySnapshot[]> {
  try {
    const raw = await redis.get(SNAPSHOTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DailySnapshot[];
  } catch {
    return [];
  }
}

// Upsert a daily snapshot by date. If date already exists, overwrites it.
export async function saveSnapshot(snapshot: DailySnapshot): Promise<void> {
  const snapshots = await getSnapshots();
  const idx = snapshots.findIndex((s) => s.date === snapshot.date);
  if (idx === -1) {
    snapshots.push(snapshot);
  } else {
    snapshots[idx] = snapshot;
  }
  // Keep last 90 days sorted ascending
  snapshots.sort((a, b) => a.date.localeCompare(b.date));
  if (snapshots.length > 90) snapshots.splice(0, snapshots.length - 90);
  await redis.set(SNAPSHOTS_KEY, JSON.stringify(snapshots));
}
