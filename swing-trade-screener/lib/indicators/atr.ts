import type { OHLCVBar } from "@/types";

/**
 * Average True Range (Wilder's smoothing)
 *
 * True Range = max of:
 *   - Current High - Current Low
 *   - |Current High - Previous Close|
 *   - |Current Low  - Previous Close|
 *
 * Wilder's smoothing: ATR[i] = (ATR[i-1] * (period - 1) + TR[i]) / period
 */
export function atr(bars: OHLCVBar[], period: number = 14): number[] {
  if (bars.length < period + 1) {
    return new Array(bars.length).fill(NaN);
  }

  const trueRanges: number[] = [];

  // First TR has no previous close — use H-L only
  trueRanges.push(bars[0].high - bars[0].low);

  for (let i = 1; i < bars.length; i++) {
    const hl = bars[i].high - bars[i].low;
    const hpc = Math.abs(bars[i].high - bars[i - 1].close);
    const lpc = Math.abs(bars[i].low - bars[i - 1].close);
    trueRanges.push(Math.max(hl, hpc, lpc));
  }

  // Seed: simple average of first `period` true ranges
  const result: number[] = new Array(period - 1).fill(NaN);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += trueRanges[i];
  result.push(seed / period);

  // Wilder's smoothing for the rest
  for (let i = period; i < trueRanges.length; i++) {
    const prev = result[result.length - 1];
    result.push((prev * (period - 1) + trueRanges[i]) / period);
  }

  return result;
}

/**
 * Returns the most recent ATR value for a bar array.
 */
export function currentATR(bars: OHLCVBar[], period: number = 14): number {
  const values = atr(bars, period);
  return values[values.length - 1] ?? NaN;
}

/**
 * ATR as a percentage of current price — useful for comparing volatility
 * across different-priced stocks.
 */
export function atrPercent(bars: OHLCVBar[], period: number = 14): number {
  const atrVal = currentATR(bars, period);
  const price = bars[bars.length - 1]?.close ?? 0;
  if (!price || isNaN(atrVal)) return NaN;
  return (atrVal / price) * 100;
}

/**
 * Validates whether a proposed stop price makes sense relative to ATR.
 *
 * Rules:
 *   - Stop must be at least 0.5x ATR away from entry (avoids noise stop-outs)
 *   - Stop must be no more than 2.5x ATR away from entry (avoids outsized risk)
 *
 * Returns an object with the validation result and diagnostic context.
 */
export function validateStopVsATR(
  entryPrice: number,
  stopPrice: number,
  atrValue: number
): {
  valid: boolean;
  stopDistance: number;
  atrMultiple: number;
  reason?: string;
} {
  const stopDistance = Math.abs(entryPrice - stopPrice);
  const atrMultiple = atrValue > 0 ? stopDistance / atrValue : 0;

  if (atrMultiple < 0.5) {
    return {
      valid: false,
      stopDistance,
      atrMultiple,
      reason: `Stop too tight — only ${atrMultiple.toFixed(2)}x ATR. Normal noise will stop you out.`,
    };
  }

  if (atrMultiple > 2.5) {
    return {
      valid: false,
      stopDistance,
      atrMultiple,
      reason: `Stop too wide — ${atrMultiple.toFixed(2)}x ATR. Risk exceeds acceptable range.`,
    };
  }

  return { valid: true, stopDistance, atrMultiple };
}
