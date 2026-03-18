import type { OHLCVBar } from "@/types";
import type { VWAPData } from "@/types";

/**
 * ANCHORED VWAP
 *
 * Standard rolling VWAP on daily bars is meaningless — it accumulates from
 * an arbitrary start date and produces a number with no institutional basis.
 *
 * Anchored VWAP starts accumulation from a meaningful price event:
 *   - A key swing low (most common for long setups)
 *   - A key swing high (most common for short setups)
 *   - An earnings date
 *   - A breakout bar
 *
 * Institutions use AVWAP as a cost-basis reference. When price reclaims
 * AVWAP after pulling back, it often signals institutional re-accumulation.
 */
export function anchoredVWAP(
  bars: OHLCVBar[],
  anchorIndex: number
): number[] {
  if (anchorIndex < 0 || anchorIndex >= bars.length) {
    return new Array(bars.length).fill(NaN);
  }

  const result: number[] = new Array(anchorIndex).fill(NaN);
  let cumulativeTPV = 0;
  let cumulativeVol = 0;

  for (let i = anchorIndex; i < bars.length; i++) {
    const tp = (bars[i].high + bars[i].low + bars[i].close) / 3;
    cumulativeTPV += tp * bars[i].volume;
    cumulativeVol += bars[i].volume;
    result.push(cumulativeVol > 0 ? cumulativeTPV / cumulativeVol : bars[i].close);
  }

  return result;
}

/**
 * Find the index of the most significant swing low in the last N bars.
 * "Significant" = bar whose low is lower than N bars on either side.
 */
function findSwingLowIndex(bars: OHLCVBar[], lookback: number = 60, wing: number = 3): number {
  const slice = bars.slice(-lookback);
  const offset = bars.length - lookback;

  let minLow = Infinity;
  let minIdx = 0;

  for (let i = wing; i < slice.length - wing; i++) {
    let isSwingLow = true;
    for (let j = 1; j <= wing; j++) {
      if (slice[i].low >= slice[i - j].low || slice[i].low >= slice[i + j].low) {
        isSwingLow = false;
        break;
      }
    }
    if (isSwingLow && slice[i].low < minLow) {
      minLow = slice[i].low;
      minIdx = i;
    }
  }

  return offset + minIdx;
}

/**
 * Find the index of the most significant swing high in the last N bars.
 */
function findSwingHighIndex(bars: OHLCVBar[], lookback: number = 60, wing: number = 3): number {
  const slice = bars.slice(-lookback);
  const offset = bars.length - lookback;

  let maxHigh = -Infinity;
  let maxIdx = 0;

  for (let i = wing; i < slice.length - wing; i++) {
    let isSwingHigh = true;
    for (let j = 1; j <= wing; j++) {
      if (slice[i].high <= slice[i - j].high || slice[i].high <= slice[i + j].high) {
        isSwingHigh = false;
        break;
      }
    }
    if (isSwingHigh && slice[i].high > maxHigh) {
      maxHigh = slice[i].high;
      maxIdx = i;
    }
  }

  return offset + maxIdx;
}

/**
 * Primary AVWAP export — replaces the old session-rolling vwap().
 *
 * For LONG bias: anchors to most recent significant swing low
 * For SHORT bias: anchors to most recent significant swing high
 *
 * Returns VWAPData shape (compatible with existing types).
 */
export function vwapAnchored(
  bars: OHLCVBar[],
  bias: "LONG" | "SHORT" = "LONG"
): VWAPData {
  const anchorIdx = bias === "LONG"
    ? findSwingLowIndex(bars, 60)
    : findSwingHighIndex(bars, 60);

  const values = anchoredVWAP(bars, anchorIdx);
  const lastPrice = bars[bars.length - 1]?.close ?? 0;
  const lastVWAP = values[values.length - 1] ?? 0;

  return {
    values,
    priceAbove: lastPrice > lastVWAP,
    anchorIndex: anchorIdx,
    anchorDate: bars[anchorIdx]?.date,
  };
}

/**
 * Returns both long-anchored and short-anchored VWAP for full context.
 */
export function dualAVWAP(bars: OHLCVBar[]): {
  long: VWAPData;
  short: VWAPData;
} {
  return {
    long: vwapAnchored(bars, "LONG"),
    short: vwapAnchored(bars, "SHORT"),
  };
}

/**
 * Intraday session VWAP — only valid for sub-daily timeframes.
 * Resets at the start of each calendar day.
 *
 * Use this for 4H and 15M charts.
 * Do NOT use on daily bars (returns array of NaN).
 */
export function sessionVWAP(bars: OHLCVBar[]): VWAPData {
  const result: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVol = 0;
  let lastDate = "";

  for (let i = 0; i < bars.length; i++) {
    const barDate = bars[i].date.slice(0, 10); // YYYY-MM-DD

    // Reset at session open
    if (barDate !== lastDate) {
      cumulativeTPV = 0;
      cumulativeVol = 0;
      lastDate = barDate;
    }

    const tp = (bars[i].high + bars[i].low + bars[i].close) / 3;
    cumulativeTPV += tp * bars[i].volume;
    cumulativeVol += bars[i].volume;
    result.push(cumulativeVol > 0 ? cumulativeTPV / cumulativeVol : bars[i].close);
  }

  const lastPrice = bars[bars.length - 1]?.close ?? 0;
  const lastVWAP = result[result.length - 1] ?? 0;

  return {
    values: result,
    priceAbove: lastPrice > lastVWAP,
  };
}
