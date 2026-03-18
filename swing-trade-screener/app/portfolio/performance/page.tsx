"use client";

import { useMemo, useRef, useEffect } from "react";
import { createChart } from "lightweight-charts";
import { useTradeLogStore } from "@/lib/stores/tradeLogStore";
import { computePerformanceMetrics } from "@/lib/utils/performanceAnalytics";
import { formatCurrency, formatPercent } from "@/lib/utils/formatter";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";

function useCumulativePLData() {
  const closedTrades = useTradeLogStore((s) => s.getClosedTrades());

  return useMemo(() => {
    const sorted = [...closedTrades]
      .filter((t) => t.exitDate && t.realizedPL != null)
      .sort(
        (a, b) =>
          new Date(a.exitDate!).getTime() - new Date(b.exitDate!).getTime()
      );
    let cum = 0;
    return sorted.map((t) => {
      cum += t.realizedPL ?? 0;
      return {
        time: t.exitDate!,
        value: cum,
      };
    });
  }, [closedTrades]);
}

function useMonthlyWinLoss() {
  const closedTrades = useTradeLogStore((s) => s.getClosedTrades());

  return useMemo(() => {
    const byMonth: Record<
      string,
      { wins: number; losses: number; pl: number }
    > = {};
    for (const t of closedTrades) {
      if (!t.exitDate || t.realizedPL == null) continue;
      const month = t.exitDate.slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { wins: 0, losses: 0, pl: 0 };
      byMonth[month].pl += t.realizedPL;
      if (t.realizedPL > 0) byMonth[month].wins++;
      else byMonth[month].losses++;
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));
  }, [closedTrades]);
}

function CumulativePLChart({ data }: { data: { time: string; value: number }[] }) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    const chart = createChart(chartRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      width: chartRef.current.clientWidth,
      height: 280,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#374151",
      },
    });

    const lineSeries = chart.addLineSeries({
      color: "#10b981",
      lineWidth: 2,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });

    const chartData = data.map((d) => ({
      time: d.time as string,
      value: d.value,
    }));
    lineSeries.setData(chartData);

    const handleResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] font-mono text-sm text-[var(--text-muted)]">
        No closed trades — chart will appear after closing positions
      </div>
    );
  }

  return <div ref={chartRef} className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)]" />;
}

