// =============================================================================
// ALPACA TRADE PERSISTENCE — Vercel KV (Upstash Redis)
// TODO: @vercel/kv is deprecated; migrate to @upstash/redis when upgrading.
//
// @vercel/kv requires KV_REST_API_URL + KV_REST_API_TOKEN.
// Vercel's storage integration may inject these under a different prefix
// (e.g. KVRESTSTORAGE_REDIS_URL / KVRESTSTORAGE_REDIS_TOKEN).
// createClient lets us pass the URL/token explicitly with a fallback chain.
// =============================================================================

import { createClient } from "@vercel/kv";
import type { AlpacaTrade } from "@/types/alpaca";

const kv = createClient({
  url:
    process.env.KV_REST_API_URL ??
    process.env.KVRESTSTORAGE_REDIS_URL ??
    "",
  token:
    process.env.KV_REST_API_TOKEN ??
    process.env.KVRESTSTORAGE_REDIS_TOKEN ??
    "",
});

const TRADES_KEY = "alpaca:trades";

// Read all stored trades. Returns [] if KV is empty or unreachable.
export async function getTrades(): Promise<AlpacaTrade[]> {
  try {
    const trades = await kv.get<AlpacaTrade[]>(TRADES_KEY);
    return trades ?? [];
  } catch {
    return [];
  }
}

// Overwrite the full trades list.
export async function saveTrades(trades: AlpacaTrade[]): Promise<void> {
  await kv.set(TRADES_KEY, trades);
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
