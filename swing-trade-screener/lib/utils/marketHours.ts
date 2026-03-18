import { getQuote } from "@/lib/utils/finnhub";

export interface PreMarketContext {
  preMarketPrice?: number;
  preMarketChange?: number;
  preMarketVolume?: number;
  hasSignificantGap: boolean;
  gapDirection: "up" | "down" | "flat";
}

/**
 * Get pre-market context from Finnhub quote.
 * c = current/last, pc = previous close.
 * Before market open, c reflects pre-market price.
 */
export async function getPreMarketContext(
  ticker: string
): Promise<PreMarketContext | null> {
  try {
    const quote = await getQuote(ticker);
    if (!quote || !quote.pc || quote.pc === 0) return null;

    const current = quote.c ?? quote.o ?? quote.pc;
    const prevClose = quote.pc;
    const changePct = ((current - prevClose) / prevClose) * 100;

    const hasSignificantGap = Math.abs(changePct) > 2;
    const gapDirection: "up" | "down" | "flat" =
      changePct > 0.5 ? "up" : changePct < -0.5 ? "down" : "flat";

    return {
      preMarketPrice: current,
      preMarketChange: changePct,
      hasSignificantGap,
      gapDirection,
    };
  } catch {
    return null;
  }
}

/**
 * Check if we're before market open or in first hour (Eastern).
 * Pre-market: 4:00–9:30 ET. First hour: 9:30–10:30 ET.
 */
export function isPreMarketOrFirstHour(): boolean {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const etMins = hour * 60 + minute;

  const preMarketStart = 4 * 60;
  const firstHourEnd = 10 * 60 + 30;

  return etMins >= preMarketStart && etMins < firstHourEnd;
}
