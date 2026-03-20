"use client";

import { useState, useEffect, useMemo } from "react";
import { useTradeLogStore } from "@/lib/stores/tradeLogStore";
import type { TradeEntry, TradeStrategy } from "@/lib/stores/tradeLogStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { useFeature } from "@/lib/hooks/useFeature";
import { computePerformanceMetrics } from "@/lib/utils/performanceAnalytics";
import { computePortfolioMetrics } from "@/lib/utils/portfolioRisk";
import { checkPortfolioCorrelation } from "@/lib/utils/correlationGuard";
import { CloseTradeModal } from "@/components/trades/CloseTradeModal";
import { PortfolioWatchlist } from "@/components/portfolio/PortfolioWatchlist";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { UNIVERSE } from "@/constants/universe";
import type { OHLCVBar } from "@/types";
import type { PortfolioAlert } from "@/lib/utils/portfolioRisk";
import { formatCurrency, formatPercent } from "@/lib/utils/formatter";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

function getSectorForTicker(ticker: string): string {
  const stock = UNIVERSE.find(
    (s) => s.ticker.toUpperCase() === ticker.toUpperCase()
  );
  return stock?.sector ?? "Other";
}

export function PortfolioPageClient() {
  const { trades, closeTrade, addTrade } = useTradeLogStore();
  const { accountSize } = useSettingsStore();
  const openTrades = useMemo(
  () => trades.filter((t) => !t.exitDate && !t.exitPrice),
  [trades]
);
  const correlationGuard = useFeature("CORRELATION_GUARD");
  const [priceHistory, setPriceHistory] = useState<Record<string, OHLCVBar[]>>({});
  const [correlationAlerts, setCorrelationAlerts] = useState<PortfolioAlert[]>([]);
  const [closeTradeModalOpen, setCloseTradeModalOpen] = useState(false);
  const [tradeToClose, setTradeToClose] = useState<TradeEntry | null>(null);
  const [logTradeModalOpen, setLogTradeModalOpen] = useState(false);
  const [strategyFilter, setStrategyFilter] = useState<"All" | TradeStrategy>("All");
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [pricesLoading, setPricesLoading] = useState(false);

  const [logForm, setLogForm] = useState({
    ticker: "",
    bias: "LONG" as "LONG" | "SHORT",
    strategy: "Swing" as TradeStrategy,
    entryDate: new Date().toISOString().slice(0, 10),
    entryPrice: 0,
    shares: 0,
    plannedStop: 0,
    plannedT1: 0,
    plannedT2: 0,
    plannedT3: 0,
    setupName: "",
    notes: "",
  });

  const openTickerStr = useMemo(
    () => openTrades.map((t) => t.ticker).join(","),
    [openTrades]
  );

  useEffect(() => {
    if (openTrades.length === 0) {
      setLivePrices({});
      return;
    }
    setPricesLoading(true);
    Promise.all(
      openTrades.map((t) =>
        fetch(`/api/marketquote/${t.ticker}`)
          .then((r) => r.json())
          .then((d) => ({ ticker: t.ticker, price: d?.price as number }))
          .catch(() => ({ ticker: t.ticker, price: NaN }))
      )
    )
      .then((results) => {
        const map: Record<string, number> = {};
        for (const r of results) {
          map[r.ticker] = r.price;
        }
        setLivePrices(map);
      })
      .finally(() => setPricesLoading(false));
  }, [openTickerStr, openTrades.length]);

  useEffect(() => {
    if (!correlationGuard || openTrades.filter((t) => t.bias === "LONG").length < 2) {
      setCorrelationAlerts([]);
      return;
    }
    const tickers = openTrades.filter((t) => t.bias === "LONG").map((t) => t.ticker);
    if (tickers.length === 0) return;
    let cancelled = false;
    fetch(`/api/ohlcv?tickers=${tickers.join(",")}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setPriceHistory(data);
      })
      .catch(() => setPriceHistory({}));
    return () => { cancelled = true; };
  }, [correlationGuard, openTrades]);

  useEffect(() => {
    if (!correlationGuard || Object.keys(priceHistory).length < 2) {
      setCorrelationAlerts([]);
      return;
    }
    const longs = openTrades.filter((t) => t.bias === "LONG");
    const warnings = checkPortfolioCorrelation(longs, priceHistory, accountSize);
    setCorrelationAlerts(
      warnings.map((w) => ({
        severity: w.warningLevel as "HIGH" | "MEDIUM",
        message: `${w.ticker1} + ${w.ticker2}: ${w.correlation.toFixed(2)} correlation — effectively the same position`,
      }))
    );
  }, [correlationGuard, openTrades, priceHistory, accountSize]);

  // currentPrices must be in useMemo — NOT a bare for loop — to keep hooks in fixed order
  const currentPrices = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of openTrades) {
      map[t.ticker] = livePrices[t.ticker] ?? t.entryPrice;
    }
    return map;
  }, [openTrades, livePrices]);

  const sectorExposure = useMemo(() => {
    const bySector: Record<
      string,
      { dollarExposure: number; percentOfPortfolio: number }
    > = {};
    for (const t of openTrades) {
      const sector = t.sector ?? getSectorForTicker(t.ticker);
      const exposure = t.entryPrice * t.shares;
      if (!bySector[sector]) {
        bySector[sector] = { dollarExposure: 0, percentOfPortfolio: 0 };
      }
      bySector[sector].dollarExposure += exposure;
    }
    const total = Object.values(bySector).reduce((s, x) => s + x.dollarExposure, 0);
    for (const k of Object.keys(bySector)) {
      bySector[k].percentOfPortfolio =
        accountSize > 0
          ? (bySector[k].dollarExposure / accountSize) * 100
          : 0;
    }
    return Object.entries(bySector).sort(
      (a, b) => b[1].percentOfPortfolio - a[1].percentOfPortfolio
    );
  }, [openTrades, accountSize]);

  const concentrationWarning = sectorExposure.find(
    ([, d]) => d.percentOfPortfolio > 30
  );

  const filteredTrades = useMemo(() => {
    if (strategyFilter === "All") return trades;
    return trades.filter((t) => t.strategy === strategyFilter);
  }, [trades, strategyFilter]);

  const filteredOpenTrades = useMemo(() => {
    if (strategyFilter === "All") return openTrades;
    return openTrades.filter((t) => t.strategy === strategyFilter);
  }, [openTrades, strategyFilter]);

  const metrics = computePerformanceMetrics(filteredTrades ?? []);
  const portfolioMetrics = (() => {
    try {
      return computePortfolioMetrics(filteredOpenTrades, currentPrices, accountSize);
    } catch {
      return {
        alerts: [] as PortfolioAlert[],
        totalLongExposure: 0,
        totalShortExposure: 0,
        netExposure: 0,
        totalExposurePercent: 0,
        openPositions: 0,
        longCount: 0,
        shortCount: 0,
        sectorBreakdown: {},
        totalDollarAtRisk: 0,
        percentAtRisk: 0,
        openRiskBySector: {},
        avgHoldDays: 0,
        holdsByStrategy: {},
        betaWeightedExposure: 0,
      };
    }
  })();
  const allAlerts = [...(portfolioMetrics.alerts ?? []), ...correlationAlerts];

  function formatDaysHeld(entryDate: string): string {
    const days = Math.floor(
      (Date.now() - new Date(entryDate).getTime()) / 86400000
    );
    if (days < 7) return `${days}d`;
    if (days >= 8 && days <= 13) return "2w";
    if (days >= 14 && days <= 20) return "3w";
    if (days >= 30) return "1m+";
    return `${days}d`;
  }

  const handleLogTrade = () => {
    if (!logForm.ticker.trim() || logForm.entryPrice <= 0 || logForm.shares <= 0) return;
    const entryPrice = logForm.entryPrice;
    const totalCost = entryPrice * logForm.shares;
    const riskPerShare = Math.abs(entryPrice - logForm.plannedStop);
    const rewardPerShare = Math.abs(logForm.plannedT1 - entryPrice);
    const plannedRR =
      logForm.bias === "LONG"
        ? riskPerShare > 0
          ? (logForm.plannedT1 - entryPrice) / (entryPrice - logForm.plannedStop)
          : 1.5
        : riskPerShare > 0
        ? (entryPrice - logForm.plannedT1) / (logForm.plannedStop - entryPrice)
        : 1.5;
    const stock = UNIVERSE.find(
      (s) => s.ticker.toUpperCase() === logForm.ticker.toUpperCase()
    );
    addTrade({
      ticker: logForm.ticker.toUpperCase().trim(),
      companyName: stock?.companyName ?? logForm.ticker,
      bias: logForm.bias,
      setupName: logForm.setupName || "Manual",
      setupGrade: "C",
      strategy: logForm.strategy,
      entryDate: logForm.entryDate,
      entryPrice,
      shares: logForm.shares,
      totalCost,
      plannedStop: logForm.plannedStop,
      plannedT1: logForm.plannedT1,
      plannedT2: logForm.plannedT2,
      plannedT3: logForm.plannedT3,
      plannedRR,
      plannedHoldDuration: "Swing",
      sector: stock?.sector,
      notes: logForm.notes.trim() || undefined,
    });
    setLogForm({
      ticker: "",
      bias: "LONG",
      strategy: "Swing",
      entryDate: new Date().toISOString().slice(0, 10),
      entryPrice: 0,
      shares: 0,
      plannedStop: 0,
      plannedT1: 0,
      plannedT2: 0,
      plannedT3: 0,
      setupName: "",
      notes: "",
    });
    setLogTradeModalOpen(false);
  };

  const STRATEGIES: TradeStrategy[] = [
    "Swing",
    "Position",
    "Quality Growth",
    "Deep Value",
  ];

  return (
    <div className="min-h-screen bg-[var(--background-base)] p-4">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-mono text-2xl font-bold text-[var(--text-primary)]">
            Portfolio
          </h1>
          <button
            onClick={() => setLogTradeModalOpen(true)}
            className="rounded bg-[var(--signal-neutral)] px-4 py-2 font-mono text-xs font-medium text-white hover:opacity-90"
          >
            Log Trade
          </button>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
            <p className="font-mono text-xs text-[var(--text-muted)]">Total Exposure</p>
            <p className="font-mono text-lg font-bold tabular-nums text-[var(--text-primary)]">
              {formatCurrency(
                portfolioMetrics.totalLongExposure + portfolioMetrics.totalShortExposure
              )}
            </p>
            <p className="font-mono text-xs text-[var(--text-secondary)]">
              {portfolioMetrics.totalExposurePercent.toFixed(1)}% of account
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
            <p className="font-mono text-xs text-[var(--text-muted)]">Open P&L</p>
            <p className="font-mono text-lg font-bold tabular-nums text-[var(--text-primary)]">—</p>
            <p className="font-mono text-xs text-[var(--text-secondary)]">
              {openTrades.length} open positions
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
            <p className="font-mono text-xs text-[var(--text-muted)]">Long / Short</p>
            <p className="font-mono text-lg font-bold tabular-nums text-[var(--text-primary)]">
              {portfolioMetrics.longCount} / {portfolioMetrics.shortCount}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
            <p className="font-mono text-xs text-[var(--text-muted)]">$ at Risk</p>
            <p className="font-mono text-lg font-bold tabular-nums text-[var(--signal-short)]">
              {formatCurrency(portfolioMetrics.totalDollarAtRisk)}
            </p>
            <p className="font-mono text-xs text-[var(--text-secondary)]">
              {portfolioMetrics.percentAtRisk.toFixed(1)}% of account
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
            <p className="font-mono text-xs text-[var(--text-muted)]">Win Rate</p>
            <p className="font-mono text-lg font-bold tabular-nums text-[var(--text-primary)]">
              {(metrics.winRate * 100).toFixed(0)}%
            </p>
            <p className="font-mono text-xs text-[var(--text-secondary)]">
              {metrics.totalTrades} closed trades
            </p>
          </div>
        </div>

        <div
          className="mb-6 grid gap-4"
          style={{ gridTemplateColumns: "3fr 2fr" }}
        >
          <div>
            <h2 className="mb-4 font-mono text-sm font-semibold text-[var(--text-secondary)]">
              OPEN POSITIONS
            </h2>
            {filteredOpenTrades.length === 0 ? (
              <p className="font-sans text-sm text-[var(--text-muted)]">
                {strategyFilter === "All"
                  ? "No open positions. Log a trade from the screener or analysis page."
                  : `No open ${strategyFilter} positions.`}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-default)] bg-[var(--background-surface)]">
                      <th className="px-4 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">Ticker</th>
                      <th className="px-4 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">Entry</th>
                      <th className="px-4 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">Current</th>
                      <th className="px-4 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">Shares</th>
                      <th className="px-4 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">Stop</th>
                      <th className="px-4 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">T1</th>
                      <th className="px-4 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">Strategy</th>
                      <th className="px-4 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">P&L</th>
                      <th className="px-4 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">Held</th>
                      <th className="px-4 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">vs Stop</th>
                      <th className="px-4 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">vs T1</th>
                      <th className="w-20 px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOpenTrades.map((t) => {
                      const price = livePrices[t.ticker];
                      const currentPrice =
                        price != null && !Number.isNaN(price) ? price : t.entryPrice;
                      const unrealizedPL =
                        t.bias === "LONG"
                          ? (currentPrice - t.entryPrice) * t.shares
                          : (t.entryPrice - currentPrice) * t.shares;
                      const unrealizedPct =
                        ((currentPrice - t.entryPrice) / t.entryPrice) *
                        100 *
                        (t.bias === "LONG" ? 1 : -1);
                      const vsStopPct =
                        t.bias === "LONG"
                          ? ((currentPrice - t.plannedStop) / t.plannedStop) * 100
                          : ((t.plannedStop - currentPrice) / t.plannedStop) * 100;
                      const vsT1Pct =
                        t.bias === "LONG"
                          ? ((t.plannedT1 - currentPrice) / currentPrice) * 100
                          : ((currentPrice - t.plannedT1) / currentPrice) * 100;
                      const t1Reached =
                        (t.bias === "LONG" && currentPrice >= t.plannedT1) ||
                        (t.bias === "SHORT" && currentPrice <= t.plannedT1);
                      return (
                        <tr
                          key={t.id}
                          className={cn(
                            "border-b border-[var(--border-default)]",
                            t.bias === "LONG" &&
                              "border-l-[3px] border-l-[var(--signal-long-muted)]",
                            t.bias === "SHORT" &&
                              "border-l-[3px] border-l-[var(--signal-short-muted)]"
                          )}
                        >
                          <td className="px-4 py-2">
                            <Link
                              href={`/analysis/${t.ticker}`}
                              className="font-mono text-sm font-bold text-[var(--signal-neutral)] hover:underline"
                            >
                              {t.ticker}
                            </Link>
                          </td>
                          <td className="px-4 py-2 font-mono text-xs tabular-nums">
                            {formatCurrency(t.entryPrice)}
                          </td>
                          <td className="px-4 py-2">
                            {pricesLoading && livePrices[t.ticker] == null ? (
                              <span className="inline-block h-4 w-14 animate-pulse rounded bg-[var(--background-subtle)]" />
                            ) : price != null && !Number.isNaN(price) ? (
                              <span className="font-mono text-xs tabular-nums">
                                {formatCurrency(currentPrice)}
                              </span>
                            ) : (
                              <span className="font-mono text-xs text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs tabular-nums">
                            {t.shares}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs tabular-nums text-[var(--signal-short)]">
                            {formatCurrency(t.plannedStop)}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs tabular-nums text-[var(--signal-long)]">
                            {formatCurrency(t.plannedT1)}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs">
                            {t.strategy}
                          </td>
                          <td className="px-4 py-2">
                            {price != null && !Number.isNaN(price) ? (
                              <span
                                className={cn(
                                  "font-mono text-xs tabular-nums",
                                  unrealizedPL >= 0 ? "text-[#00D084]" : "text-[#FF4D6A]"
                                )}
                              >
                                {unrealizedPL >= 0 ? "+" : ""}
                                {formatCurrency(unrealizedPL)} (
                                {unrealizedPct >= 0 ? "+" : ""}
                                {unrealizedPct.toFixed(1)}%)
                              </span>
                            ) : (
                              <span className="font-mono text-xs text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                            {formatDaysHeld(t.entryDate)}
                          </td>
                          <td className="px-4 py-2">
                            {price != null && !Number.isNaN(price) ? (
                              <span
                                className={cn(
                                  "font-mono text-xs",
                                  vsStopPct > 5 && "text-[#00D084]",
                                  vsStopPct >= 2 &&
                                    vsStopPct <= 5 &&
                                    "text-[var(--text-secondary)]",
                                  vsStopPct >= 0 &&
                                    vsStopPct < 2 &&
                                    "text-[var(--regime-choppy)]",
                                  vsStopPct < 0 && "text-[#FF4D6A]"
                                )}
                              >
                                {vsStopPct >= 0
                                  ? `+${vsStopPct.toFixed(1)}% from stop${vsStopPct < 2 ? " — near stop" : ""}`
                                  : `${vsStopPct.toFixed(1)}% — near stop`}
                              </span>
                            ) : (
                              <span className="font-mono text-xs text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {price != null && !Number.isNaN(price) ? (
                              t1Reached ? (
                                <span className="font-mono text-xs text-[#00D084]">
                                  T1 reached ✓
                                </span>
                              ) : (
                                <span className="font-mono text-xs text-[var(--text-secondary)]">
                                  {vsT1Pct.toFixed(1)}% to T1
                                </span>
                              )
                            ) : (
                              <span className="font-mono text-xs text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => {
                                setTradeToClose(t);
                                setCloseTradeModalOpen(true);
                              }}
                              className="rounded border border-[var(--signal-short)] px-2 py-1 font-mono text-xs text-[var(--signal-short)] hover:bg-[var(--signal-short)]/10"
                            >
                              Close
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
              <h3 className="mb-4 font-mono text-xs font-semibold text-[var(--text-secondary)]">
                SECTOR EXPOSURE
              </h3>
              {sectorExposure.length === 0 ? (
                <p className="font-sans text-xs text-[var(--text-muted)]">
                  No open positions
                </p>
              ) : (
                <div className="space-y-3">
                  {sectorExposure.map(([sector, data]) => (
                    <div key={sector} className="flex items-center gap-3">
                      <span
                        className="w-[120px] shrink-0 font-mono text-xs text-[var(--text-secondary)]"
                        style={{ minWidth: 120 }}
                      >
                        {sector}
                      </span>
                      <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full"
                        style={{ minWidth: 60 }}
                      >
                        <div
                          className={cn(
                            "h-full rounded-full",
                            data.percentOfPortfolio > 30 &&
                              "bg-[var(--regime-choppy)]",
                            data.percentOfPortfolio > 15 &&
                              data.percentOfPortfolio <= 30 &&
                              "bg-blue-500/60",
                            data.percentOfPortfolio <= 15 && "bg-teal-500/60"
                          )}
                          style={{
                            width: `${Math.min(
                              data.percentOfPortfolio * 3,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                        {data.percentOfPortfolio.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                  {concentrationWarning && (
                    <p className="mt-2 font-sans text-xs text-[var(--regime-choppy)]">
                      {concentrationWarning[0]} at{" "}
                      {concentrationWarning[1].percentOfPortfolio.toFixed(0)}% —
                      consider diversifying
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
              <h3 className="mb-2 font-mono text-xs font-semibold text-[var(--text-secondary)]">
                ALERTS & FLAGS
              </h3>
              {allAlerts.length === 0 ? (
                <p className="font-sans text-xs text-[var(--text-muted)]">
                  No alerts
                </p>
              ) : (
                <ul className="space-y-1">
                  {allAlerts.map((a, i) => (
                    <li
                      key={i}
                      className={cn(
                        "flex items-center gap-2 font-sans text-xs",
                        a.severity === "HIGH" && "text-[var(--signal-short)]",
                        a.severity === "MEDIUM" &&
                          "text-[var(--regime-choppy)]",
                        a.severity === "LOW" && "text-[var(--text-muted)]"
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          a.severity === "HIGH" && "bg-[var(--signal-short)]",
                          a.severity === "MEDIUM" &&
                            "bg-[var(--regime-choppy)]",
                          a.severity === "LOW" && "bg-[var(--text-muted)]"
                        )}
                      />
                      {a.ticker && `${a.ticker}: `}
                      {a.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-mono text-sm font-semibold text-[var(--text-secondary)]">
              PERFORMANCE SUMMARY
            </h2>
            <div className="flex rounded border border-[var(--border-default)] bg-[var(--background-surface)] p-0.5">
              {(["All", "Swing", "Position", "Quality Growth", "Deep Value"] as const).map(
                (opt) => (
                  <button
                    key={opt}
                    onClick={() => setStrategyFilter(opt)}
                    className={cn(
                      "rounded px-2 py-1 font-mono text-xs transition-colors",
                      strategyFilter === opt
                        ? "border border-[var(--signal-neutral)] bg-[var(--background-elevated)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {opt === "Quality Growth" ? "Quality" : opt === "Deep Value" ? "Value" : opt}
                  </button>
                )
              )}
            </div>
            <Link
              href="/portfolio/performance"
              className="font-mono text-xs text-[var(--signal-neutral)] hover:underline"
            >
              View Full Performance
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
              <p className="font-mono text-xs text-[var(--text-muted)]">Total P&L</p>
              <p
                className={cn(
                  "font-mono text-lg font-bold tabular-nums",
                  metrics.totalRealizedPL >= 0
                    ? "text-[var(--signal-long)]"
                    : "text-[var(--signal-short)]"
                )}
              >
                {formatCurrency(metrics.totalRealizedPL)}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
              <p className="font-mono text-xs text-[var(--text-muted)]">Expectancy</p>
              <p className="font-mono text-lg font-bold tabular-nums text-[var(--text-primary)]">
                {formatPercent(metrics.expectancy)}/trade
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
              <p className="font-mono text-xs text-[var(--text-muted)]">Profit Factor</p>
              <p className="font-mono text-lg font-bold tabular-nums text-[var(--text-primary)]">
                {metrics.profitFactor.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
              <p className="font-mono text-xs text-[var(--text-muted)]">Avg Hold</p>
              <p className="font-mono text-lg font-bold tabular-nums text-[var(--text-primary)]">
                {metrics.avgHoldDays.toFixed(0)} days
              </p>
            </div>
          </div>
        </div>

        <CloseTradeModal
          open={closeTradeModalOpen}
          onOpenChange={(open) => {
            setCloseTradeModalOpen(open);
            if (!open) setTradeToClose(null);
          }}
          trade={tradeToClose}
          onClose={closeTrade}
        />

        <PortfolioWatchlist />

        <div className="mt-8">
          <Link
            href="/screener"
            className="font-mono text-sm text-[var(--signal-neutral)] hover:underline"
          >
            ← Back to Screener
          </Link>
        </div>
      </div>

      <Dialog open={logTradeModalOpen} onOpenChange={setLogTradeModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono">Log Trade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                Ticker *
              </label>
              <input
                type="text"
                value={logForm.ticker}
                onChange={(e) =>
                  setLogForm((f) => ({ ...f, ticker: e.target.value }))
                }
                className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-mono text-sm"
                placeholder="AAPL"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                Bias
              </label>
              <div className="flex gap-2">
                {(["LONG", "SHORT"] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => setLogForm((f) => ({ ...f, bias: b }))}
                    className={cn(
                      "rounded border px-3 py-1.5 font-mono text-xs",
                      logForm.bias === b
                        ? "border-[var(--signal-neutral)] bg-[var(--background-elevated)]"
                        : "border-[var(--border-default)]"
                    )}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                Strategy
              </label>
              <select
                value={logForm.strategy}
                onChange={(e) =>
                  setLogForm((f) => ({
                    ...f,
                    strategy: e.target.value as TradeStrategy,
                  }))
                }
                className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-mono text-sm"
              >
                {STRATEGIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                Entry Date
              </label>
              <input
                type="date"
                value={logForm.entryDate}
                onChange={(e) =>
                  setLogForm((f) => ({ ...f, entryDate: e.target.value }))
                }
                className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-mono text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Entry Price *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={logForm.entryPrice || ""}
                  onChange={(e) =>
                    setLogForm((f) => ({
                      ...f,
                      entryPrice: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Shares *
                </label>
                <input
                  type="number"
                  min={1}
                  value={logForm.shares || ""}
                  onChange={(e) =>
                    setLogForm((f) => ({
                      ...f,
                      shares: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Planned Stop
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={logForm.plannedStop || ""}
                  onChange={(e) =>
                    setLogForm((f) => ({
                      ...f,
                      plannedStop: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Planned T1
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={logForm.plannedT1 || ""}
                  onChange={(e) =>
                    setLogForm((f) => ({
                      ...f,
                      plannedT1: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Planned T2
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={logForm.plannedT2 || ""}
                  onChange={(e) =>
                    setLogForm((f) => ({
                      ...f,
                      plannedT2: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Planned T3
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={logForm.plannedT3 || ""}
                  onChange={(e) =>
                    setLogForm((f) => ({
                      ...f,
                      plannedT3: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                Setup Name
              </label>
              <input
                type="text"
                value={logForm.setupName}
                onChange={(e) =>
                  setLogForm((f) => ({ ...f, setupName: e.target.value }))
                }
                className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-sans text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                Notes
              </label>
              <textarea
                value={logForm.notes}
                onChange={(e) =>
                  setLogForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={2}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-sans text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setLogTradeModalOpen(false)}
              className="rounded border border-[var(--border-default)] px-3 py-1.5 font-mono text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleLogTrade}
              disabled={
                !logForm.ticker.trim() ||
                logForm.entryPrice <= 0 ||
                logForm.shares <= 0
              }
              className="rounded bg-[var(--signal-neutral)] px-3 py-1.5 font-mono text-xs text-white disabled:opacity-50"
            >
              Log Trade
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
