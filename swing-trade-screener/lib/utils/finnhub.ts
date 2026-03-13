/**
 * Finnhub API client - analyst ratings, earnings calendar, real-time quotes
 * Rate limited to 60 calls/minute for free tier
 */

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const RATE_LIMIT_CALLS = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

interface RateLimiter {
  timestamps: number[];
}

const rateLimiter: RateLimiter = {
  timestamps: [],
};

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  rateLimiter.timestamps = rateLimiter.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (rateLimiter.timestamps.length >= RATE_LIMIT_CALLS) {
    const oldest = rateLimiter.timestamps[0];
    const waitMs = RATE_LIMIT_WINDOW_MS - (now - oldest) + 100;
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, waitMs));
      return waitForRateLimit();
    }
  }
  rateLimiter.timestamps.push(Date.now());
}

export interface FinnhubQuote {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

export interface FinnhubRecommendation {
  buy: number;
  hold: number;
  period: string;
  sell: number;
  strongBuy: number;
  strongSell: number;
}

export interface FinnhubEarningsEvent {
  actual: number | null;
  estimate: number | null;
  period: string;
  quarter: number;
  surprise: number | null;
  surprisePercent: number | null;
  symbol: string;
  year: number;
}

async function fetchFinnhub<T>(path: string): Promise<T | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;

  await waitForRateLimit();

  try {
    const res = await fetch(`${FINNHUB_BASE}${path}`, {
      headers: { "X-Finnhub-Token": apiKey },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Get real-time quote (last price, change, etc.)
 */
export async function getQuote(ticker: string): Promise<FinnhubQuote | null> {
  return fetchFinnhub<FinnhubQuote>(`/quote?symbol=${encodeURIComponent(ticker)}`);
}

/**
 * Get analyst recommendations (buy/hold/sell counts)
 */
export async function getRecommendations(ticker: string): Promise<FinnhubRecommendation[] | null> {
  const data = await fetchFinnhub<FinnhubRecommendation[]>(
    `/stock/recommendation?symbol=${encodeURIComponent(ticker)}`
  );
  return Array.isArray(data) ? data : null;
}

/**
 * Get earnings calendar for a ticker
 */
export async function getEarningsCalendar(ticker: string): Promise<FinnhubEarningsEvent[] | null> {
  const from = new Date();
  const to = new Date();
  to.setMonth(to.getMonth() + 3);
  const data = await fetchFinnhub<{ earningsCalendar?: FinnhubEarningsEvent[] }>(
    `/calendar/earnings?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}&symbol=${encodeURIComponent(ticker)}`
  );
  return data?.earningsCalendar ?? null;
}
