"use client";

import { useMemo, useState } from "react";
import { SetupBadge } from "./SetupBadge";
import { GradeBadge } from "./GradeBadge";
import { useFeature } from "@/lib/hooks/useFeature";
import type { ScreenerResult, ContractRecommendation } from "@/types";
import { formatCurrency, formatPercent } from "@/lib/utils/formatter";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

const STRUCTURE_LABELS: Record<string, string> = {
  long_call: "Long Call",
  long_put: "Long Put",
  bull_call_spread: "Bull Call Spread",
  bear_put_spread: "Bear Put Spread",
  pmcc: "PMCC",
  none: "None",
};

interface ResultsTableProps {
  results: ScreenerResult[];
  onExportCSV?: () => void;
  scanProgress?: { current: number; total: number };
  isLoading?: boolean;
  optionsMode?: "Stocks" | "Options" | "Both";
  optionsRecommendations?: Record<string, ContractRecommendation | null>;
}

type SortKey = "ticker" | "price" | "grade" | "rr" | "entry" | "stop" | "hold";

export function ResultsTable({
  results,
  onExportCSV,
  scanProgress,
  isLoading,
  optionsMode = "Stocks",
  optionsRecommendations = {},
}: ResultsTableProps) {
  const optionsLayer = useFeature("OPTIONS_LAYER");
  const showOptionsCols =
    optionsLayer &&
    (optionsMode === "Options" || optionsMode === "Both");
  const [sortKey, setSortKey] = useState<SortKey>("grade");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [clickedTicker, setClickedTicker] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...results].sort((a, b) => {
      let va: number | string;
      let vb: number | string;
      if (sortKey === "grade") {
        const order = { "A+": 4, A: 3, B: 2, C: 1 };
        va = order[a.primarySetup.grade];
        vb = order[b.primarySetup.grade];
      } else if (sortKey === "rr") {
        va = a.primarySetup.tradeParams.riskReward.toT1;
        vb = b.primarySetup.tradeParams.riskReward.toT1;
      } else if (sortKey === "price") {
        va = a.price;
        vb = b.price;
      } else if (sortKey === "ticker") {
        va = a.ticker;
        vb = b.ticker;
      } else if (sortKey === "entry") {
        va = a.primarySetup.tradeParams.entry.zone[0];
        vb = b.primarySetup.tradeParams.entry.zone[0];
      } else if (sortKey === "stop") {
        va = a.primarySetup.tradeParams.stop.price;
        vb = b.primarySetup.tradeParams.stop.price;
      } else {
        va = a.primarySetup.tradeParams.holdDuration;
        vb = b.primarySetup.tradeParams.holdDuration;
      }
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const cmp = String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [results, sortKey, sortDir]);

  const sort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else setSortKey(key);
  };

  const Th = ({
    children,
    sortKey: k,
    width,
  }: {
    children: React.ReactNode;
    sortKey?: SortKey;
    width: string;
  }) => (
    <th
      className={cn(
        "cursor-pointer border-b border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2.5 text-left font-mono text-xs font-medium transition-colors hover:bg-[var(--background-subtle)]",
        k && sortKey === k && "text-[var(--signal-neutral)]"
      )}
      style={{ width }}
      onClick={() => k && sort(k)}
    >
      <span className="flex items-center gap-1">
        {children}
        {k && sortKey === k && (
          <span className="text-[var(--text-muted)]">{sortDir === "asc" ? "↑" : "↓"}</span>
        )}
      </span>
    </th>
  );

  const getVolColor = (vol: number) => {
    if (vol >= 2.5) return "text-[var(--volume-climactic)]";
    if (vol >= 1.5) return "text-[var(--volume-institutional)]";
    return "text-[var(--volume-weak)]";
  };

  const getRRColor = (rr: number) => {
    if (rr >= 2) return "text-[var(--signal-long)]";
    if (rr >= 1.5) return "text-[var(--regime-choppy)]";
    return "text-[var(--text-muted)]";
  };

  const handleRowClick = (ticker: string) => {
    setClickedTicker(ticker);
    setTimeout(() => setClickedTicker(null), 100);
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-2">
        {scanProgress && isLoading && (
          <div className="flex-1">
            <div className="h-0.5 w-48 overflow-hidden rounded-full bg-[var(--background-subtle)]">
              <div
                className="h-full bg-[var(--signal-neutral)] transition-all duration-300"
                style={{
                  width: `${(scanProgress.current / scanProgress.total) * 100}%`,
                }}
              />
            </div>
            <p className="font-mono text-xs text-[var(--text-secondary)]">
              Scanning {scanProgress.current} / {scanProgress.total} tickers
            </p>
          </div>
        )}
        <div className="ml-auto flex items-center gap-4">
          <span className="font-mono text-xs text-[var(--text-secondary)]">
            {results.length} results
          </span>
          {onExportCSV && (
            <button
              onClick={onExportCSV}
              className="font-mono text-xs text-[var(--signal-neutral)] hover:underline"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      <div id="results-scroll" className="max-h-[calc(100vh-280px)] overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <Th sortKey="ticker" width="120px">Ticker</Th>
              <Th sortKey="price" width="100px">Price</Th>
              <Th sortKey="grade" width="160px">Setup</Th>
              <Th sortKey="grade" width="64px">Grade</Th>
              {showOptionsCols && <Th width="72px">IVP</Th>}
              {showOptionsCols && <Th width="120px">Contract</Th>}
              {showOptionsCols && <Th width="80px">Max Risk</Th>}
              {showOptionsCols && <Th width="56px">PoP</Th>}
              {showOptionsCols && <Th width="64px">Structure</Th>}
              <Th sortKey="entry" width="130px">Entry Zone</Th>
              <Th sortKey="stop" width="110px">Stop Loss</Th>
              <Th width="140px">T1 / T2</Th>
              <Th sortKey="rr" width="72px">R:R</Th>
              <Th sortKey="hold" width="96px">Hold</Th>
              <Th width="100px">Vol vs Avg</Th>
              <Th width="1fr">Signals</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={11 + (showOptionsCols ? 5 : 0)} className="py-16 text-center">
                  <p className="font-mono text-sm text-[var(--text-muted)]">
                    No setups match your filters
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <button
                      onClick={() => {}}
                      className="rounded border border-[var(--border-default)] px-3 py-1 font-mono text-xs text-[var(--text-secondary)] hover:bg-[var(--background-subtle)]"
                    >
                      Relax grade filter
                    </button>
                    <button
                      onClick={() => {}}
                      className="rounded border border-[var(--border-default)] px-3 py-1 font-mono text-xs text-[var(--text-secondary)] hover:bg-[var(--background-subtle)]"
                    >
                      Lower min R:R
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map((r, i) => (
                <tr
                  key={r.ticker}
                  className={cn(
                    "animate-row-enter border-b border-[var(--border-default)] transition-colors",
                    i % 2 === 1 && "bg-[var(--background-subtle)]",
                    r.primarySetup.bias === "LONG" && "border-l-[3px] border-l-[var(--signal-long-muted)]",
                    r.primarySetup.bias === "SHORT" && "border-l-[3px] border-l-[var(--signal-short-muted)]",
                    "hover:bg-[var(--background-subtle)]",
                    clickedTicker === r.ticker && r.primarySetup.bias === "LONG" && "bg-[var(--signal-long-muted)]",
                    clickedTicker === r.ticker && r.primarySetup.bias === "SHORT" && "bg-[var(--signal-short-muted)]"
                  )}
                  style={{ animationDelay: `${Math.min(i * 20, 400)}ms` }}
                >
                  <td className="w-[120px] px-3 py-2" style={{ height: 52 }}>
                    <Link
                      href={`/analysis/${r.ticker}`}
                      onClick={() => handleRowClick(r.ticker)}
                      className="block"
                    >
                      <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                        {r.ticker}
                      </span>
                      <p className="font-sans text-[11px] text-[var(--text-muted)]">
                        {r.companyName}
                      </p>
                    </Link>
                  </td>
                  <td className="w-[100px] px-3 py-2">
                    <span className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
                      {formatCurrency(r.price)}
                    </span>
                    <p
                      className={cn(
                        "font-mono text-xs tabular-nums",
                        r.priceChangePercent >= 0 ? "text-[var(--signal-long)]" : "text-[var(--signal-short)]"
                      )}
                    >
                      {r.priceChangePercent >= 0 ? "↑" : "↓"} {formatPercent(r.priceChangePercent, true)}
                    </p>
                  </td>
                  <td className="w-[160px] px-3 py-2">
                    <SetupBadge setup={r.primarySetup} />
                  </td>
                  <td className="w-[64px] px-3 py-2">
                    <GradeBadge grade={r.primarySetup.grade} />
                  </td>
                  {showOptionsCols && (() => {
                    const rec = optionsRecommendations[r.ticker];
                    const ivpColor =
                      !rec ? "text-[var(--text-muted)]" :
                      rec.ivAnalysis.ivPercentile < 30 ? "text-[var(--signal-long)]" :
                      rec.ivAnalysis.ivPercentile > 60 ? "text-[var(--regime-choppy)]" :
                      rec.ivAnalysis.ivPercentile > 80 ? "text-[var(--signal-short)]" :
                      "text-[var(--text-secondary)]";
                    return (
                      <>
                        <td className="w-[72px] px-3 py-2">
                          {rec ? (
                            <span className={cn("font-mono text-xs tabular-nums", ivpColor)}>
                              {rec.ivAnalysis.ivPercentile.toFixed(0)}
                              {rec.ivAnalysis.historicalDaysAvailable < 252 ? "d" : ""}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td className="w-[120px] px-3 py-2 font-mono text-xs tabular-nums">
                          {rec && rec.structure !== "none"
                            ? `${r.ticker} ${rec.longStrike}${rec.contractType === "call" ? "C" : "P"} ${rec.expiration.slice(5, 7)}/${rec.expiration.slice(8, 10)}`
                            : "—"}
                        </td>
                        <td className="w-[80px] px-3 py-2 font-mono text-xs tabular-nums">
                          {rec && rec.structure !== "none"
                            ? formatCurrency(rec.maxRisk)
                            : "—"}
                        </td>
                        <td className="w-[56px] px-3 py-2 font-mono text-xs tabular-nums">
                          {rec && rec.structure !== "none"
                            ? `${(rec.greeks.probabilityOfProfit * 100).toFixed(0)}%`
                            : "—"}
                        </td>
                        <td className="w-[64px] px-3 py-2">
                          {rec && rec.structure !== "none" ? (
                            <span className="flex items-center gap-1">
                              <span className="rounded bg-[var(--background-subtle)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                                {STRUCTURE_LABELS[rec.structure] ?? rec.structure}
                              </span>
                              {rec.unusualActivity && (
                                <span
                                  title={rec.unusualActivityDetail}
                                  className="rounded bg-[var(--regime-choppy)]/30 px-1.5 py-0.5 font-mono text-[10px] text-[var(--regime-choppy)]"
                                >
                                  UOA
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                      </>
                    );
                  })()}
                  <td className="w-[130px] px-3 py-2 font-mono text-xs tabular-nums">
                    {formatCurrency(r.primarySetup.tradeParams.entry.zone[0])} – {formatCurrency(r.primarySetup.tradeParams.entry.zone[1])}
                  </td>
                  <td className="w-[110px] px-3 py-2 font-mono text-xs tabular-nums text-[var(--signal-short)]">
                    {formatCurrency(r.primarySetup.tradeParams.stop.price)} ({formatPercent(r.primarySetup.tradeParams.stop.riskPercent)})
                  </td>
                  <td className="w-[140px] px-3 py-2 font-mono text-xs tabular-nums text-[var(--signal-long)]">
                    {formatCurrency(r.primarySetup.tradeParams.targets.t1.price)} / {formatCurrency(r.primarySetup.tradeParams.targets.t2.price)}
                  </td>
                  <td className={`w-[72px] px-3 py-2 font-mono text-xs tabular-nums ${getRRColor(r.primarySetup.tradeParams.riskReward.toT1)}`}>
                    {r.primarySetup.tradeParams.riskReward.toT1.toFixed(1)}:1
                  </td>
                  <td className="w-[96px] px-3 py-2">
                    <span className="rounded-full bg-[var(--background-subtle)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                      {r.primarySetup.tradeParams.holdDuration}
                    </span>
                  </td>
                  <td className={`w-[100px] px-3 py-2 font-mono text-xs tabular-nums ${getVolColor(r.volumeVsAvg)}`}>
                    {r.volumeVsAvg.toFixed(1)}x AVG
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.keyConfirmingFactors.slice(0, 3).map((f, j) => (
                        <span
                          key={j}
                          className="rounded bg-[var(--background-subtle)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-muted)]"
                          title={r.keyConfirmingFactors.join(", ")}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
