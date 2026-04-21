// =============================================================================
// ALPACA TRADE PERSISTENCE — ioredis (TCP Redis)
// Uses KVRESTSTORAGE_REDIS_URL injected by Vercel's Redis integration.
// ioredis accepts redis:// and rediss:// connection strings, unlike @vercel/kv
// which requires an Upstash HTTP REST URL (https://).
// =============================================================================

import Redis from "ioredis";
import type { AlpacaTrade } from "@/types/alpaca";

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

// Dedup check: has this ticker+direction+setupType already been submitted today?
export async function alreadySubmittedToday(
  ticker: string,
  direction: "long" | "short",
  setupType: string
): Promise<boolean> {
  const trades = await getTrades();
  const todayPrefix = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  return trades.some(
    (t) =>
      t.ticker === ticker &&
      t.direction === direction &&
      t.setupType === setupType &&
      t.submittedAt.startsWith(todayPrefix)
  );
}
