import type { RSIData } from "@/types";
import type { MACDData } from "@/types";
import { RSI_OVERBOUGHT, RSI_OVERSOLD } from "@/constants/indicators";

/**
 * Momentum score 0-100 (higher = stronger bullish momentum for longs)
 */
export function momentumScore(rsi: RSIData, macd: MACDData, bias: "LONG" | "SHORT"): number {
  let score = 50;

  const lastRsi = rsi.values[rsi.values.length - 1];
  if (!isNaN(lastRsi)) {
    if (bias === "LONG") {
      if (rsi.oversold) score += 15;
      else if (lastRsi < 40) score += 10;
      else if (lastRsi < 50) score += 5;
      else if (lastRsi > RSI_OVERBOUGHT) score -= 10;
      if (rsi.divergence === "bullish") score += 10;
      if (rsi.divergence === "bearish") score -= 20;
    } else {
      if (rsi.overbought) score += 15;
      else if (lastRsi > 60) score += 10;
      else if (lastRsi > 50) score += 5;
      else if (lastRsi < RSI_OVERSOLD) score -= 10;
      if (rsi.divergence === "bearish") score += 10;
      if (rsi.divergence === "bullish") score -= 20;
    }
  }

  if (bias === "LONG") {
    if (macd.crossover === "bullish") score += 15;
    if (macd.zeroLineCross === "bullish") score += 10;
    const lastHist = macd.histogram[macd.histogram.length - 1];
    if (!isNaN(lastHist) && lastHist > 0) score += 5;
  } else {
    if (macd.crossover === "bearish") score += 15;
    if (macd.zeroLineCross === "bearish") score += 10;
    const lastHist = macd.histogram[macd.histogram.length - 1];
    if (!isNaN(lastHist) && lastHist < 0) score += 5;
  }

  return Math.max(0, Math.min(100, score));
}
