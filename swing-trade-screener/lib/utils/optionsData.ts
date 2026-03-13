/**
 * Unified options data client — swap data source here only, nothing else changes.
 * Primary: yahoo-finance2 (free)
 * Upgrade: Tradier (when TRADIER_API_KEY is set)
 */

import type { OptionsChain, OptionsContract } from "@/types";

const SOURCE = process.env.TRADIER_API_KEY ? "tradier" : "yahoo";

function toOptionsContract(
  strike: number,
  exp: string,
  type: "call" | "put",
  raw: { bid?: number; ask?: number; last?: number; volume?: number; openInterest?: number; impliedVolatility?: number; greeks?: { delta?: number; gamma?: number; theta?: number; vega?: number } }
): OptionsContract {
  return {
    strike,
    expiration: exp,
    type,
    bid: raw.bid ?? 0,
    ask: raw.ask ?? 0,
    last: raw.last ?? (raw.bid && raw.ask ? (raw.bid + raw.ask) / 2 : 0),
    volume: raw.volume ?? 0,
    openInterest: raw.openInterest ?? 0,
    impliedVolatility: raw.impliedVolatility,
    delta: raw.greeks?.delta,
    gamma: raw.greeks?.gamma,
    theta: raw.greeks?.theta,
    vega: raw.greeks?.vega,
  };
}

async function fetchYahooChain(
  ticker: string,
  expiration?: string
): Promise<OptionsChain | null> {
  try {
    const yf = await import("yahoo-finance2").then((m) => m.default);
    const opts = (yf as { options?: (symbol: string, opts?: { date?: string }) => Promise<unknown> }).options;
    if (!opts) return null;

    const data = await opts(ticker, expiration ? { date: expiration } : undefined) as {
      expirationDates?: number[];
      strikes?: number[];
      call?: Record<string, { bid?: number; ask?: number; last?: number; volume?: number; openInterest?: number; impliedVolatility?: number; greeks?: { delta?: number; gamma?: number; theta?: number; vega?: number } }>;
      put?: Record<string, { bid?: number; ask?: number; last?: number; volume?: number; openInterest?: number; impliedVolatility?: number; greeks?: { delta?: number; gamma?: number; theta?: number; vega?: number } }>;
      quote?: { regularMarketPrice?: number };
    };

    if (!data) return null;

    const expDates = data.expirationDates ?? [];
    const strikes = data.strikes ?? [];
    const underlyingPrice = data.quote?.regularMarketPrice ?? 0;

    const calls: OptionsContract[] = [];
    const puts: OptionsContract[] = [];

    const expStr = expDates[0] ? new Date(expDates[0] * 1000).toISOString().slice(0, 10) : "";

    for (const strike of strikes) {
      const callKey = `${strike}`;
      const putKey = `${strike}`;
      const callData = (data.call as Record<string, unknown>)?.[callKey] as Record<string, unknown> | undefined;
      const putData = (data.put as Record<string, unknown>)?.[putKey] as Record<string, unknown> | undefined;
      if (callData) {
        calls.push(
          toOptionsContract(strike, expStr, "call", callData as Parameters<typeof toOptionsContract>[4])
        );
      }
      if (putData) {
        puts.push(
          toOptionsContract(strike, expStr, "put", putData as Parameters<typeof toOptionsContract>[4])
        );
      }
    }

    return {
      ticker,
      underlyingPrice,
      expirations: expDates.map((d) => new Date(d * 1000).toISOString().slice(0, 10)),
      calls,
      puts,
    };
  } catch {
    return null;
  }
}

async function fetchTradierChain(
  ticker: string,
  expiration?: string
): Promise<OptionsChain | null> {
  const apiKey = process.env.TRADIER_API_KEY;
  if (!apiKey) return null;

  try {
    const base = process.env.TRADIER_SANDBOX === "true" ? "https://sandbox.tradier.com" : "https://api.tradier.com";
    const url = expiration
      ? `${base}/v1/markets/options/chains?symbol=${ticker}&expiration=${expiration}`
      : `${base}/v1/markets/options/chains?symbol=${ticker}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      options?: { option?: Array<{
        symbol: string;
        strike: number;
        expiration_date: string;
        option_type: string;
        bid: number;
        ask: number;
        last: number;
        volume: number;
        open_interest: number;
        greeks?: { delta?: number; gamma?: number; theta?: number; vega?: number };
        implied_volatility?: number;
      }> };
      underlying?: { last?: number };
    };

    const options = data.options?.option ?? [];
    const underlyingPrice = data.underlying?.last ?? 0;
    const expirations = [...new Set(options.map((o) => o.expiration_date))];

    const calls: OptionsContract[] = [];
    const puts: OptionsContract[] = [];

    for (const o of options) {
      const c: OptionsContract = {
        strike: o.strike,
        expiration: o.expiration_date,
        type: o.option_type === "call" ? "call" : "put",
        bid: o.bid,
        ask: o.ask,
        last: o.last,
        volume: o.volume,
        openInterest: o.open_interest,
        impliedVolatility: o.implied_volatility,
        delta: o.greeks?.delta,
        gamma: o.greeks?.gamma,
        theta: o.greeks?.theta,
        vega: o.greeks?.vega,
      };
      if (c.type === "call") calls.push(c);
      else puts.push(c);
    }

    return { ticker, underlyingPrice, expirations, calls, puts };
  } catch {
    return null;
  }
}

export async function getOptionsChain(
  ticker: string,
  expiration?: string
): Promise<OptionsChain | null> {
  return SOURCE === "tradier"
    ? fetchTradierChain(ticker, expiration)
    : fetchYahooChain(ticker, expiration);
}

export async function getGreeks(
  ticker: string,
  strike: number,
  expiration: string,
  type: "call" | "put"
): Promise<{ delta: number; theta: number; vega: number; gamma: number } | null> {
  const chain = await getOptionsChain(ticker, expiration);
  if (!chain) return null;

  const contracts = type === "call" ? chain.calls : chain.puts;
  const contract = contracts.find(
    (c) => c.strike === strike && c.expiration === expiration
  );
  if (!contract) return null;

  const iv = contract.impliedVolatility ?? 0.3;
  const { getDelta, getTheta, getVega, getGamma } = await import("@/lib/options/greeks");
  const dte = Math.ceil((new Date(expiration).getTime() - Date.now()) / 86400000);

  return {
    delta: contract.delta ?? getDelta(strike, chain.underlyingPrice, dte, iv, type),
    theta: contract.theta ?? getTheta(strike, chain.underlyingPrice, dte, iv, type),
    vega: contract.vega ?? getVega(strike, chain.underlyingPrice, dte, iv, type),
    gamma: contract.gamma ?? getGamma(strike, chain.underlyingPrice, dte, iv, type),
  };
}

export function getOptionsDataSource(): "yahoo" | "tradier" {
  return SOURCE === "tradier" ? "tradier" : "yahoo";
}
