/**
 * IV History Tracker — stores 30-day ATM IV per ticker in Vercel KV
 * 252-trading-day rolling window for IV Rank and IV Percentile
 */

const KV_PREFIX = "iv:";
const MAX_DAYS = 252;

export async function getIVHistory(ticker: string): Promise<number[]> {
  const kv = await getKV();
  if (!kv) return [];

  try {
    const key = `${KV_PREFIX}${ticker}`;
    const data = await kv.get<{ values: number[]; dates: string[] }>(key);
    if (!data?.values) return [];

    const cutoff = Date.now() - MAX_DAYS * 86400000;
    const filtered: number[] = [];
    const dates = (data.dates ?? []) as string[];

    for (let i = 0; i < data.values.length; i++) {
      const ts = dates[i] ? new Date(dates[i]).getTime() : 0;
      if (ts >= cutoff) filtered.push(data.values[i]);
    }

    return filtered.sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export async function recordIV(
  ticker: string,
  iv: number,
  date: string
): Promise<void> {
  const kv = await getKV();
  if (!kv) return;

  try {
    const key = `${KV_PREFIX}${ticker}`;
    const existing = await kv.get<{ values: number[]; dates: string[] }>(key);
    const values = existing?.values ?? [];
    const dates = (existing?.dates ?? []) as string[];

    values.push(iv);
    dates.push(date);

    const cutoff = Date.now() - MAX_DAYS * 86400000;
    const filteredValues: number[] = [];
    const filteredDates: string[] = [];

    for (let i = 0; i < values.length; i++) {
      const ts = dates[i] ? new Date(dates[i]).getTime() : 0;
      if (ts >= cutoff) {
        filteredValues.push(values[i]);
        filteredDates.push(dates[i]);
      }
    }

    await kv.set(key, { values: filteredValues, dates: filteredDates });
  } catch {
    // KV not available
  }
}

async function getKV(): Promise<{ get: (key: string) => Promise<unknown>; set: (key: string, value: unknown) => Promise<void> } | null> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return {
      async get(key: string) {
        try {
          const res = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
            headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
          });
          if (!res.ok) return null;
          const text = await res.text();
          try {
            return JSON.parse(text) as unknown;
          } catch {
            return text ? { values: [parseFloat(text)], dates: [] } : null;
          }
        } catch {
          return null;
        }
      },
      async set(key: string, value: unknown) {
        try {
          await fetch(`${process.env.KV_REST_API_URL}/set/${key}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(value),
          });
        } catch {
          // ignore
        }
      },
    };
  }

  try {
    const mod = await import("@vercel/kv");
    return mod.kv ?? null;
  } catch {
    return null;
  }
}
