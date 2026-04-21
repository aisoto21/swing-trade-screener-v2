"use client";

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/formatter";
import type { AlpacaTrade } from "@/types/alpaca";
import type { AlpacaPosition } from "@/types/alpaca";

// =============================================================================
// HELPERS
// =============================================================================

function holdDuration(submittedAt: string, closedAt: string | null): string {
  const end = closedAt ? new Date(closedAt) : new Date();
  const ms = end.getTime() - new Date(submittedAt).getTime();
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

function pnlPercent(entry: number, exit: number, direction: "long" | "short"): number {
  return direction === "long"
    ? ((exit - entry) / entry) * 100
    : ((entry - exit) / entry) * 100;
}

function pnlDollars(
  entry: number,
  exit: number,
  shares: number,
  direction: "long" | "short"
): number {
  return direction === "long"
    ? (exit - entry) * shares
    : (entry - exit) * shares;
}

// =============================================================================
// AGGREGATE STATS
// =============================================================================

interface Stats {
  totalTrades: number;
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  expectancy: number;
  totalPnlDollars: number;
}

function computeStats(closed: AlpacaTrade[]): Stats {
  const total = closed.length;
  if (total === 0) {
    return { totalTrades: 0, winRate: 0, avgWinPct: 0, avgLossPct: 0, expectancy: 0, totalPnlDollars: 0 };
  }

  const wins = closed.filter((t) => t.outcome === "win");
  const losses = closed.filter((t) => t.outcome === "loss");

  const winPcts = wins
    .filter((t) => t.exitPrice != null)
    .map((t) => pnlPercent(t.entryPrice, t.exitPrice!, t.direction));

  const lossPcts = losses
    .filter((t) => t.exitPrice != null)
    .map((t) => pnlPercent(t.entryPrice, t.exitPrice!, t.direction));

  const avgWinPct =
    winPcts.length > 0 ? winPcts.reduce((a, b) => a + b, 0) / winPcts.length : 0;
  const avgLossPct =
    lossPcts.length > 0 ? lossPcts.reduce((a, b) => a + b, 0) / lossPcts.length : 0;

  const winRate = wins.length / total;
  const lossRate = 1 - winRate;
  const expectancy = winRate * avgWinPct + lossRate * avgLossPct;

  const totalPnlDollars = closed
    .filter((t) => t.exitPrice != null)
    .reduce(
      (sum, t) => sum + pnlDollars(t.entryPrice, t.exitPrice!, t.totalShares, t.direction),
      0
    );

  return {
    totalTrades: total,
    winRate,
    avgWinPct,
    avgLossPct,
    expectancy,
    totalPnlDollars,
  };
}

// Group closed trades and compute per-group stats
function groupStats(
  closed: AlpacaTrade[],
  key: "grade" | "setupType"
): Array<{ label: string } & Stats> {
  const groups: Record<string, AlpacaTrade[]> = {};
  for (const t of closed) {
    const k = t[key];
    if (!groups[k]) groups[k] = [];
    groups[k].push(t);
  }
  return Object.entries(groups)
    .map(([label, trades]) => ({ label, ...computeStats(trades) }))
    .sort((a, b) => b.totalTrades - a.totalTrades);
}

// =============================================================================
// SORT TYPES
// =============================================================================

type ClosedSortKey = "ticker" | "grade" | "setupType" | "pnlDollars" | "pnlPct" | "closedAt" | "outcome";

// =============================================================================
// STAT CARD
// =============================================================================

function StatCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
      <p className="font-mono text-xs text-[var(--text-muted)]">{label}</p>
      <p className={cn("font-mono text-lg font-bold tabular-nums text-[var(--text-primary)]", valueClass)}>
        {value}
      </p>
      {sub && (
        <p className="font-mono text-xs text-[var(--text-secondary)]">{sub}</p>
      )}
    </div>
  );
}

// =============================================================================
// BREAKDOWN TABLE
// =============================================================================

