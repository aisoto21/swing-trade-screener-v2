// =============================================================================
// ALPACA REST API CLIENT — SERVER-SIDE ONLY
// Never import this from client components.
// Credentials: ALPACA_API_KEY, ALPACA_API_SECRET, ALPACA_BASE_URL (env)
// Default base URL: https://paper-api.alpaca.markets
// =============================================================================

import type {
  AlpacaOrderResponse,
  AlpacaPosition,
  AlpacaAccount,
  AlpacaClock,
} from "@/types/alpaca";

function getBaseUrl(): string {
  return process.env.ALPACA_BASE_URL ?? "https://paper-api.alpaca.markets";
}

function getHeaders(): HeadersInit {
  return {
    "APCA-API-KEY-ID": process.env.ALPACA_API_KEY ?? "",
    "APCA-API-SECRET-KEY": process.env.ALPACA_API_SECRET ?? "",
    "Content-Type": "application/json",
  };
}

async function alpacaFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...getHeaders(), ...(options?.headers ?? {}) },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Alpaca API ${res.status}: ${body}`);
  }

  // 204 No Content (e.g. cancel order success)
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// Submit a new order.
// body follows Alpaca v2 order payload shape.
export async function submitOrder(
  body: Record<string, unknown>
): Promise<AlpacaOrderResponse> {
  return alpacaFetch<AlpacaOrderResponse>("/v2/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Get a single order by ID.
export async function getOrder(orderId: string): Promise<AlpacaOrderResponse> {
  return alpacaFetch<AlpacaOrderResponse>(`/v2/orders/${orderId}`);
}

// Cancel an order by ID. Returns undefined on success (204).
export async function cancelOrder(orderId: string): Promise<void> {
  await alpacaFetch<void>(`/v2/orders/${orderId}`, { method: "DELETE" });
}

// Fetch all open positions.
// Alpaca returns 404 when the account has no open positions — treat as empty array.
export async function getPositions(): Promise<AlpacaPosition[]> {
  const url = `${getBaseUrl()}/v2/positions`;
  const res = await fetch(url, { headers: getHeaders() });
  if (res.status === 404) return [];
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Alpaca API ${res.status}: ${body}`);
  }
  return res.json() as Promise<AlpacaPosition[]>;
}

// Fetch a single position by symbol. Returns null if no position exists (404).
export async function getPosition(symbol: string): Promise<AlpacaPosition | null> {
  const url = `${getBaseUrl()}/v2/positions/${symbol}`;
  const res = await fetch(url, { headers: getHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Alpaca API ${res.status}: ${body}`);
  }
  return res.json() as Promise<AlpacaPosition>;
}

// Fetch account info.
export async function getAccount(): Promise<AlpacaAccount> {
  return alpacaFetch<AlpacaAccount>("/v2/account");
}

// Fetch market clock — is_open, next_open, next_close.
export async function getClock(): Promise<AlpacaClock> {
  return alpacaFetch<AlpacaClock>("/v2/clock");
}

export interface AlpacaAsset {
  id: string;
  symbol: string;
  status: string;    // "active" | "inactive"
  tradable: boolean;
  shortable: boolean;
}

// Check if an asset is active and tradable on Alpaca.
export async function getAsset(symbol: string): Promise<AlpacaAsset> {
  return alpacaFetch<AlpacaAsset>(`/v2/assets/${symbol}`);
}
