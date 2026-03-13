import type { OHLCVBar } from "@/types";
import type { VolumeAnalysis } from "@/types";
import {
  VOLUME_AVG_PERIOD,
  VOLUME_INSTITUTIONAL,
  VOLUME_CLIMACTIC,
  VOLUME_TREND_BARS,
} from "@/constants/indicators";

/**
 * On-Balance Volume
 */
function obv(bars: OHLCVBar[]): number[] {
  const result: number[] = [];
  let running = 0;
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) {
      running = bars[i].volume;
    } else {
      if (bars[i].close > bars[i - 1].close) running += bars[i].volume;
      else if (bars[i].close < bars[i - 1].close) running -= bars[i].volume;
    }
    result.push(running);
  }
  return result;
}

/**
 * Volume analysis
 */
export function volumeAnalysis(bars: OHLCVBar[]): VolumeAnalysis {
  if (bars.length < VOLUME_AVG_PERIOD) {
    return {
      avgVolume20: 0,
      currentVsAvg: 0,
      classification: "Weak / No Confirmation",
      volumeTrend: "neutral",
      obvSlope: "neutral",
    };
  }

  const recent = bars.slice(-VOLUME_AVG_PERIOD);
  const avgVolume20 =
    recent.reduce((s, b) => s + b.volume, 0) / VOLUME_AVG_PERIOD;
  const currentVolume = bars[bars.length - 1]?.volume ?? 0;
  const currentVsAvg = avgVolume20 > 0 ? currentVolume / avgVolume20 : 0;

  let classification: VolumeAnalysis["classification"] = "Weak / No Confirmation";
  if (currentVsAvg >= VOLUME_CLIMACTIC) {
    classification = "Climactic / Exhaustion Risk";
  } else if (currentVsAvg >= VOLUME_INSTITUTIONAL) {
    classification = "Institutional Confirmation";
  }

  const trendBars = bars.slice(-VOLUME_TREND_BARS);
  const volSumFirst = trendBars.slice(0, Math.floor(trendBars.length / 2)).reduce((s, b) => s + b.volume, 0);
  const volSumSecond = trendBars.slice(Math.floor(trendBars.length / 2)).reduce((s, b) => s + b.volume, 0);
  const volumeTrend: VolumeAnalysis["volumeTrend"] =
    volSumSecond > volSumFirst * 1.1 ? "expanding" : volSumSecond < volSumFirst * 0.9 ? "contracting" : "neutral";

  const obvValues = obv(bars);
  const obvLast = obvValues[obvValues.length - 1] ?? 0;
  const obvPrev = obvValues[obvValues.length - 6] ?? obvLast;
  const obvSlope: VolumeAnalysis["obvSlope"] =
    obvLast > obvPrev * 1.01 ? "up" : obvLast < obvPrev * 0.99 ? "down" : "neutral";

  return {
    avgVolume20,
    currentVsAvg,
    classification,
    volumeTrend,
    obvSlope,
  };
}