function BreakdownTable({
  rows,
  title,
}: {
  rows: Array<{ label: string } & Stats>;
  title: string;
}) {
  return (
    <div>
      <h3 className="mb-2 font-mono text-xs font-semibold text-[var(--text-secondary)]">
        {title}
      </h3>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-[var(--border-default)] px-4 py-3">
          <p className="font-sans text-sm text-[var(--text-muted)]">
            No closed trades yet — data will populate here automatically.
          </p>
        </div>
      ) : null}
      {rows.length > 0 && <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-default)] bg-[var(--background-surface)]">
              {["Label", "Trades", "Win Rate", "Avg Win", "Avg Loss", "Expectancy", "P&L"].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.label}
                className="border-b border-[var(--border-default)] last:border-0"
              >
                <td className="px-3 py-2 font-mono text-xs font-medium text-[var(--text-primary)]">
                  {r.label}
                </td>
                <td className="px-3 py-2 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                  {r.totalTrades}
                </td>
                <td className="px-3 py-2 font-mono text-xs tabular-nums">
                  <span
                    className={
                      r.winRate >= 0.5 ? "text-[#00D084]" : "text-[#FF4D6A]"
                    }
                  >
                    {(r.winRate * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs tabular-nums text-[#00D084]">
                  {r.avgWinPct > 0 ? `+${r.avgWinPct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs tabular-nums text-[#FF4D6A]">
                  {r.avgLossPct < 0 ? `${r.avgLossPct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs tabular-nums">
                  <span
                    className={
                      r.expectancy >= 0 ? "text-[#00D084]" : "text-[#FF4D6A]"
                    }
                  >
                    {r.expectancy >= 0 ? "+" : ""}
                    {r.expectancy.toFixed(2)}%
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs tabular-nums">
                  <span
                    className={
                      r.totalPnlDollars >= 0 ? "text-[#00D084]" : "text-[#FF4D6A]"
                    }
                  >
                    {r.totalPnlDollars >= 0 ? "+" : ""}
                    {formatCurrency(r.totalPnlDollars)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AutoTestingClient() {
  const [trades, setTrades] = useState<AlpacaTrade[]>([]);
  const [positions, setPositions] = useState<AlpacaPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Closed trades sort
  const [sortKey, setSortKey] = useState<ClosedSortKey>("closedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Fetch trades + positions on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [tradesRes, positionsRes] = await Promise.all([
          fetch("/api/alpaca/trades").then((r) => r.json()),
          fetch("/api/alpaca/positions").then((r) => r.json()),
        ]);
        if (cancelled) return;
        setTrades(tradesRes.trades ?? []);
        setPositions(positionsRes.positions ?? []);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  // Split open vs closed
  const openTrades = useMemo(
    () => trades.filter((t) => t.phase !== "closed"),
    [trades]
  );
  const closedTrades = useMemo(
    () => trades.filter((t) => t.phase === "closed"),
    [trades]
  );

  // Live prices keyed by symbol
  const livePriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of positions) {
      map[p.symbol] = parseFloat(p.current_price);
    }
    return map;
  }, [positions]);

  // Aggregate stats
  const stats = useMemo(() => computeStats(closedTrades), [closedTrades]);
  const gradeRows = useMemo(() => groupStats(closedTrades, "grade"), [closedTrades]);
  const setupRows = useMemo(() => groupStats(closedTrades, "setupType"), [closedTrades]);

  // Sorted closed trades
  const sortedClosed = useMemo(() => {
    const copy = [...closedTrades];
    copy.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;

      switch (sortKey) {
        case "ticker":
          av = a.ticker; bv = b.ticker; break;
        case "grade":
          av = a.grade; bv = b.grade; break;
        case "setupType":
          av = a.setupType; bv = b.setupType; break;
        case "closedAt":
          av = a.closedAt ?? ""; bv = b.closedAt ?? ""; break;
        case "outcome":
          av = a.outcome ?? ""; bv = b.outcome ?? ""; break;
        case "pnlDollars":
          av = a.exitPrice != null
            ? pnlDollars(a.entryPrice, a.exitPrice, a.totalShares, a.direction)
            : -Infinity;
          bv = b.exitPrice != null
            ? pnlDollars(b.entryPrice, b.exitPrice, b.totalShares, b.direction)
            : -Infinity;
          break;
        case "pnlPct":
          av = a.exitPrice != null
            ? pnlPercent(a.entryPrice, a.exitPrice, a.direction)
            : -Infinity;
          bv = b.exitPrice != null
            ? pnlPercent(b.entryPrice, b.exitPrice, b.direction)
            : -Infinity;
          break;
      }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [closedTrades, sortKey, sortDir]);

  function toggleSort(key: ClosedSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortIndicator(key: ClosedSortKey) {
    if (sortKey !== key) return null;
    return (
      <span className="ml-1 text-[var(--signal-neutral)]">
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  }

  const thClass =
    "px-4 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)] cursor-pointer select-none hover:text-[var(--text-primary)]";
  const thStaticClass =
    "px-4 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]";

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="min-h-screen bg-[var(--background-base)] p-4">
      <div className="mx-auto max-w-6xl space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="font-mono text-2xl font-bold text-[var(--text-primary)]">
            Swing Auto Testing
          </h1>
          <span className="font-mono text-xs text-[var(--text-muted)]">
            Paper trading · $100k account · 1% risk/trade
          </span>
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded border border-[var(--signal-short)] bg-[rgba(255,77,106,0.08)] px-4 py-2 font-mono text-xs text-[var(--signal-short)]">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-lg bg-[var(--background-surface)]"
              />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {/* ---------------------------------------------------------------- */}
            {/* AGGREGATE STATS                                                  */}
            {/* ---------------------------------------------------------------- */}
            <section>
              <h2 className="mb-3 font-mono text-sm font-semibold text-[var(--text-secondary)]">
                AGGREGATE STATS
              </h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <StatCard
                  label="Total Trades"
                  value={String(stats.totalTrades)}
                  sub={`${openTrades.length} open`}
                />
                <StatCard
                  label="Win Rate"
                  value={
                    stats.totalTrades > 0
                      ? `${(stats.winRate * 100).toFixed(0)}%`
                      : "—"
                  }
                  valueClass={
                    stats.winRate >= 0.5 ? "text-[#00D084]" : "text-[#FF4D6A]"
                  }
                />
                <StatCard
                  label="Avg Win"
                  value={
                    stats.avgWinPct > 0
                      ? `+${stats.avgWinPct.toFixed(1)}%`
                      : "—"
                  }
                  valueClass="text-[#00D084]"
                />
                <StatCard
                  label="Avg Loss"
                  value={
                    stats.avgLossPct < 0
                      ? `${stats.avgLossPct.toFixed(1)}%`
                      : "—"
                  }
                  valueClass="text-[#FF4D6A]"
                />
                <StatCard
                  label="Expectancy"
                  value={
                    stats.totalTrades > 0
                      ? `${stats.expectancy >= 0 ? "+" : ""}${stats.expectancy.toFixed(2)}%`
                      : "—"
                  }
                  sub="per trade"
                  valueClass={
                    stats.expectancy >= 0 ? "text-[#00D084]" : "text-[#FF4D6A]"
                  }
                />
                <StatCard
                  label="Total P&L"
                  value={
                    stats.totalTrades > 0
                      ? `${stats.totalPnlDollars >= 0 ? "+" : ""}${formatCurrency(stats.totalPnlDollars)}`
                      : "—"
                  }
                  valueClass={
                    stats.totalPnlDollars >= 0 ? "text-[#00D084]" : "text-[#FF4D6A]"
                  }
                />
              </div>

              {/* Breakdown tables — always rendered; empty state shown when no closed trades */}
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <BreakdownTable rows={gradeRows} title="BY GRADE" />
                <BreakdownTable rows={setupRows} title="BY SETUP TYPE" />
              </div>
            </section>

            {/* ---------------------------------------------------------------- */}
            {/* OPEN POSITIONS                                                   */}
            {/* ---------------------------------------------------------------- */}
            <section>
              <h2 className="mb-3 font-mono text-sm font-semibold text-[var(--text-secondary)]">
                OPEN POSITIONS
                <span className="ml-2 font-normal text-[var(--text-muted)]">
                  ({openTrades.length})
                </span>
              </h2>

              {openTrades.length === 0 ? (
                <p className="font-sans text-sm text-[var(--text-muted)]">
                  No open positions. Run the screener to auto-submit setups.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--border-default)] bg-[var(--background-surface)]">
                        {[
                          "Ticker", "Direction", "Setup Type", "Grade",
                          "Entry Price", "Current Price", "Unreal. P&L ($)",
                          "Unreal. P&L (%)", "Shares", "Phase",
                        ].map((h) => (
                          <th key={h} className={thStaticClass}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {openTrades.map((t) => {
                        const livePrice = livePriceMap[t.ticker];
                        const currentPrice = livePrice ?? t.entryPrice;
                        const hasPx = livePrice != null;
                        const uPnlDollars = hasPx
                          ? pnlDollars(t.entryPrice, currentPrice, t.totalShares, t.direction)
                          : null;
                        const uPnlPct = hasPx
                          ? pnlPercent(t.entryPrice, currentPrice, t.direction)
                          : null;

                        return (
                          <tr
                            key={t.tradeId}
                            className={cn(
                              "border-b border-[var(--border-default)] last:border-0",
                              t.direction === "long"
                                ? "border-l-[3px] border-l-[var(--signal-long-muted)]"
                                : "border-l-[3px] border-l-[var(--signal-short-muted)]"
                            )}
                          >
                            <td className="px-4 py-2 font-mono text-sm font-bold text-[var(--signal-neutral)]">
                              {t.ticker}
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={cn(
                                  "font-mono text-xs uppercase",
                                  t.direction === "long"
                                    ? "text-[var(--signal-long)]"
                                    : "text-[var(--signal-short)]"
                                )}
                              >
                                {t.direction}
                              </span>
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-[var(--text-secondary)]">
                              {t.setupType}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs font-medium text-[var(--signal-neutral)]">
                              {t.grade}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs tabular-nums">
                              {formatCurrency(t.entryPrice)}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs tabular-nums">
                              {hasPx ? (
                                formatCurrency(currentPrice)
                              ) : (
                                <span className="text-[var(--text-muted)]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs tabular-nums">
                              {uPnlDollars != null ? (
                                <span
                                  className={
                                    uPnlDollars >= 0 ? "text-[#00D084]" : "text-[#FF4D6A]"
                                  }
                                >
                                  {uPnlDollars >= 0 ? "+" : ""}
                                  {formatCurrency(uPnlDollars)}
                                </span>
                              ) : (
                                <span className="text-[var(--text-muted)]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs tabular-nums">
                              {uPnlPct != null ? (
                                <span
                                  className={
                                    uPnlPct >= 0 ? "text-[#00D084]" : "text-[#FF4D6A]"
                                  }
                                >
                                  {uPnlPct >= 0 ? "+" : ""}
                                  {uPnlPct.toFixed(2)}%
                                </span>
                              ) : (
                                <span className="text-[var(--text-muted)]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                              {t.totalShares}
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 font-mono text-xs",
                                  t.phase === 1
                                    ? "bg-[var(--background-elevated)] text-[var(--signal-neutral)]"
                                    : "bg-[#00D084]/10 text-[#00D084]"
                                )}
                              >
                                Phase {t.phase}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ---------------------------------------------------------------- */}
            {/* CLOSED TRADES                                                    */}
            {/* ---------------------------------------------------------------- */}
            <section>
              <h2 className="mb-3 font-mono text-sm font-semibold text-[var(--text-secondary)]">
                CLOSED TRADES
                <span className="ml-2 font-normal text-[var(--text-muted)]">
                  ({closedTrades.length})
                </span>
              </h2>

              {closedTrades.length === 0 ? (
                <p className="font-sans text-sm text-[var(--text-muted)]">
                  No closed trades yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--border-default)] bg-[var(--background-surface)]">
                        <th
                          className={thClass}
                          onClick={() => toggleSort("ticker")}
                        >
                          Ticker{sortIndicator("ticker")}
                        </th>
                        <th className={thStaticClass}>Direction</th>
                        <th
                          className={thClass}
                          onClick={() => toggleSort("setupType")}
                        >
                          Setup Type{sortIndicator("setupType")}
                        </th>
                        <th
                          className={thClass}
                          onClick={() => toggleSort("grade")}
                        >
                          Grade{sortIndicator("grade")}
                        </th>
                        <th className={thStaticClass}>Entry</th>
                        <th className={thStaticClass}>Exit</th>
                        <th
                          className={thClass}
                          onClick={() => toggleSort("pnlDollars")}
                        >
                          $ P&L{sortIndicator("pnlDollars")}
                        </th>
                        <th
                          className={thClass}
                          onClick={() => toggleSort("pnlPct")}
                        >
                          % P&L{sortIndicator("pnlPct")}
                        </th>
                        <th className={thStaticClass}>Hold</th>
                        <th
                          className={thClass}
                          onClick={() => toggleSort("outcome")}
                        >
                          Outcome{sortIndicator("outcome")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedClosed.map((t) => {
                        const hasExit = t.exitPrice != null;
                        const realizedPnlDollars = hasExit
                          ? pnlDollars(t.entryPrice, t.exitPrice!, t.totalShares, t.direction)
                          : null;
                        const realizedPnlPct = hasExit
                          ? pnlPercent(t.entryPrice, t.exitPrice!, t.direction)
                          : null;

                        return (
                          <tr
                            key={t.tradeId}
                            className={cn(
                              "border-b border-[var(--border-default)] last:border-0",
                              t.direction === "long"
                                ? "border-l-[3px] border-l-[var(--signal-long-muted)]"
                                : "border-l-[3px] border-l-[var(--signal-short-muted)]"
                            )}
                          >
                            <td className="px-4 py-2 font-mono text-sm font-bold text-[var(--signal-neutral)]">
                              {t.ticker}
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={cn(
                                  "font-mono text-xs uppercase",
                                  t.direction === "long"
                                    ? "text-[var(--signal-long)]"
                                    : "text-[var(--signal-short)]"
                                )}
                              >
                                {t.direction}
                              </span>
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-[var(--text-secondary)]">
                              {t.setupType}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs font-medium text-[var(--signal-neutral)]">
                              {t.grade}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs tabular-nums">
                              {formatCurrency(t.entryPrice)}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs tabular-nums">
                              {hasExit ? (
                                formatCurrency(t.exitPrice!)
                              ) : (
                                <span className="text-[var(--text-muted)]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs tabular-nums">
                              {realizedPnlDollars != null ? (
                                <span
                                  className={
                                    realizedPnlDollars >= 0 ? "text-[#00D084]" : "text-[#FF4D6A]"
                                  }
                                >
                                  {realizedPnlDollars >= 0 ? "+" : ""}
                                  {formatCurrency(realizedPnlDollars)}
                                </span>
                              ) : (
                                <span className="text-[var(--text-muted)]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs tabular-nums">
                              {realizedPnlPct != null ? (
                                <span
                                  className={
                                    realizedPnlPct >= 0 ? "text-[#00D084]" : "text-[#FF4D6A]"
                                  }
                                >
                                  {realizedPnlPct >= 0 ? "+" : ""}
                                  {realizedPnlPct.toFixed(2)}%
                                </span>
                              ) : (
                                <span className="text-[var(--text-muted)]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                              {holdDuration(t.submittedAt, t.closedAt)}
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 font-mono text-xs font-medium",
                                  t.outcome === "win"
                                    ? "bg-[#00D084]/10 text-[#00D084]"
                                    : t.outcome === "loss"
                                    ? "bg-[#FF4D6A]/10 text-[#FF4D6A]"
                                    : "text-[var(--text-muted)]"
                                )}
                              >
                                {t.outcome === "win"
                                  ? "Win"
                                  : t.outcome === "loss"
                                  ? "Loss"
                                  : "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
