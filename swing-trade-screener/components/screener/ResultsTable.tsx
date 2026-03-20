"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { SetupBadge } from "./SetupBadge";
import { GradeBadge } from "./GradeBadge";
import { RSBadge } from "./RSBadge";
import { Tooltip } from "@/components/ui/Tooltip";
import { isPreMarketOrFirstHour } from "@/lib/utils/marketHours";
import { useFeature } from "@/lib/hooks/useFeature";
import { useWatchlistStore } from "@/lib/stores/watchlistStore";
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
  regime?: string | null;
  onRelaxGrade?: () => void;
  onLowerRR?: () => void;
}

type SortKey = "ticker" | "price" | "grade" | "rs" | "rr" | "entry" | "stop" | "hold";

export function ResultsTable({
  results,
  onExportCSV,
  scanProgress,
  isLoading,
  optionsMode = "Stocks",
  optionsRecommendations = {},
  regime,
  onRelaxGrade,
  onLowerRR,
}: ResultsTableProps) {
  const optionsLayer = useFeature("OPTIONS_LAYER");
  const preMarketFeature = useFeature("PREMARKET_CONTEXT");
  const newsFeature = useFeature("NEWS_SENTIMENT");
  const preMarketHours = isPreMarketOrFirstHour();
  const showOptionsCols =
    optionsLayer &&
    (optionsMode === "Options" || optionsMode === "Both");
  const [sortKey, setSortKey] = useState<SortKey>("grade");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [clickedTicker, setClickedTicker] = useState<string | null>(null);
  const [columnVisibility, setColumnVisibility] = useState({
    rs: true,
    sector: true,
    news: true,
    preMkt: true,
  });
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const watchlistAdd = useWatchlistStore((s) => s.addEntry);
  const isWatching = useWatchlistStore((s) => s.isWatching);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setColumnMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showPreMktCol = preMarketFeature && preMarketHours && columnVisibility.preMkt;

  const sorted = useMemo(() => {
    const valid = results.filter(
      (r) => r?.primarySetup?.tradeParams != null
    );
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
      } else if (sortKey === "rs") {
        va = a.rsAnalysis?.rating ?? 0;
        vb = b.rsAnalysis?.rating ?? 0;
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
          <div className="relative" ref={columnMenuRef}>
            <button
              onClick={() => setColumnMenuOpen((o) => !o)}
              className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--background-subtle)] hover:text-[var(--text-secondary)]"
              title="Column visibility"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {columnMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded border border-[var(--border-default)] bg-[var(--background-elevated)] p-2 shadow-lg">
                <p className="mb-2 font-mono text-[10px] font-medium text-[var(--text-muted)]">
                  Show columns
                </p>
                <label className="flex cursor-pointer items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={columnVisibility.rs}
                    onChange={(e) => setColumnVisibility((v) => ({ ...v, rs: e.target.checked }))}
                    className="rounded border-[var(--border-default)]"
                  />
                  <span className="font-mono text-xs">RS</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={columnVisibility.sector}
                    onChange={(e) => setColumnVisibility((v) => ({ ...v, sector: e.target.checked }))}
                    className="rounded border-[var(--border-default)]"
                  />
                  <span className="font-mono text-xs">Sector</span>
                </label>
                {newsFeature && (
                  <label className="flex cursor-pointer items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={columnVisibility.news}
                      onChange={(e) => setColumnVisibility((v) => ({ ...v, news: e.target.checked }))}
                      className="rounded border-[var(--border-default)]"
                    />
                    <span className="font-mono text-xs">News</span>
                  </label>
                )}
                <label className="flex cursor-pointer items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={columnVisibility.preMkt}
                    onChange={(e) => setColumnVisibility((v) => ({ ...v, preMkt: e.target.checked }))}
                    className="rounded border-[var(--border-default)]"
                  />
                  <span className="font-mono text-xs">Pre-mkt</span>
                </label>
              </div>
            )}
          </div>
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
              {columnVisibility.rs && <Th sortKey="rs" width="64px">RS</Th>}
              {columnVisibility.sector && <Th width="80px">Sector</Th>}
              {showPreMktCol && <Th width="64px">Pre-mkt</Th>}
              {newsFeature && columnVisibility.news && <Th width="48px">News</Th>}
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
                <td colSpan={14 + (showOptionsCols ? 5 : 0)} className="py-16 text-center">
                  {(() => {
                    const isBear = regime === "Bear Market" || regime === "Distribution";
                    const isChoppy = regime === "Choppy/Sideways";
                    const isBull = regime === "Bull Market" || regime === "Accumulation";
                    return (
                      <div className="mx-auto max-w-sm space-y-3">
                        <p className="font-mono text-sm text-[var(--text-muted)]">
                          {isBear
                            ? "Bear market active — only high-conviction SHORT setups surface"
                            : isChoppy
                            ? "Choppy conditions — setups are scarce by design"
                            : isBull
                            ? "No setups found — try relaxing grade or R:R filters"
                            : "No setups match your filters"}
                        </p>
                        {isBear && (
                          <p className="font-mono text-xs text-[var(--text-muted)] opacity-70">
                            Switch bias to SHORT, or lower the grade filter to see bear market setups
                          </p>
                        )}
                        {isChoppy && (
                          <p className="font-mono text-xs text-[var(--text-muted)] opacity-70">
                            Choppy tape reduces valid setups — lower R:R minimum or grade filter
                          </p>
                        )}
                        <div className="flex justify-center gap-2 pt-2">
                          <button
                            onClick={onRelaxGrade}
                            className="rounded border border-[var(--border-default)] px-3 py-1 font-mono text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--background-subtle)] hover:text-[var(--text-primary)]"
                          >
                            Relax grade filter
                          </button>
                          <button
                            onClick={onLowerRR}
                            className="rounded border border-[var(--border-default)] px-3 py-1 font-mono text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--background-subtle)] hover:text-[var(--text-primary)]"
                          >
                            Lower min R:R
                          </button>
                          {isBear && (
                            <span className="rounded border border-[var(--signal-short)]/30 bg-[var(--signal-short-muted)] px-3 py-1 font-mono text-xs text-[var(--signal-short)]">
                              Bear Market Mode
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
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
                  <td className="w-[120px] px-3 py-2" style={{ height: 52 }}>
                    <div className="flex items-start gap-1">
                      <Link
                        href={`/analysis/${r.ticker}`}
                        onClick={() => handleRowClick(r.ticker)}
                        className="flex-1 min-w-0"
                      >
                        <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                          {r.ticker}
                        </span>
                        <p className="font-sans text-[11px] text-[var(--text-muted)]">
                          {r.companyName}
                        </p>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isWatching(r.ticker)) return;
                          const t = r.primarySetup?.tradeParams;
                          if (!t) return;
                          watchlistAdd({
                            ticker: r.ticker,
                            companyName: r.companyName,
                            setupName: r.primarySetup?.name ?? "—",
                            screenType: "Swing",
                            entryZoneLow: t.entry.zone[0],
                            entryZoneHigh: t.entry.zone[1],
                            plannedStop: t.stop.price,
                            plannedT1: t.targets.t1.price,
                            alertOnEntry: true,
                          });
                        }}
                        className={cn(
                          "shrink-0 rounded p-0.5 transition-colors",
                          isWatching(r.ticker)
                            ? "text-[var(--regime-choppy)]"
                            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        )}
                        title={isWatching(r.ticker) ? "In watchlist" : "Add to watchlist"}
                      >
                        {isWatching(r.ticker) ? (
                          <svg className="h-4 w-4 text-[var(--regime-choppy)]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="w-[100px] px-3 py-2">
                    <span className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
                      {formatCurrency(r.price ?? 0)}
                    </span>
                    <p
                      className={cn(
                        "font-mono text-xs tabular-nums",
                        (r.priceChangePercent ?? 0) >= 0 ? "text-[var(--signal-long)]" : "text-[var(--signal-short)]"
                      )}
                    >
                      {(r.priceChangePercent ?? 0) >= 0 ? "↑" : "↓"} {formatPercent(r.priceChangePercent ?? 0, true)}
                    </p>
                  </td>
                  <td className="w-[160px] px-3 py-2">
                    <SetupBadge setup={r.primarySetup!} />
                  </td>
                  <td className="w-[64px] px-3 py-2">
                    <GradeBadge grade={r.primarySetup?.grade ?? "C"} />
                  </td>
                  {columnVisibility.rs && (
                    <td className="w-[64px] px-3 py-2">
                      {r.rsAnalysis ? (
                        <RSBadge rs={r.rsAnalysis} />
                      ) : (
                        <span className="font-mono text-xs text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                  )}
                  {columnVisibility.sector && (
                    <td className="w-[80px] px-3 py-2 font-mono text-xs">
                      {r.sectorRS ? (
                        <span
                          className={cn(
                            r.sectorRS.isLeadingSector && "text-[var(--signal-long)]",
                            r.sectorRS.isWeakSector && "text-[var(--signal-short)]"
                          )}
                          title={`${r.sectorRS.sector} — Rank #${r.sectorRS.sectorRank} of 11`}
                        >
                          {r.sectorRS.sectorETF} #{r.sectorRS.sectorRank}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                  )}
                  {showPreMktCol && (
                    <td className="w-[64px] px-3 py-2">
                      {r.preMarketContext &&
                      Math.abs(r.preMarketContext.preMarketChange ?? 0) > 1 ? (
                        <span
                          className={cn(
                            "font-mono text-xs tabular-nums",
                            (r.preMarketContext.preMarketChange ?? 0) >= 0
                              ? "text-[var(--signal-long)]"
                              : "text-[var(--signal-short)]"
                          )}
                          title="Pre-market % change"
                        >
                          {(r.preMarketContext.preMarketChange ?? 0) >= 0 ? "+" : ""}
                          {(r.preMarketContext.preMarketChange ?? 0).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                  )}
                  {newsFeature && columnVisibility.news && (
                    <td className="w-[48px] px-3 py-2">
                      {r.newsSentiment ? (
                      <span
                        className={cn(
                          "inline-block h-2 w-2 rounded-full",
                          r.newsSentiment.sentiment === "positive" &&
                            "bg-[var(--signal-long)]",
                          r.newsSentiment.sentiment === "negative" &&
                            "bg-[var(--signal-short)]",
                          r.newsSentiment.sentiment === "neutral" &&
                            "bg-[var(--text-muted)]"
                        )}
                        title={`${r.newsSentiment.headlineCount} headlines — ${r.newsSentiment.sentiment}`}
                      />
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                    </td>
                  )}
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
                    {formatCurrency(r.primarySetup?.tradeParams?.entry?.zone?.[0] ?? 0)} – {formatCurrency(r.primarySetup?.tradeParams?.entry?.zone?.[1] ?? 0)}
                  </td>
                  <td className="w-[110px] px-3 py-2 font-mono text-xs tabular-nums text-[var(--signal-short)]">
                    {formatCurrency(r.primarySetup?.tradeParams?.stop?.price ?? 0)} ({formatPercent(r.primarySetup?.tradeParams?.stop?.riskPercent ?? 0)})
                  </td>
                  <td className="w-[140px] px-3 py-2 font-mono text-xs tabular-nums text-[var(--signal-long)]">
                    {formatCurrency(r.primarySetup?.tradeParams?.targets?.t1?.price ?? 0)} / {formatCurrency(r.primarySetup?.tradeParams?.targets?.t2?.price ?? 0)}
                  </td>
                    <td className={`w-[72px] px-3 py-2 font-mono text-xs tabular-nums ${getRRColor(r.primarySetup?.tradeParams?.riskReward?.toT1 ?? 0)}`}>
                    {(r.primarySetup?.tradeParams?.riskReward?.toT1 ?? 0).toFixed(1)}:1
                  </td>
                  <td className="w-[96px] px-3 py-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-mono text-[11px]",
                        r.primarySetup?.tradeParams?.holdDuration === "Scalp" &&
                          "bg-purple-900/40 text-purple-300 border border-purple-700/40",
                        r.primarySetup?.tradeParams?.holdDuration === "Short Swing" &&
                          "bg-blue-900/40 text-blue-300 border border-blue-700/40",
                        r.primarySetup?.tradeParams?.holdDuration === "Swing" &&
                          "bg-teal-900/40 text-teal-300 border border-teal-700/40",
                        r.primarySetup?.tradeParams?.holdDuration === "Extended Swing" &&
                          "bg-amber-900/40 text-amber-300 border border-amber-700/40",
                        !["Scalp", "Short Swing", "Swing", "Extended Swing"].includes(
                          r.primarySetup?.tradeParams?.holdDuration ?? ""
                        ) && "bg-[var(--background-subtle)] text-[var(--text-secondary)]"
                      )}
                    >
                      {r.primarySetup?.tradeParams?.holdDuration ?? "—"}
                    </span>
                  </td>
                  <td className={`w-[100px] px-3 py-2 font-mono text-xs tabular-nums ${getVolColor(r.volumeVsAvg)}`}>
                    {r.volumeVsAvg.toFixed(1)}x AVG
                  </td>
                  <td className="px-3 py-2">
                    {(r.keyConfirmingFactors ?? []).length > 0 && (
                      <Tooltip width={256} content={
                        <>
                          <p className="mb-1 font-mono text-[10px] font-semibold text-[var(--text-muted)] uppercase">Confirming</p>
                          <ul className="space-y-0.5">
                            {(r.keyConfirmingFactors ?? []).map((f, j) => (
                              <li key={j} className="font-mono text-[11px] text-[var(--signal-long)]">✓ {f}</li>
                            ))}
                          </ul>
                          {(r.primarySetup?.riskFactors ?? []).length > 0 && (
                            <>
                              <p className="mb-1 mt-2 font-mono text-[10px] font-semibold text-[var(--text-muted)] uppercase">Risk</p>
                              <ul className="space-y-0.5">
                                {(r.primarySetup?.riskFactors ?? []).map((f, j) => (
                                  <li key={j} className="font-mono text-[11px] text-[var(--signal-short)]">⚠ {f}</li>
                                ))}
                              </ul>
                            </>
                          )}
                        </>
                      }>
                        <div className="flex cursor-default items-center gap-1">
                          <span className="font-mono text-[10px] text-[var(--signal-long)]">
                            ✓ {(r.keyConfirmingFactors ?? [])[0].length > 22
                              ? (r.keyConfirmingFactors ?? [])[0].slice(0, 22) + "…"
                              : (r.keyConfirmingFactors ?? [])[0]}
                          </span>
                          {(r.keyConfirmingFactors ?? []).length > 1 && (
                            <span className="rounded bg-[var(--background-subtle)] px-1 font-mono text-[10px] text-[var(--text-muted)]">
                              +{(r.keyConfirmingFactors ?? []).length - 1}
                            </span>
                          )}
                        </div>
                      </Tooltip>
                    )}
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
