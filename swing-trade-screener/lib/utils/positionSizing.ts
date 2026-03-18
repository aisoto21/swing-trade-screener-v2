import { CONCENTRATION_WARNING_THRESHOLD } from "@/constants/indicators";
import type { Bias } from "@/types";

/**
 * Compute position sizing based on account size and risk parameters
 */
export function computePositionSizing(
  accountSize: number,
  riskPerTrade: number,
  entryPrice: number,
  stopPrice: number,
  bias: Bias
): {
  maxShares: number;
  maxDollarExposure: number;
  portfolioPercent: number;
  concentrationWarning: boolean;
} {
  const riskAmount = accountSize * riskPerTrade;
  const riskPerShare = Math.abs(entryPrice - stopPrice);
  const maxShares = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0;
  const maxDollarExposure = maxShares * entryPrice;
  const portfolioPercent = accountSize > 0 ? maxDollarExposure / accountSize : 0;
  const concentrationWarning = portfolioPercent > CONCENTRATION_WARNING_THRESHOLD;

  return {
    maxShares,
    maxDollarExposure,
    portfolioPercent,
    concentrationWarning,
  };
}

/**
 * Kelly Criterion position sizing.
 * K = W - (1 - W) / R where W = win rate, R = avg win / avg loss ratio.
 * Half Kelly (recommended): K × 0.5. Falls back to 1% fixed risk if insufficient data.
 */
export function computeKellyPositionSize(
  accountSize: number,
  winRate: number,
  avgWinPercent: number,
  avgLossPercent: number,
  entryPrice: number,
  stopPrice: number,
  method: "half_kelly" | "full_kelly" = "half_kelly"
): {
  maxShares: number;
  maxDollarExposure: number;
  portfolioPercent: number;
  concentrationWarning: boolean;
} {
  if (winRate <= 0 || avgWinPercent <= 0 || avgLossPercent <= 0) {
    return computePositionSizing(accountSize, 0.01, entryPrice, stopPrice, "LONG");
  }

  const R = avgWinPercent / Math.abs(avgLossPercent);
  const K = winRate - (1 - winRate) / R;
  const adjustedK = method === "half_kelly" ? K * 0.5 : K;
  const cappedK = Math.min(Math.max(adjustedK, 0), 0.25);

  const riskAmount = accountSize * cappedK;
  const riskPerShare = Math.abs(entryPrice - stopPrice);
  const maxShares = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0;
  const maxDollarExposure = maxShares * entryPrice;
  const portfolioPercent = accountSize > 0 ? maxDollarExposure / accountSize : 0;
  const concentrationWarning = portfolioPercent > CONCENTRATION_WARNING_THRESHOLD;

  return {
    maxShares,
    maxDollarExposure,
    portfolioPercent,
    concentrationWarning,
  };
}
