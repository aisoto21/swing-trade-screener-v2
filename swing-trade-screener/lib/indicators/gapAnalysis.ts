import type { OHLCVBar, GapInfo, GapAnalysis } from "@/types";
import { MIN_GAP_PCT } from "@/constants/indicators";

/**
 * Detect if there is a gap between the two most recent bars.
 * Gap up: today's low > previous high
 * Gap down: today's high < previous low
 */
export function detectGap(bars: OHLCVBar[]): GapInfo | null {
  if (bars.length < 2) return null;

  const curr = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const refPrice = prev.close;

  // Gap up: price jumped up overnight
  if (curr.low > prev.high) {
    const sizePct = (curr.low - prev.high) / refPrice;
    if (sizePct < MIN_GAP_PCT) return null;
    return {
      type: "up",
      sizePct,
      top: curr.low,
      bottom: prev.high,
      filled: false, // gap up: filled if price came back down into [prev.high, curr.low]
      barIndex: bars.length - 1,
    };
  }

  // Gap down: price jumped down overnight
  if (curr.high < prev.low) {
    const sizePct = (prev.low - curr.high) / refPrice;
    if (sizePct < MIN_GAP_PCT) return null;
    return {
      type: "down",
      sizePct,
      top: prev.low,
      bottom: curr.high,
      filled: false, // gap down: filled if price came back up into [curr.high, prev.low]
      barIndex: bars.length - 1,
    };
  }

  return null;
}

/**
 * Classify gap into a tradeable setup.
 * - Gap and Go: gap holds, price continues in gap direction
 * - Gap Fill: gap gets filled, trade the bounce/reversal
 * - Gap Rejection: price tests gap zone, gets rejected
 */
export function detectGapSetup(
  bars: OHLCVBar[],
  gap: GapInfo
): { setup: NonNullable<GapAnalysis["setup"]>; bias: "LONG" | "SHORT" } | null {
  if (bars.length < 2) return null;

  const curr = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const currBullish = curr.close > curr.open;

  if (gap.type === "up") {
    // Gap up: gap zone is [prev.high, curr.low]
    const filled = curr.low <= prev.high || curr.low <= gap.bottom;
    const heldAbove = curr.low >= gap.bottom;

    if (heldAbove && currBullish) {
      return { setup: "Gap and Go", bias: "LONG" };
    }
    if (filled && currBullish) {
      return { setup: "Gap Fill", bias: "LONG" }; // filled and bounced
    }
    if (curr.high >= gap.bottom && curr.high <= gap.top && !currBullish) {
      return { setup: "Gap Rejection", bias: "SHORT" }; // tested gap from above, rejected
    }
  } else {
    // Gap down: gap zone is [curr.high, prev.low]
    const filled = curr.high >= prev.low || curr.high >= gap.top;
    const heldBelow = curr.high <= gap.top;

    if (heldBelow && !currBullish) {
      return { setup: "Gap and Go", bias: "SHORT" };
    }
    if (filled && !currBullish) {
      return { setup: "Gap Fill", bias: "SHORT" }; // filled and continued down
    }
    if (curr.low <= gap.top && curr.low >= gap.bottom && currBullish) {
      return { setup: "Gap Rejection", bias: "LONG" }; // tested gap from below, rejected (bounced)
    }
  }

  return null;
}

/**
 * Full gap analysis: detect gap and classify setup.
 */
export function gapAnalysis(bars: OHLCVBar[]): GapAnalysis {
  const gap = detectGap(bars);
  if (!gap) {
    return { gap: null, setup: null, bias: null };
  }

  // Update filled status based on current bar
  const curr = bars[bars.length - 1];
  const filled =
    gap.type === "up"
      ? curr.low <= gap.bottom
      : curr.high >= gap.top;

  const gapWithFilled = { ...gap, filled };
  const setupResult = detectGapSetup(bars, gapWithFilled);

  if (!setupResult) {
    return {
      gap: gapWithFilled,
      setup: null,
      bias: null,
    };
  }

  return {
    gap: gapWithFilled,
    setup: setupResult.setup,
    bias: setupResult.bias,
  };
}
