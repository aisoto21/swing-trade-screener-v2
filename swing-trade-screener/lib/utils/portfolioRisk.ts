import type { TradeEntry } from "@/lib/stores/tradeLogStore";

export interface PortfolioMetrics {
  totalLongExposure: number;
  totalShortExposure: number;
  netExposure: number;
  totalExposurePercent: number;
  openPositions: number;
  longCount: number;
  shortCount: number;
  sectorBreakdown: Record<
    string,
    {
      dollarExposure: number;
      percentOfPortfolio: number;
      isConcentrated: boolean;
    }
  >;
  totalDollarAtRisk: number;
  percentAtRisk: number;
  openRiskBySector: Record<string, number>;
  avgHoldDays: number;
  holdsByStrategy: Record<string, number>;
  betaWeightedExposure: number;
  alerts: PortfolioAlert[];
}

export interface PortfolioAlert {
  severity: "HIGH" | "MEDIUM" | "LOW";
  message: string;
  ticker?: string;
}

export function computePortfolioMetrics(
  openTrades: TradeEntry[],
  currentPrices: Record<string, number>,
  accountSize: number
): PortfolioMetrics {
  let totalLongExposure = 0;
  let totalShortExposure = 0;
  let totalDollarAtRisk = 0;
  const sectorBreakdown: PortfolioMetrics["sectorBreakdown"] = {};
  const openRiskBySector: Record<string, number> = {};
  const holdsByStrategy: Record<string, number> = {};
  const alerts: PortfolioAlert[] = [];

  for (const t of openTrades) {
    const price = currentPrices[t.ticker] ?? t.entryPrice;
    const exposure = t.shares * price;
    if (t.bias === "LONG") {
      totalLongExposure += exposure;
    } else {
      totalShortExposure += exposure;
    }
    const risk = Math.abs(t.entryPrice - t.plannedStop) * t.shares;
    totalDollarAtRisk += risk;

    const sector = t.sector ?? "Unknown";
    if (!sectorBreakdown[sector]) {
      sectorBreakdown[sector] = {
        dollarExposure: 0,
        percentOfPortfolio: 0,
        isConcentrated: false,
      };
    }
    sectorBreakdown[sector].dollarExposure += exposure;
    openRiskBySector[sector] = (openRiskBySector[sector] ?? 0) + risk;

    const strat = t.strategy;
    holdsByStrategy[strat] = (holdsByStrategy[strat] ?? 0) + 1;

    const distToStop =
      Math.abs(price - t.plannedStop) / t.plannedStop;
    if (distToStop <= 0.02) {
      alerts.push({
        severity: "HIGH",
        message: "Position within 2% of stop loss",
        ticker: t.ticker,
      });
    }
  }

  const netExposure = totalLongExposure - totalShortExposure;
  const totalExposure = totalLongExposure + totalShortExposure;
  const totalExposurePercent =
    accountSize > 0 ? (totalExposure / accountSize) * 100 : 0;
  const percentAtRisk =
    accountSize > 0 ? (totalDollarAtRisk / accountSize) * 100 : 0;

  for (const k of Object.keys(sectorBreakdown)) {
    sectorBreakdown[k].percentOfPortfolio =
      totalExposure > 0
        ? (sectorBreakdown[k].dollarExposure / totalExposure) * 100
        : 0;
    sectorBreakdown[k].isConcentrated =
      sectorBreakdown[k].percentOfPortfolio > 30;
  }

  for (const [sector, data] of Object.entries(sectorBreakdown)) {
    if (data.isConcentrated) {
      alerts.push({
        severity: "HIGH",
        message: `Sector concentration > 35%: ${sector}`,
      });
    }
  }

  if (percentAtRisk > 3) {
    alerts.push({
      severity: "HIGH",
      message: `Total % at risk > 3% of account`,
    });
  }

  if (totalExposurePercent > 80) {
    alerts.push({
      severity: "MEDIUM",
      message: "Total exposure > 80% of account",
    });
  }

  const avgHoldDays =
    openTrades.length > 0
      ? openTrades.reduce((s, t) => s + (t.holdDays ?? 0), 0) /
        openTrades.length
      : 0;

  return {
    totalLongExposure,
    totalShortExposure,
    netExposure,
    totalExposurePercent,
    openPositions: openTrades.length,
    longCount: openTrades.filter((t) => t.bias === "LONG").length,
    shortCount: openTrades.filter((t) => t.bias === "SHORT").length,
    sectorBreakdown,
    totalDollarAtRisk,
    percentAtRisk,
    openRiskBySector,
    avgHoldDays,
    holdsByStrategy,
    betaWeightedExposure: totalExposure,
    alerts,
  };
}
