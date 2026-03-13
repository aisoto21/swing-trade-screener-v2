import type { OHLCVBar } from "@/types";
import type { CandlestickPattern } from "@/types";
import type { Timeframe } from "@/types";

function bodySize(bar: OHLCVBar): number {
  return Math.abs(bar.close - bar.open);
}

function upperShadow(bar: OHLCVBar): number {
  return bar.high - Math.max(bar.open, bar.close);
}

function lowerShadow(bar: OHLCVBar): number {
  return Math.min(bar.open, bar.close) - bar.low;
}

function isBullish(bar: OHLCVBar): boolean {
  return bar.close > bar.open;
}

function isBearish(bar: OHLCVBar): boolean {
  return bar.close < bar.open;
}

function dojiThreshold(bar: OHLCVBar): number {
  return (bar.high - bar.low) * 0.1;
}

export function detectCandlePatterns(bars: OHLCVBar[], timeframe: Timeframe): CandlestickPattern[] {
  const patterns: CandlestickPattern[] = [];
  if (bars.length < 3) return patterns;

  const avgRange =
    bars.slice(-20).reduce((s, b) => s + (b.high - b.low), 0) / Math.min(20, bars.length) || 1;

  for (let i = bars.length - 5; i >= 0 && i < bars.length; i++) {
    const curr = bars[i];
    const prev = bars[i - 1];
    const prev2 = bars[i - 2];

    const body = bodySize(curr);
    const upper = upperShadow(curr);
    const lower = lowerShadow(curr);
    const range = curr.high - curr.low;

    if (range === 0) continue;

    // Hammer (bullish)
    if (lower >= 2 * body && upper <= body * 0.3 && isBullish(curr)) {
      patterns.push({
        name: "Hammer",
        type: "bullish",
        timeframe,
        confidence: curr.close > curr.open ? "confirmed" : "unconfirmed",
        barIndex: i,
      });
    }

    // Shooting Star (bearish)
    if (upper >= 2 * body && lower <= body * 0.3 && isBearish(curr)) {
      patterns.push({
        name: "Shooting Star",
        type: "bearish",
        timeframe,
        confidence: curr.close < curr.open ? "confirmed" : "unconfirmed",
        barIndex: i,
      });
    }

    // Dragonfly Doji (bullish)
    if (body <= dojiThreshold(curr) && lower >= 2 * range && upper <= range * 0.1) {
      patterns.push({
        name: "Dragonfly Doji",
        type: "bullish",
        timeframe,
        confidence: "confirmed",
        barIndex: i,
      });
    }

    // Gravestone Doji (bearish)
    if (body <= dojiThreshold(curr) && upper >= 2 * range && lower <= range * 0.1) {
      patterns.push({
        name: "Gravestone Doji",
        type: "bearish",
        timeframe,
        confidence: "confirmed",
        barIndex: i,
      });
    }

    if (prev) {
      const prevBody = bodySize(prev);

      // Bullish Engulfing
      if (
        isBearish(prev) &&
        isBullish(curr) &&
        curr.open < prev.close &&
        curr.close > prev.open &&
        curr.close > prev.high
      ) {
        patterns.push({
          name: "Bullish Engulfing",
          type: "bullish",
          timeframe,
          confidence: "confirmed",
          barIndex: i,
        });
      }

      // Bearish Engulfing
      if (
        isBullish(prev) &&
        isBearish(curr) &&
        curr.open > prev.close &&
        curr.close < prev.open &&
        curr.close < prev.low
      ) {
        patterns.push({
          name: "Bearish Engulfing",
          type: "bearish",
          timeframe,
          confidence: "confirmed",
          barIndex: i,
        });
      }

      // Piercing Line
      if (
        isBearish(prev) &&
        isBullish(curr) &&
        curr.open < prev.low &&
        curr.close > prev.open + prevBody / 2 &&
        curr.close < prev.open
      ) {
        patterns.push({
          name: "Piercing Line",
          type: "bullish",
          timeframe,
          confidence: "confirmed",
          barIndex: i,
        });
      }

      // Dark Cloud Cover
      if (
        isBullish(prev) &&
        isBearish(curr) &&
        curr.open > prev.high &&
        curr.close < prev.open + prevBody / 2 &&
        curr.close > prev.open
      ) {
        patterns.push({
          name: "Dark Cloud Cover",
          type: "bearish",
          timeframe,
          confidence: "confirmed",
          barIndex: i,
        });
      }

      // Bullish Harami
      if (
        isBearish(prev) &&
        prevBody > avgRange * 0.5 &&
        curr.open > prev.close &&
        curr.close < prev.open &&
        body < prevBody * 0.5
      ) {
        patterns.push({
          name: "Bullish Harami",
          type: "bullish",
          timeframe,
          confidence: "confirmed",
          barIndex: i,
        });
      }

      // Bearish Harami
      if (
        isBullish(prev) &&
        prevBody > avgRange * 0.5 &&
        curr.open < prev.close &&
        curr.close > prev.open &&
        body < prevBody * 0.5
      ) {
        patterns.push({
          name: "Bearish Harami",
          type: "bearish",
          timeframe,
          confidence: "confirmed",
          barIndex: i,
        });
      }

      // Inside Bar
      if (curr.high < prev.high && curr.low > prev.low) {
        patterns.push({
          name: "Inside Bar",
          type: isBullish(curr) ? "bullish" : "bearish",
          timeframe,
          confidence: "confirmed",
          barIndex: i,
        });
      }
    }

    if (prev && prev2) {
      // Morning Star (bullish)
      if (
        isBearish(prev2) &&
        bodySize(prev2) > avgRange * 0.3 &&
        bodySize(prev) < avgRange * 0.3 &&
        isBullish(curr) &&
        curr.close > (prev2.open + prev2.close) / 2
      ) {
        patterns.push({
          name: "Morning Star",
          type: "bullish",
          timeframe,
          confidence: "confirmed",
          barIndex: i,
        });
      }

      // Evening Star (bearish)
      if (
        isBullish(prev2) &&
        bodySize(prev2) > avgRange * 0.3 &&
        bodySize(prev) < avgRange * 0.3 &&
        isBearish(curr) &&
        curr.close < (prev2.open + prev2.close) / 2
      ) {
        patterns.push({
          name: "Evening Star",
          type: "bearish",
          timeframe,
          confidence: "confirmed",
          barIndex: i,
        });
      }

      // Three White Soldiers
      if (
        isBullish(curr) &&
        isBullish(prev) &&
        isBullish(prev2) &&
        curr.open > prev.open &&
        prev.open > prev2.open &&
        curr.close > prev.close &&
        prev.close > prev2.close
      ) {
        patterns.push({
          name: "Three White Soldiers",
          type: "bullish",
          timeframe,
          confidence: "confirmed",
          barIndex: i,
        });
      }

      // Three Black Crows
      if (
        isBearish(curr) &&
        isBearish(prev) &&
        isBearish(prev2) &&
        curr.open < prev.open &&
        prev.open < prev2.open &&
        curr.close < prev.close &&
        prev.close < prev2.close
      ) {
        patterns.push({
          name: "Three Black Crows",
          type: "bearish",
          timeframe,
          confidence: "confirmed",
          barIndex: i,
        });
      }
    }
  }

  return patterns.slice(0, 5);
}
