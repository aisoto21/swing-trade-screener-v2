import type { OHLCVBar } from "@/types";
import type { BollingerBandsData } from "@/types";
import { BOLLINGER_PERIOD, BOLLINGER_STD, BOLLINGER_SQUEEZE_THRESHOLD } from "@/constants/indicators";

function sma(closes: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) result.push(NaN);
    else {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += closes[i - j];
      result.push(sum / period);
    }
  }
  return result;
}

function stdDev(closes: number[], period: number, smaValues: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) result.push(NaN);
    else {
      const avg = smaValues[i];
      let sumSq = 0;
      for (let j = 0; j < period; j++) {
        sumSq += Math.pow(closes[i - j] - avg, 2);
      }
      result.push(Math.sqrt(sumSq / period));
    }
  }
  return result;
}

/**
 * Bollinger Bands (20 SMA, 2 std dev)
 */
export function bollingerBands(bars: OHLCVBar[]): BollingerBandsData {
  const closes = bars.map((b) => b.close);
  const middle = sma(closes, BOLLINGER_PERIOD);
  const std = stdDev(closes, BOLLINGER_PERIOD, middle);

  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(middle[i])) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      upper.push(middle[i] + BOLLINGER_STD * std[i]);
      lower.push(middle[i] - BOLLINGER_STD * std[i]);
    }
  }

  const lastIdx = closes.length - 1;
  const lastClose = closes[lastIdx];
  const lastUpper = upper[lastIdx];
  const lastLower = lower[lastIdx];

  let squeeze = false;
  if (lastIdx >= 52 && !isNaN(lastUpper) && !isNaN(lastLower)) {
    const currentWidth = (lastUpper - lastLower) / middle[lastIdx];
    let widthSum = 0;
    let count = 0;
    for (let i = lastIdx - 52; i < lastIdx; i++) {
      if (!isNaN(upper[i]) && !isNaN(lower[i]) && !isNaN(middle[i]) && middle[i] > 0) {
        widthSum += (upper[i] - lower[i]) / middle[i];
        count++;
      }
    }
    const avgWidth = count > 0 ? widthSum / count : 1;
    squeeze = currentWidth < avgWidth * (1 - BOLLINGER_SQUEEZE_THRESHOLD);
  }

  const touchingUpper = !isNaN(lastUpper) && lastClose >= lastUpper * 0.998;
  const touchingLower = !isNaN(lastLower) && lastClose <= lastLower * 1.002;

  return {
    upper,
    middle,
    lower,
    squeeze,
    touchingUpper,
    touchingLower,
  };
}
