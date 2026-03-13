import type { OHLCVBar } from "@/types";
import type { MACDData } from "@/types";
import { MACD_FAST, MACD_SLOW, MACD_SIGNAL } from "@/constants/indicators";

function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += values[j];
      result.push(sum / period);
    } else {
      result.push((values[i] - result[i - 1]) * multiplier + result[i - 1]);
    }
  }
  return result;
}

/**
 * MACD (12, 26, 9)
 */
export function macd(
  closes: number[],
  fast: number = MACD_FAST,
  slow: number = MACD_SLOW,
  signal: number = MACD_SIGNAL
): MACDData {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(
      !isNaN(emaFast[i]) && !isNaN(emaSlow[i]) ? emaFast[i] - emaSlow[i] : NaN
    );
  }
  const signalLine = ema(macdLine.filter((v) => !isNaN(v)), signal);
  const paddedSignal: number[] = [];
  let sigIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (isNaN(macdLine[i])) {
      paddedSignal.push(NaN);
    } else {
      paddedSignal.push(signalLine[sigIdx] ?? NaN);
      sigIdx++;
    }
  }
  const histogram: number[] = macdLine.map((m, i) =>
    !isNaN(m) && !isNaN(paddedSignal[i]) ? m - paddedSignal[i] : NaN
  );

  const lastIdx = macdLine.length - 1;
  let crossover: "bullish" | "bearish" | null = null;
  let zeroLineCross: "bullish" | "bearish" | null = null;

  if (lastIdx >= 2) {
    const prevMacd = macdLine[lastIdx - 1];
    const prevSig = paddedSignal[lastIdx - 1];
    const currMacd = macdLine[lastIdx];
    const currSig = paddedSignal[lastIdx];
    if (!isNaN(prevMacd) && !isNaN(prevSig) && !isNaN(currMacd) && !isNaN(currSig)) {
      if (prevMacd <= prevSig && currMacd > currSig) crossover = "bullish";
      else if (prevMacd >= prevSig && currMacd < currSig) crossover = "bearish";
    }
    const prevPrevMacd = macdLine[lastIdx - 2];
    if (!isNaN(prevPrevMacd) && !isNaN(prevMacd) && !isNaN(currMacd)) {
      if (prevPrevMacd < 0 && prevMacd < 0 && currMacd >= 0) zeroLineCross = "bullish";
      else if (prevPrevMacd > 0 && prevMacd > 0 && currMacd <= 0) zeroLineCross = "bearish";
    }
  }

  return {
    macdLine,
    signalLine: paddedSignal,
    histogram,
    crossover,
    zeroLineCross,
  };
}

export function macdFull(bars: OHLCVBar[]): MACDData {
  const closes = bars.map((b) => b.close);
  return macd(closes);
}
