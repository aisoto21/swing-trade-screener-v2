import type { OHLCVBar } from "@/types";
import type { MarketRegime, MarketRegimeResult } from "@/types";
import { sma } from "@/lib/indicators/sma";
import { rsi } from "@/lib/indicators/rsi";

/**
 * Detect if price is making lower highs and lower lows
 */
function isConfirmedDowntrend(bars: OHLCVBar[], lookback: number = 20): boolean {
  if (bars.length < lookback) return false;
  const slice = bars.slice(-lookback);
  const highs = slice.map((b) => b.high);
  const lows = slice.map((b) => b.low);

  let lowerHighs = 0;
  let lowerLows = 0;
  for (let i = 1; i < slice.length; i++) {
    if (highs[i] < highs[i - 1]) lowerHighs++;
    if (lows[i] < lows[i - 1]) lowerLows++;
  }
  return lowerHighs >= lookback * 0.5 && lowerLows >= lookback * 0.5;
}

/**
 * Market regime classification based on SPY/QQQ
 */
export function detectMarketRegime(spyBars: OHLCVBar[]): MarketRegimeResult {
  const closes = spyBars.map((b) => b.close);
  const sma50Values = sma(closes, 50);
  const sma200Values = sma(closes, 200);
  const rsiValues = rsi(closes, 14);

  const lastIdx = spyBars.length - 1;
  const price = closes[lastIdx] ?? 0;
  const s50 = sma50Values[lastIdx];
  const s200 = sma200Values[lastIdx];
  const rsiVal = rsiValues[lastIdx];

  const spyAbove50SMA = !isNaN(s50) && price > s50;
  const spyAbove200SMA = !isNaN(s200) && price > s200;
  const spyRSIAbove50 = !isNaN(rsiVal) && rsiVal > 50;
  const spyConfirmedDowntrend = isConfirmedDowntrend(spyBars);

  let regime: MarketRegime = "Choppy/Sideways";

  if (spyAbove50SMA && spyAbove200SMA && spyRSIAbove50) {
    regime = "Bull Market";
  } else if (!spyAbove50SMA && !spyAbove200SMA && !spyRSIAbove50 && spyConfirmedDowntrend) {
    regime = "Bear Market";
  } else if (!spyAbove50SMA && !spyAbove200SMA && spyRSIAbove50) {
    regime = "Accumulation";
  } else if (spyAbove50SMA && spyAbove200SMA && !spyRSIAbove50) {
    regime = "Distribution";
  }

  return {
    regime,
    spyAbove50SMA,
    spyAbove200SMA,
    spyRSIAbove50,
    spyConfirmedDowntrend,
    timestamp: new Date().toISOString(),
  };
}
