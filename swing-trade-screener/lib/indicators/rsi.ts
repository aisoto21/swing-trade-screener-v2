import type { OHLCVBar } from "@/types";
import type { RSIData } from "@/types";
import { RSI_PERIOD, RSI_OVERBOUGHT, RSI_OVERSOLD } from "@/constants/indicators";

/**
 * Relative Strength Index
 */
export function rsi(closes: number[], period: number = RSI_PERIOD): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(NaN);
    } else {
      let gains = 0;
      let losses = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const change = closes[j] - closes[j - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
      }
    }
  }
  return result;
}

/**
 * RSI with overbought/oversold and divergence detection
 */
export function rsiFull(bars: OHLCVBar[], period: number = RSI_PERIOD): RSIData {
  const closes = bars.map((b) => b.close);
  const values = rsi(closes, period);
  const lastIdx = values.length - 1;
  const lastValue = values[lastIdx];

  let divergence: "bullish" | "bearish" | null = null;
  if (lastIdx >= 20) {
    const priceHigh5 = Math.max(...closes.slice(lastIdx - 5, lastIdx + 1));
    const priceLow5 = Math.min(...closes.slice(lastIdx - 5, lastIdx + 1));
    const rsiHigh5 = Math.max(...values.slice(lastIdx - 5, lastIdx + 1).filter((v) => !isNaN(v)));
    const rsiLow5 = Math.min(...values.slice(lastIdx - 5, lastIdx + 1).filter((v) => !isNaN(v)));
    const pricePrevHigh = Math.max(...closes.slice(lastIdx - 15, lastIdx - 5));
    const pricePrevLow = Math.min(...closes.slice(lastIdx - 15, lastIdx - 5));
    const rsiPrevHigh = Math.max(...values.slice(lastIdx - 15, lastIdx - 5).filter((v) => !isNaN(v)));
    const rsiPrevLow = Math.min(...values.slice(lastIdx - 15, lastIdx - 5).filter((v) => !isNaN(v)));

    if (priceHigh5 > pricePrevHigh && rsiHigh5 < rsiPrevHigh && lastValue < 70) {
      divergence = "bearish";
    } else if (priceLow5 < pricePrevLow && rsiLow5 > rsiPrevLow && lastValue > 30) {
      divergence = "bullish";
    }
  }

  return {
    values,
    overbought: !isNaN(lastValue) && lastValue >= RSI_OVERBOUGHT,
    oversold: !isNaN(lastValue) && lastValue <= RSI_OVERSOLD,
    divergence,
  };
}
