import type { OHLCVBar } from "@/types";
import type { FibonacciLevels } from "@/types";
import { FIB_NEAR_THRESHOLD } from "@/constants/indicators";

const RETRACEMENT_RATIOS: Record<string, number> = {
  "23.6%": 0.236,
  "38.2%": 0.382,
  "50%": 0.5,
  "61.8%": 0.618,
  "78.6%": 0.786,
};

const EXTENSION_RATIOS: Record<string, number> = {
  "127.2%": 1.272,
  "161.8%": 1.618,
  "200%": 2.0,
  "261.8%": 2.618,
};

/**
 * Find most recent significant swing high and low
 */
function findSwing(bars: OHLCVBar[], lookback: number = 50): { high: number; highIdx: number; low: number; lowIdx: number } | null {
  if (bars.length < lookback) return null;
  const slice = bars.slice(-lookback);
  let high = -Infinity;
  let highIdx = 0;
  let low = Infinity;
  let lowIdx = 0;
  for (let i = 0; i < slice.length; i++) {
    if (slice[i].high > high) {
      high = slice[i].high;
      highIdx = i;
    }
    if (slice[i].low < low) {
      low = slice[i].low;
      lowIdx = i;
    }
  }
  return { high, highIdx, low, lowIdx };
}

/**
 * Fibonacci retracement and extension levels
 */
export function fibonacci(bars: OHLCVBar[]): FibonacciLevels {
  const swing = findSwing(bars);
  const retracement: Record<string, number> = {};
  const extension: Record<string, number> = {};
  let nearestLevel: { level: string; price: number; type: "retracement" | "extension" } | undefined;
  let within1Percent = false;

  const lastClose = bars[bars.length - 1]?.close ?? 0;

  if (swing) {
    const { high, low } = swing;
    const range = high - low;

    if (lastClose >= (high + low) / 2) {
      for (const [label, ratio] of Object.entries(RETRACEMENT_RATIOS)) {
        retracement[label] = high - range * ratio;
      }
      for (const [label, ratio] of Object.entries(EXTENSION_RATIOS)) {
        extension[label] = high + range * (ratio - 1);
      }
    } else {
      for (const [label, ratio] of Object.entries(RETRACEMENT_RATIOS)) {
        retracement[label] = low + range * ratio;
      }
      for (const [label, ratio] of Object.entries(EXTENSION_RATIOS)) {
        extension[label] = low - range * (ratio - 1);
      }
    }

    const allLevels = [
      ...Object.entries(retracement).map(([l, p]) => ({ level: l, price: p, type: "retracement" as const })),
      ...Object.entries(extension).map(([l, p]) => ({ level: l, price: p, type: "extension" as const })),
    ];

    let minDist = Infinity;
    for (const { level, price, type } of allLevels) {
      const dist = Math.abs(lastClose - price) / lastClose;
      if (dist < minDist) {
        minDist = dist;
        nearestLevel = { level, price, type };
      }
    }
    within1Percent = minDist <= FIB_NEAR_THRESHOLD;
  }

  return {
    retracement,
    extension,
    nearestLevel,
    within1Percent,
  };
}