function MonthlyBarChart({ data }: { data: { month: string; wins: number; losses: number; pl: number }[] }) {
  if (data.length === 0) return null;

  const maxCount = Math.max(...data.map((d) => d.wins + d.losses), 1);

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
      <h3 className="mb-4 font-mono text-xs font-semibold text-[var(--text-secondary)]">
        WIN / LOSS BY MONTH
      </h3>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.month} className="flex items-center gap-3">
            <span className="w-20 shrink-0 font-mono text-xs text-[var(--text-muted)]">
              {d.month}
            </span>
            <div className="flex flex-1 gap-1">
              <div
                className="h-5 rounded-l bg-[var(--signal-long)]/60"
                style={{
                  width: `${(d.wins / maxCount) * 100}%`,
                  minWidth: d.wins > 0 ? 4 : 0,
                }}
                title={`${d.wins} wins`}
              />
              <div
                className="h-5 rounded-r bg-[var(--signal-short)]/60"
                style={{
                  width: `${(d.losses / maxCount) * 100}%`,
                  minWidth: d.losses > 0 ? 4 : 0,
                }}
                title={`${d.losses} losses`}
              />
            </div>
            <span
              className={cn(
                "w-16 shrink-0 text-right font-mono text-xs tabular-nums",
                d.pl >= 0 ? "text-[var(--signal-long)]" : "text-[var(--signal-short)]"
              )}
            >
              {formatCurrency(d.pl)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function exportToCSV(
  trades: Array<{
    ticker: string;
    companyName: string;
    bias: string;
    setupName: string;
    setupGrade: string;
    strategy: string;
    entryDate: string;
    entryPrice: number;
    shares: number;
    exitDate?: string;
    exitPrice?: number;
    exitReason?: string;
    realizedPL?: number;
    realizedPLPercent?: number;
    holdDays?: number;
  }>
) {
  const closed = trades.filter((t) => t.exitDate && t.realizedPL != null);
  if (closed.length === 0) return;

  const headers = [
    "Ticker",
    "Company",
    "Bias",
    "Setup",
    "Grade",
    "Strategy",
    "Entry Date",
    "Entry Price",
    "Shares",
    "Exit Date",
    "Exit Price",
    "Exit Reason",
    "Realized P&L",
    "P&L %",
    "Hold Days",
  ];
  const rows = closed.map((t) => [
    t.ticker,
    t.companyName,
    t.bias,
    t.setupName,
    t.setupGrade,
    t.strategy,
    t.entryDate,
    t.entryPrice,
    t.shares,
    t.exitDate ?? "",
    t.exitPrice ?? "",
    t.exitReason ?? "",
    t.realizedPL ?? 0,
    t.realizedPLPercent ?? 0,
    t.holdDays ?? 0,
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `edgescreen-performance-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PerformancePage() {
  const trades = useTradeLogStore((s) => s.trades);
  const closedTrades = useTradeLogStore((s) => s.getClosedTrades());
  const cumData = useCumulativePLData();
  const monthlyData = useMonthlyWinLoss();
  const metrics = computePerformanceMetrics(trades);

  const totalCost = closedTrades.reduce((s, t) => s + t.totalCost, 0);
  const tradesPerMonth =
    metrics.avgHoldDays > 0 ? 30 / metrics.avgHoldDays : 0;
  const avgPositionSize = metrics.totalTrades > 0 ? totalCost / metrics.totalTrades : 0;
  const expectancyPerMonth =
    metrics.totalTrades > 0 && avgPositionSize > 0
      ? (metrics.expectancy / 100) * avgPositionSize * tradesPerMonth
      : 0;

  return (
    <div className="min-h-screen bg-[var(--background-base)] p-4">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-mono text-2xl font-bold text-[var(--text-primary)]">
            Performance History
          </h1>
          <div className="flex gap-2">
            <Link
              href="/portfolio"
              className="rounded border border-[var(--border-default)] px-3 py-2 font-mono text-xs text-[var(--text-secondary)] hover:bg-[var(--background-subtle)]"
            >
              ← Portfolio
            </Link>
            <button
              onClick={() => exportToCSV(trades)}
              disabled={closedTrades.length === 0}
              className="rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-mono text-xs text-[var(--signal-neutral)] hover:bg-[var(--background-subtle)] disabled:opacity-50"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
          <p className="font-mono text-sm text-[var(--text-secondary)]">
            Your expectancy is{" "}
            <span className="font-bold text-[var(--text-primary)]">
              {formatPercent(metrics.expectancy)} per trade
            </span>
            . At your current pace, that&apos;s approximately{" "}
            <span className="font-bold text-[var(--text-primary)]">
              {formatCurrency(expectancyPerMonth)}/month
            </span>
            .
          </p>
        </div>

        <div className="mb-8">
          <h2 className="mb-4 font-mono text-sm font-semibold text-[var(--text-secondary)]">
            CUMULATIVE P&L
          </h2>
          <CumulativePLChart data={cumData} />
        </div>

        <div className="mb-8">
          <MonthlyBarChart data={monthlyData} />
        </div>

        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="mb-4 font-mono text-sm font-semibold text-[var(--text-secondary)]">
              SETUP PERFORMANCE
            </h2>
            <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-default)] bg-[var(--background-surface)]">
                    <th className="px-4 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">
                      Setup
                    </th>
                    <th className="px-4 py-2 text-right font-mono text-xs font-medium text-[var(--text-secondary)]">
                      Trades
                    </th>
                    <th className="px-4 py-2 text-right font-mono text-xs font-medium text-[var(--text-secondary)]">
                      Win Rate
                    </th>
                    <th className="px-4 py-2 text-right font-mono text-xs font-medium text-[var(--text-secondary)]">
                      Avg Return
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(metrics.bySetup).map(([setup, s]) => (
                    <tr
                      key={setup}
                      className="border-b border-[var(--border-default)]"
                    >
                      <td className="px-4 py-2 font-mono text-xs">
                        {setup}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">
                        {s.trades}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">
                        {(s.winRate * 100).toFixed(0)}%
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2 text-right font-mono text-xs tabular-nums",
                          s.avgReturn >= 0
                            ? "text-[var(--signal-long)]"
                            : "text-[var(--signal-short)]"
                        )}
                      >
                        {formatPercent(s.avgReturn)}
                      </td>
                    </tr>
                  ))}
                  {Object.keys(metrics.bySetup).length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center font-mono text-xs text-[var(--text-muted)]"
                      >
                        No closed trades yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="mb-4 font-mono text-sm font-semibold text-[var(--text-secondary)]">
              GRADE PERFORMANCE
            </h2>
            <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-default)] bg-[var(--background-surface)]">
                    <th className="px-4 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">
                      Grade
                    </th>
                    <th className="px-4 py-2 text-right font-mono text-xs font-medium text-[var(--text-secondary)]">
                      Trades
                    </th>
                    <th className="px-4 py-2 text-right font-mono text-xs font-medium text-[var(--text-secondary)]">
                      Win Rate
                    </th>
                    <th className="px-4 py-2 text-right font-mono text-xs font-medium text-[var(--text-secondary)]">
                      Avg Return
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {["A+", "A", "B", "C"].map((grade) => {
                    const g = metrics.byGrade[grade];
                    if (!g) return null;
                    return (
                      <tr
                        key={grade}
                        className="border-b border-[var(--border-default)]"
                      >
                        <td className="px-4 py-2 font-mono text-xs font-bold">
                          {grade}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">
                          {g.trades}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">
                          {(g.winRate * 100).toFixed(0)}%
                        </td>
                        <td
                          className={cn(
                            "px-4 py-2 text-right font-mono text-xs tabular-nums",
                            g.avgReturn >= 0
                              ? "text-[var(--signal-long)]"
                              : "text-[var(--signal-short)]"
                          )}
                        >
                          {formatPercent(g.avgReturn)}
                        </td>
                      </tr>
                    );
                  })}
                  {Object.keys(metrics.byGrade).length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center font-mono text-xs text-[var(--text-muted)]"
                      >
                        No closed trades yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
