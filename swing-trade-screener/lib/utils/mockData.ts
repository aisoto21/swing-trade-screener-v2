import type { OHLCVBar } from "@/types";
import type { Timeframe } from "@/types";

// Approximate real-world base prices so mock data looks plausible
const MOCK_BASE_PRICES: Record<string, number> = {
  AAPL: 215, MSFT: 415, GOOGL: 175, GOOG: 175, AMZN: 195, NVDA: 110,
  META: 595, TSLA: 240, BRK_B: 455, LLY: 835, V: 330, JPM: 255,
  UNH: 490, XOM: 110, WMT: 95, MA: 530, JNJ: 155, PG: 165, HD: 385,
  AVGO: 185, COST: 930, ABBV: 185, MRK: 125, CVX: 155, BAC: 44,
  NFLX: 985, KO: 69, PEP: 145, TMO: 490, ACN: 295, AMD: 115,
  MCD: 285, ABT: 125, PM: 130, CRM: 285, CSCO: 60, GE: 195,
  CAT: 345, IBM: 245, GS: 545, ORCL: 165, INTU: 615, AXP: 275,
  SPGI: 495, BLK: 1015, ISRG: 495, NOW: 1015, UBER: 80, DIS: 110,
  QCOM: 155, TXN: 165, AMAT: 145, HON: 205, LOW: 235, NEE: 65,
  UPS: 125, RTX: 125, AMGN: 295, DE: 395, SBUX: 95, C: 68,
  BMY: 52, SCHW: 82, PLD: 115, AMT: 195, SO: 88, DUK: 105,
  MMC: 235, AON: 395, ZTS: 185, BSX: 88, REGN: 780, VRTX: 480,
  PANW: 185, SNPS: 485, CDNS: 285, FTNT: 95, KLAC: 715, LRCX: 695,
  MRVL: 68, MU: 95, INTC: 22, HPQ: 35, DELL: 115, F: 10,
  GM: 48, BA: 165, GD: 285, LMT: 455, NOC: 455, ROP: 585,
  ITW: 245, EMR: 105, ETN: 305, PH: 675, CMI: 335, DOV: 195,
  SPY: 565, QQQ: 480, IWM: 205, VIX: 20,
};

/**
 * Generate realistic mock OHLCV data for offline development and testing.
 * Uses per-ticker base prices so values look plausible even without a live API.
 */
export function generateMockOHLCV(
  ticker: string,
  timeframe: Timeframe,
  bars: number,
  basePrice?: number,
  trend: "up" | "down" | "sideways" = "up"
): OHLCVBar[] {
  const startPrice = basePrice ?? MOCK_BASE_PRICES[ticker] ?? 100;
  const result: OHLCVBar[] = [];
  let price = startPrice;
  const now = new Date();
  const msPerBar =
    timeframe === "1D"
      ? 24 * 60 * 60 * 1000
      : timeframe === "4H"
      ? 4 * 60 * 60 * 1000
      : 15 * 60 * 1000;

  for (let i = bars - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * msPerBar);
    const volatility = 0.02;
    const drift =
      trend === "up" ? 0.001 : trend === "down" ? -0.001 : 0;
    const change = (Math.random() - 0.5) * 2 * volatility + drift;
    price = price * (1 + change);
    const open = price;
    const high = price * (1 + Math.random() * volatility * 0.5);
    const low = price * (1 - Math.random() * volatility * 0.5);
    const close = low + (high - low) * Math.random();
    const volume = Math.floor(1_000_000 + Math.random() * 2_000_000);

    result.push({
      date: date.toISOString(),
      open,
      high: Math.max(high, open, close),
      low: Math.min(low, open, close),
      close,
      volume,
    });
  }

  return result;
}
