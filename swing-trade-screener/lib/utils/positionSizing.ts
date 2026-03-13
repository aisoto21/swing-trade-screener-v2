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
