/**
 * Multi-Timeframe Confirmation Score
 * A setup where all three timeframes align is categorically stronger than
 * one where only the daily triggers.
 */

export interface MTFScore {
  dailyAligned: boolean;
  fourHourAligned: boolean;
  fifteenMinAligned: boolean;
  alignedCount: number;
  score: number;
  gradeModifier: 1 | 0 | -1;
  description: string;
}

/**
 * Rules:
 *   3/3 aligned → score 100, grade upgrade (+1)
 *   2/3 aligned → score 66, no modifier
 *   1/3 aligned → score 33, grade downgrade (-1)
 *   0/3          → score 0, setup should not be surfaced
 *
 * "Aligned" for LONG:
 *   Daily:     price > 50 SMA AND RSI > 50 AND MACD histogram positive
 *   4H:        price > 9 EMA AND volume > 1x avg
 *   15M:       price above VWAP AND last candle is bullish
 *
 * "Aligned" for SHORT: inverse of the above
 */
export function computeMTFScore(
  bias: "LONG" | "SHORT",
  daily: { price: number; sma50: number; rsi: number; macdHist: number },
  fourHour: { price: number; ema9: number; volumeRatio: number },
  fifteenMin: { price: number; vwap: number; lastCandleBullish: boolean }
): MTFScore {
  const isLong = bias === "LONG";

  const dailyAligned = isLong
    ? daily.price > daily.sma50 && daily.rsi > 50 && daily.macdHist > 0
    : daily.price < daily.sma50 && daily.rsi < 50 && daily.macdHist < 0;

  const fourHourAligned = isLong
    ? fourHour.price > fourHour.ema9 && fourHour.volumeRatio > 1
    : fourHour.price < fourHour.ema9 && fourHour.volumeRatio > 1;

  const fifteenMinAligned = isLong
    ? fifteenMin.price > fifteenMin.vwap && fifteenMin.lastCandleBullish
    : fifteenMin.price < fifteenMin.vwap && !fifteenMin.lastCandleBullish;

  const alignedCount = [dailyAligned, fourHourAligned, fifteenMinAligned].filter(
    Boolean
  ).length;

  let score: number;
  let gradeModifier: 1 | 0 | -1;
  let description: string;

  if (alignedCount === 3) {
    score = 100;
    gradeModifier = 1;
    description = "All 3 timeframes aligned (Daily, 4H, 15M)";
  } else if (alignedCount === 2) {
    score = 66;
    gradeModifier = 0;
    const aligned = [
      dailyAligned && "Daily",
      fourHourAligned && "4H",
      fifteenMinAligned && "15M",
    ].filter(Boolean);
    description = `2/3 timeframes aligned (${aligned.join(", ")})`;
  } else if (alignedCount === 1) {
    score = 33;
    gradeModifier = -1;
    const aligned = [
      dailyAligned && "Daily",
      fourHourAligned && "4H",
      fifteenMinAligned && "15M",
    ].filter(Boolean);
    description = `1/3 timeframes aligned (${aligned.join(", ")}) — weak confirmation`;
  } else {
    score = 0;
    gradeModifier = -1;
    description = "No timeframe alignment";
  }

  return {
    dailyAligned,
    fourHourAligned,
    fifteenMinAligned,
    alignedCount,
    score,
    gradeModifier,
    description,
  };
}
