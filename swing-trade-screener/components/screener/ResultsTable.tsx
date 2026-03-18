"use client";

import { useMemo, useState } from "react";
import { SetupBadge } from "./SetupBadge";
import { GradeBadge } from "./GradeBadge";
import { RSBadge } from "./RSBadge";
import { EarningsBadge } from "./EarningsBadge";
import { ATRBadge } from "./ATRBadge";
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
  accountSize?: number;
  riskPerTrade?: number;
  results: ScreenerResult[];
  onExportCSV?: () => void;
  scanProgress?: { current: number; total: number };
  isLoading?: boolean;
  optionsMode?: "Stocks" | "Options" | "Both";
  optionsRecommendations?: Record<string, ContractRecommendation | null>;
}

type SortKey = "ticker" | "price" | "grade" | "rr" | "entry" | "stop" | "hold" | "rs";

export function ResultsTable({
  results,
  onExportCSV,
  scanProgress,
  isLoading,
  optionsMode = "Stocks",
  optionsRecommendations = {},
  accountSize = 25000,
  riskPerTrade = 0.01,
}: ResultsTableProps) {
  const optionsLayer = useFeature("OPTIONS_LAYER");
  const showOptionsCols = optionsLayer && (optionsMode === "Options" || optionsMode === "Both");
  const [sortKey, setSortKey] = useState<SortKey>("grade");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [clickedTicker, setClickedTicker] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const valid = results.filter((r) => r?.primarySetup?.tradeParams != null);
    return [...valid].sort((a, b) => {
      let va: number | string | undefined;
      let vb: number | string | undefined;
      const ap = a.primarySetup;
      const bp = b.primarySetup;
      const atp = ap?.tradeParams;
      const btp = bp?.tradeParams;

      if (sortKey === "grade") {
        const order: Record<string, number> = { "A+": 4, A: 3, B: 2, C: 1 };
        va = order[ap?.grade ?? ""] ?? 0;
        vb = order[bp?.grade ?? ""] ?? 0;
      } else if (sortKey === "rr") {
        va = atp?.riskReward?.toT1 ?? 0;
        vb = btp?.riskReward?.toT1 ?? 0;
      } else if (sortKey === "price") {
        va = a.price ?? 0;
        vb = b.price ?? 0;
      } else if (sortKey === "ticker") {
        va = a.ticker ?? "";
        vb = b.ticker ?? "";
      } else if (sortKey === "entry") {
        va = atp?.entry?.zone?.[0] ?? 0;
        vb = btp?.entry?.zone?.[0] ?? 0;
      } else if (sortKey === "stop") {
        va = atp?.stop?.price ?? 0;
        vb = btp?.stop?.price ?? 0;
      } else if (sortKey === "rs") {
        va = a.rsAnalysis?.rating ?? 0;
        vb = b.rsAnalysis?.rating ?? 0;
      } else {
        va = atp?.holdDuration ?? "";
        vb = btp?.holdDuration ?? "";
      }

      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const cmp = String(va ?? "").localeCompare(String(vb ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [results, sortKey, sortDir]);

  const sort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const Th = ({
    children,
    sortKey: k,
    width,
    title,
  }: {
    children: React.ReactNode;
    sortKey?: SortKey;
    width: string;
    title?: string;
  }) => (
    <th
      title={title}
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
      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-2">
        {scanProgress && isLoading && (
          <div className="flex-1">
            <div className="h-0.5 w-48 overflow-hidden rounded-full bg-[var(--background-subtle)]">
              <div
                className="h-full bg-[var(--signal-neutral)] transition-all duration-300"
                style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
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

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div id="results-scroll" className="max-h-[calc(100vh-280px)] overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <Th sortKey="ticker" width="120px">Ticker</Th>
              <Th sortKey="price" width="100px">Price</Th>
              <Th sortKey="grade" width="160px">Setup</Th>
              <Th sortKey="grade" width="56px">Grd</Th>
              {/* New columns */}
              <Th sortKey="rs" width="96px" title="Relative Strength vs. SPY (0–100). Leaders > 80. Avoid longs < 40.">RS</Th>
              <Th width="96px" title="Days until next earnings. High risk = within 14 days.">Earnings</Th>
              <Th width="96px" title="Average True Range as % of price. Stop distance in ATR multiples.">ATR / Stop</Th>
              {/* Options columns */}
              {showOptionsCols && <Th width="72px">IVP</Th>}
              {showOptionsCols && <Th width="120px">Contract</Th>}
              {showOptionsCols && <Th width="80px">Max Risk</Th>}
              {showOptionsCols && <Th width="56px">PoP</Th>}
              {showOptionsCols && <Th width="64px">Structure</Th>}
              {/* Trade params */}
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
                <td colSpan={14 + (showOptionsCols ? 5 : 0)} className="py-16 text-center">
                  <p className="font-mono text-sm text-[var(--text-muted)]">
                    No setups match your filters
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <button className="rounded border border-[var(--border-default)] px-3 py-1 font-mono text-xs text-[var(--text-secondary)] hover:bg-[var(--background-subtle)]">
                      Relax grade filter
                    </button>
                    <button className="rounded border border-[var(--border-default)] px-3 py-1 font-mono text-xs text-[var(--text-secondary)] hover:bg-[var(--background-subtle)]">
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
                    r.primarySetup?.bias === "LONG" && "border-l-[3px] border-l-[var(--signal-long-muted)]",
                    r.primarySetup?.bias === "SHORT" && "border-l-[3px] border-l-[var(--signal-short-muted)]",
                    "hover:bg-[var(--background-subtle)]",
                    clickedTicker === r.ticker && r.primarySetup?.bias === "LONG" && "bg-[var(--signal-long-muted)]",
                    clickedTicker === r.ticker && r.primarySetup?.bias === "SHORT" && "bg-[var(--signal-short-muted)]"
                  )}
                  style={{ animationDelay: `${Math.min(i * 20, 400)}ms` }}
                >
                  {/* Ticker */}
                  <td className="w-[120px] px-3 py-2" style={{ height: 52 }}>
                    <Link
                      href={`/analysis/${r.ticker}?accountSize=${accountSize}&riskPerTrade=${riskPerTrade}`}
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

                  {/* Price */}
                  <td className="w-[100px] px-3 py-2">
                    <span className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
                      {formatCurrency(r.price ?? 0)}
                    </span>
                    <p className={cn(
                      "font-mono text-xs tabular-nums",
                      (r.priceChangePercent ?? 0) >= 0 ? "text-[var(--signal-long)]" : "text-[var(--signal-short)]"
                    )}>
                      {(r.priceChangePercent ?? 0) >= 0 ? "↑" : "↓"} {formatPercent(r.priceChangePercent ?? 0, true)}
                    </p>
                  </td>

                  {/* Setup */}
                  <td className="w-[160px] px-3 py-2">
                    <SetupBadge setup={r.primarySetup!} />
                  </td>

                  {/* Grade */}
                  <td className="w-[56px] px-3 py-2">
                    <GradeBadge grade={r.primarySetup?.grade ?? "C"} />
                  </td>

                  {/* RS — new */}
                  <td className="w-[96px] px-3 py-2">
                    {r.rsAnalysis ? (
                      <RSBadge rs={r.rsAnalysis} />
                    ) : (
                      <span className="font-mono text-xs text-[var(--text-muted)]">—</span>
                    )}
                  </td>

                  {/* Earnings — new */}
                  <td className="w-[96px] px-3 py-2">
                    {r.earningsData ? (
                      <div className="flex flex-col gap-0.5">
                        <EarningsBadge earnings={r.earningsData} />
                        {r.earningsData.riskLevel === "UNKNOWN" && (
                          <span className="font-mono text-[10px] text-[var(--text-muted)]">—</span>
                        )}
                      </div>
                    ) : (
                      <span className="font-mono text-xs text-[var(--text-muted)]">—</span>
                    )}
                  </td>

                  {/* ATR / Stop context — new */}
                  <td className="w-[96px] px-3 py-2">
                    {r.atrData ? (
                      <ATRBadge
                        atr={r.atrData}
                        stopAtrMultiple={r.primarySetup?.tradeParams?.stop?.atrMultiple}
                      />
                    ) : (
                      <span className="font-mono text-xs text-[var(--text-muted)]">—</span>
                    )}
                  </td>

                  {/* Options columns */}
                  {showOptionsCols && (() => {
                    const rec = optionsRecommendations[r.ticker];
                    const ivpColor =
                      !rec ? "text-[var(--text-muted)]"
                      : rec.ivAnalysis.ivPercentile < 30 ? "text-[var(--signal-long)]"
                      : rec.ivAnalysis.ivPercentile > 60 ? "text-[var(--regime-choppy)]"
                      : rec.ivAnalysis.ivPercentile > 80 ? "text-[var(--signal-short)]"
                      : "text-[var(--text-secondary)]";
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
                          {rec && rec.structure !== "none" ? formatCurrency(rec.maxRisk) : "—"}
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
                                <span title={rec.unusualActivityDetail} className="rounded bg-[var(--regime-choppy)]/30 px-1.5 py-0.5 font-mono text-[10px] text-[var(--regime-choppy)]">
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

                  {/* Entry zone */}
                  <td className="w-[130px] px-3 py-2 font-mono text-xs tabular-nums">
                    {formatCurrency(r.primarySetup?.tradeParams?.entry?.zone?.[0] ?? 0)} –{" "}
                    {formatCurrency(r.primarySetup?.tradeParams?.entry?.zone?.[1] ?? 0)}
                  </td>

                  {/* Stop loss */}
                  <td className="w-[110px] px-3 py-2">
                    <span className="font-mono text-xs tabular-nums text-[var(--signal-short)]">
                      {formatCurrency(r.primarySetup?.tradeParams?.stop?.price ?? 0)}
                    </span>
                    <p className="font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
                      {formatPercent(r.primarySetup?.tradeParams?.stop?.riskPercent ?? 0)} risk
                    </p>
                  </td>

                  {/* T1 / T2 */}
                  <td className="w-[140px] px-3 py-2 font-mono text-xs tabular-nums text-[var(--signal-long)]">
                    {formatCurrency(r.primarySetup?.tradeParams?.targets?.t1?.price ?? 0)} /{" "}
                    {formatCurrency(r.primarySetup?.tradeParams?.targets?.t2?.price ?? 0)}
                  </td>

                  {/* R:R */}
                  <td className={cn(
                    "w-[72px] px-3 py-2 font-mono text-xs tabular-nums",
                    getRRColor(r.primarySetup?.tradeParams?.riskReward?.toT1 ?? 0)
                  )}>
                    {(r.primarySetup?.tradeParams?.riskReward?.toT1 ?? 0).toFixed(1)}:1
                  </td>

                  {/* Hold duration */}
                  <td className="w-[96px] px-3 py-2">
                    <span className="rounded-full bg-[var(--background-subtle)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                      {r.primarySetup?.tradeParams?.holdDuration ?? "—"}
                    </span>
                  </td>

                  {/* Volume */}
                  <td className={cn(
                    "w-[100px] px-3 py-2 font-mono text-xs tabular-nums",
                    getVolColor(r.volumeVsAvg)
                  )}>
                    {r.volumeVsAvg.toFixed(1)}x AVG
                    {/* Volume context badges */}
                    {/* These come from the enhanced volumeAnalysis */}
                  </td>

                  {/* Signals */}
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(r.keyConfirmingFactors ?? []).slice(0, 3).map((f, j) => (
                        <span
                          key={j}
                          className="rounded bg-[var(--background-subtle)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-muted)]"
                          title={(r.keyConfirmingFactors ?? []).join(", ")}
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
