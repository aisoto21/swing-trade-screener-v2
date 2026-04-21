"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { RefreshCw, X, Download } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/formatter";
import type { AlpacaTrade, AlpacaPosition } from "@/types/alpaca";

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

  return { totalTrades: total, winRate, avgWinPct, avgLossPct, expectancy, totalPnlDollars };
}

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
// EXIT DISTRIBUTION
// =============================================================================

interface ExitDistribution {
  total: number;
  t2: number;
  t1: number;
  trailingStop: number;
  stopLoss: number;
}

function computeExitDistribution(closed: AlpacaTrade[]): ExitDistribution {
  const withReason = closed.filter((t) => t.exitReason != null);
  const total = withReason.length;
  return {
    total,
    t2: withReason.filter((t) => t.exitReason === "t2").length,
    t1: withReason.filter((t) => t.exitReason === "t1").length,
    trailingStop: withReason.filter((t) => t.exitReason === "trailing_stop").length,
    stopLoss: withReason.filter((t) => t.exitReason === "stop_loss").length,
  };
}

function ExitBadge({ reason }: { reason: AlpacaTrade["exitReason"] }) {
  if (!reason) return <span className="text-[var(--text-muted)]">—</span>;
  const config: Record<string, { label: string; cls: string }> = {
    t2:            { label: "T2",    cls: "text-[#00D084]" },
    t1:            { label: "T1",    cls: "text-[#4dde9e]" },
    trailing_stop: { label: "Trail", cls: "text-[#F5A623]" },
    stop_loss:     { label: "Stop",  cls: "text-[#FF4D6A]" },
  };
  const c = config[reason] ?? { label: reason, cls: "text-[var(--text-primary)]" };
  return <span className={cn("font-mono text-xs font-medium", c.cls)}>{c.label}</span>;
}

// =============================================================================
// TYPES
// =============================================================================

type ClosedSortKey =
  | "ticker"
  | "grade"
  | "setupType"
  | "pnlDollars"
  | "pnlPct"
  | "closedAt"
  | "outcome"
  | "exitReason";

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
      <p
        className={cn(
          "font-mono text-lg font-bold tabular-nums text-[var(--text-primary)]",
          valueClass
        )}
      >
        {value}
      </p>
      {sub && <p className="font-mono text-xs text-[var(--text-secondary)]">{sub}</p>}
    </div>
  );
}

// =============================================================================
// BREAKDOWN TABLE — always renders with headers; empty state row in tbody
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
      <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-default)] bg-[var(--background-surface)]">
              {["Label", "Trades", "Win Rate", "Avg Win", "Avg Loss", "Expectancy", "P&L"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-3 font-sans text-sm text-[var(--text-muted)]"
                >
                  No closed trades yet — data will populate here automatically.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
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
                    <span className={r.winRate >= 0.5 ? "text-[#00D084]" : "text-[#FF4D6A]"}>
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
                      className={r.expectancy >= 0 ? "text-[#00D084]" : "text-[#FF4D6A]"}
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================================
// CLOSE TRADE MODAL
// =============================================================================

function CloseTradeModal({
  trade,
  onClose,
  onConfirm,
  submitting,
}: {
  trade: AlpacaTrade;
  onClose: () => void;
  onConfirm: (exitPrice: number) => void;
  submitting: boolean;
}) {
  const [price, setPrice] = useState("");
  const parsed = parseFloat(price);
  const valid = !isNaN(parsed) && parsed > 0;

  const estPnlDollars = valid
    ? pnlDollars(trade.entryPrice, parsed, trade.totalShares, trade.direction)
    : null;
  const estPnlPct = valid
    ? pnlPercent(trade.entryPrice, parsed, trade.direction)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--background-surface)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-mono text-sm font-semibold text-[var(--text-primary)]">
            Mark Closed — {trade.ticker}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 space-y-1">
          {[
            ["Direction", trade.direction.toUpperCase(), trade.direction === "long" ? "text-[var(--signal-long)]" : "text-[var(--signal-short)]"],
            ["Entry Price", formatCurrency(trade.entryPrice), "text-[var(--text-primary)]"],
            ["Setup", `${trade.setupType} · ${trade.grade}`, "text-[var(--text-primary)]"],
            ["Shares", String(trade.totalShares), "text-[var(--text-primary)]"],
          ].map(([label, val, cls]) => (
            <div key={label} className="flex justify-between font-mono text-xs">
              <span className="text-[var(--text-secondary)]">{label}</span>
              <span className={cls}>{val}</span>
            </div>
          ))}
        </div>

        {estPnlDollars != null && estPnlPct != null && (
          <div className="mb-4 rounded border border-[var(--border-default)] bg-[var(--background-base)] px-3 py-2">
            <div className="flex justify-between font-mono text-xs">
              <span className="text-[var(--text-muted)]">Est. P&L</span>
              <span
                className={estPnlDollars >= 0 ? "text-[#00D084]" : "text-[#FF4D6A]"}
              >
                {estPnlDollars >= 0 ? "+" : ""}
                {formatCurrency(estPnlDollars)}
                {" "}
                ({estPnlPct >= 0 ? "+" : ""}
                {estPnlPct.toFixed(2)}%)
              </span>
            </div>
          </div>
        )}

        <label className="mb-1 block font-mono text-xs text-[var(--text-secondary)]">
          Exit Price
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.00"
          autoFocus
          className="mb-4 w-full rounded border border-[var(--border-default)] bg-[var(--background-base)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--signal-neutral)] focus:outline-none"
        />

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded border border-[var(--border-default)] py-2 font-mono text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Cancel
          </button>
          <button
            onClick={() => valid && onConfirm(parsed)}
            disabled={!valid || submitting}
            className="flex-1 rounded bg-[var(--signal-neutral)] py-2 font-mono text-xs font-medium text-black disabled:opacity-40"
          >
            {submitting ? "Closing..." : "Confirm Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TRADE DETAIL MODAL
// =============================================================================

function TradeDetailModal({
  trade,
  onClose,
}: {
  trade: AlpacaTrade;
  onClose: () => void;
}) {
  const hasExit = trade.exitPrice != null;
  const realPnlDollars = hasExit
    ? pnlDollars(trade.entryPrice, trade.exitPrice!, trade.totalShares, trade.direction)
    : null;
  const realPnlPct = hasExit
    ? pnlPercent(trade.entryPrice, trade.exitPrice!, trade.direction)
    : null;

  const rows: [string, string][] = [
    ["Ticker", trade.ticker],
    ["Direction", trade.direction.toUpperCase()],
    ["Setup Type", trade.setupType],
    ["Grade", trade.grade],
    ["Phase", String(trade.phase)],
    ["Total Shares", String(trade.totalShares)],
    ["T1 Qty", String(trade.t1Qty)],
    ["Phase 2 Qty", String(trade.phase2Qty)],
    ["Entry Price", formatCurrency(trade.entryPrice)],
    ["Stop Price", formatCurrency(trade.stopPrice)],
    ["T1 Price", formatCurrency(trade.t1Price)],
    ["T2 Price", formatCurrency(trade.t2Price)],
    ...(hasExit ? [["Exit Price", formatCurrency(trade.exitPrice!)] as [string, string]] : []),
    ...(realPnlDollars != null
      ? [
          [
            "Realized P&L",
            `${realPnlDollars >= 0 ? "+" : ""}${formatCurrency(realPnlDollars)} (${realPnlPct! >= 0 ? "+" : ""}${realPnlPct!.toFixed(2)}%)`,
          ] as [string, string],
        ]
      : []),
    ["Outcome", trade.outcome ?? "—"],
    ["Exit Reason", trade.exitReason ?? "—"],
    ["Hold", holdDuration(trade.submittedAt, trade.closedAt ?? null)],
    ["Submitted", new Date(trade.submittedAt).toLocaleString()],
    ...(trade.t1FilledAt
      ? [["T1 Filled", new Date(trade.t1FilledAt).toLocaleString()] as [string, string]]
      : []),
    ...(trade.closedAt
      ? [["Closed At", new Date(trade.closedAt).toLocaleString()] as [string, string]]
      : []),
  ];

  function colorForRow(label: string, value: string) {
    if (label === "Direction") {
      return value === "LONG"
        ? "text-[var(--signal-long)]"
        : "text-[var(--signal-short)]";
    }
    if (label === "Outcome") {
      return value === "win"
        ? "text-[#00D084]"
        : value === "loss"
        ? "text-[#FF4D6A]"
        : "text-[var(--text-primary)]";
    }
    if (label === "Exit Reason") {
      if (value === "t2") return "text-[#00D084]";
      if (value === "t1") return "text-[#4dde9e]";
      if (value === "trailing_stop") return "text-[#F5A623]";
      if (value === "stop_loss") return "text-[#FF4D6A]";
    }
    if (label === "Realized P&L") {
      return value.startsWith("+") ? "text-[#00D084]" : "text-[#FF4D6A]";
    }
    return "text-[var(--text-primary)]";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-[var(--border-default)] bg-[var(--background-surface)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-mono text-sm font-semibold text-[var(--text-primary)]">
            Trade Detail — {trade.ticker}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[28rem] overflow-y-auto">
          <table className="w-full">
            <tbody>
              {rows.map(([label, value]) => (
                <tr
                  key={label}
                  className="border-b border-[var(--border-default)] last:border-0"
                >
                  <td className="py-1.5 pr-6 font-mono text-xs text-[var(--text-muted)]">
                    {label}
                  </td>
                  <td className={cn("py-1.5 font-mono text-xs", colorForRow(label, value))}>
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Closed trades sort
  const [sortKey, setSortKey] = useState<ClosedSortKey>("closedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Mark Closed modal
  const [closeModalTrade, setCloseModalTrade] = useState<AlpacaTrade | null>(null);
  const [closeSubmitting, setCloseSubmitting] = useState(false);

  // Trade detail modal
  const [detailTrade, setDetailTrade] = useState<AlpacaTrade | null>(null);

  // Core data fetch — stable reference via useCallback
  const fetchData = useCallback(async () => {
    const [tradesRes, positionsRes] = await Promise.all([
      fetch("/api/alpaca/trades").then((r) => r.json()),
      fetch("/api/alpaca/positions").then((r) => r.json()),
    ]);
    setTrades(tradesRes.trades ?? []);
    setPositions(positionsRes.positions ?? []);
    setLastUpdated(new Date());
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchData()
      .catch((err) => { if (!cancelled) setError(String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchData]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      await fetchData();
    } catch (err) {
      setError(String(err));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCloseTrade(exitPrice: number) {
    if (!closeModalTrade) return;
    setCloseSubmitting(true);
    try {
      const res = await fetch("/api/alpaca/close-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeId: closeModalTrade.tradeId, exitPrice }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setCloseModalTrade(null);
      await fetchData();
    } catch (err) {
      setError(String(err));
    } finally {
      setCloseSubmitting(false);
    }
  }

  // Split open vs closed
  const openTrades = useMemo(() => trades.filter((t) => t.phase !== "closed"), [trades]);
  const closedTrades = useMemo(() => trades.filter((t) => t.phase === "closed"), [trades]);

  // Today's activity
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const todayTrades = useMemo(
    () => trades.filter((t) => t.submittedAt.startsWith(todayPrefix)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trades]
  );
  const todayClosed = useMemo(
    () => todayTrades.filter((t) => t.phase === "closed"),
    [todayTrades]
  );
  const todayPnl = useMemo(
    () =>
      todayClosed
        .filter((t) => t.exitPrice != null)
        .reduce(
          (sum, t) =>
            sum + pnlDollars(t.entryPrice, t.exitPrice!, t.totalShares, t.direction),
          0
        ),
    [todayClosed]
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
  const exitDist = useMemo(() => computeExitDistribution(closedTrades), [closedTrades]);

  // Sorted closed trades
  const sortedClosed = useMemo(() => {
    const copy = [...closedTrades];
    copy.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortKey) {
        case "ticker": av = a.ticker; bv = b.ticker; break;
        case "grade": av = a.grade; bv = b.grade; break;
        case "setupType": av = a.setupType; bv = b.setupType; break;
        case "closedAt": av = a.closedAt ?? ""; bv = b.closedAt ?? ""; break;
        case "outcome": av = a.outcome ?? ""; bv = b.outcome ?? ""; break;
        case "pnlDollars":
          av = a.exitPrice != null ? pnlDollars(a.entryPrice, a.exitPrice, a.totalShares, a.direction) : -Infinity;
          bv = b.exitPrice != null ? pnlDollars(b.entryPrice, b.exitPrice, b.totalShares, b.direction) : -Infinity;
          break;
        case "pnlPct":
          av = a.exitPrice != null ? pnlPercent(a.entryPrice, a.exitPrice, a.direction) : -Infinity;
          bv = b.exitPrice != null ? pnlPercent(b.entryPrice, b.exitPrice, b.direction) : -Infinity;
          break;
        case "exitReason": av = a.exitReason ?? ""; bv = b.exitReason ?? ""; break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [closedTrades, sortKey, sortDir]);

  function toggleSort(key: ClosedSortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function sortIndicator(key: ClosedSortKey) {
    if (sortKey !== key) return null;
    return (
      <span className="ml-1 text-[var(--signal-neutral)]">
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  }

  function exportCSV() {
    const headers = [
      "Ticker", "Direction", "Setup Type", "Grade",
      "Entry", "Exit", "$ P&L", "% P&L",
      "Hold", "Outcome", "Exit Reason", "Submitted", "Closed",
    ];
    const rows = sortedClosed.map((t) => {
      const hasExit = t.exitPrice != null;
      const rpnlD = hasExit
        ? pnlDollars(t.entryPrice, t.exitPrice!, t.totalShares, t.direction).toFixed(2)
        : "";
      const rpnlP = hasExit
        ? pnlPercent(t.entryPrice, t.exitPrice!, t.direction).toFixed(2)
        : "";
      return [
        t.ticker, t.direction, t.setupType, t.grade,
        t.entryPrice.toFixed(2), hasExit ? t.exitPrice!.toFixed(2) : "",
        rpnlD, rpnlP,
        holdDuration(t.submittedAt, t.closedAt ?? null),
        t.outcome ?? "", t.exitReason ?? "", t.submittedAt, t.closedAt ?? "",
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `trades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      {/* Modals */}
      {closeModalTrade && (
        <CloseTradeModal
          trade={closeModalTrade}
          onClose={() => setCloseModalTrade(null)}
          onConfirm={handleCloseTrade}
          submitting={closeSubmitting}
        />
      )}
      {detailTrade && (
        <TradeDetailModal trade={detailTrade} onClose={() => setDetailTrade(null)} />
      )}

      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="font-mono text-2xl font-bold text-[var(--text-primary)]">
            Swing Auto Testing
          </h1>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="font-mono text-xs text-[var(--text-muted)]">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="flex items-center gap-1.5 rounded border border-[var(--border-default)] px-2 py-1 font-mono text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <span className="font-mono text-xs text-[var(--text-muted)]">
              Paper · $100k · 1% risk
            </span>
          </div>
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
            {/* -------------------------------------------------------------- */}
            {/* AGGREGATE STATS                                                 */}
            {/* -------------------------------------------------------------- */}
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
                  valueClass={stats.winRate >= 0.5 ? "text-[#00D084]" : "text-[#FF4D6A]"}
                />
                <StatCard
                  label="Avg Win"
                  value={stats.avgWinPct > 0 ? `+${stats.avgWinPct.toFixed(1)}%` : "—"}
                  valueClass="text-[#00D084]"
                />
                <StatCard
                  label="Avg Loss"
                  value={stats.avgLossPct < 0 ? `${stats.avgLossPct.toFixed(1)}%` : "—"}
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
                  valueClass={stats.expectancy >= 0 ? "text-[#00D084]" : "text-[#FF4D6A]"}
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

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <BreakdownTable rows={gradeRows} title="BY GRADE" />
                <BreakdownTable rows={setupRows} title="BY SETUP TYPE" />
              </div>

              {/* Exit Distribution */}
              <div className="mt-6">
                <h3 className="mb-2 font-mono text-xs font-semibold text-[var(--text-secondary)]">
                  EXIT DISTRIBUTION
                </h3>
                {exitDist.total === 0 ? (
                  <p className="font-sans text-sm text-[var(--text-muted)]">
                    No closed trades with exit data yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      { label: "T2 (Full Target)", count: exitDist.t2, color: "#00D084" },
                      { label: "T1 (Partial)",     count: exitDist.t1, color: "#4dde9e" },
                      { label: "Trail Stop",        count: exitDist.trailingStop, color: "#F5A623" },
                      { label: "Stop Loss",         count: exitDist.stopLoss, color: "#FF4D6A" },
                    ].map(({ label, count, color }) => (
                      <div
                        key={label}
                        className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-3"
                      >
                        <p className="font-mono text-xs text-[var(--text-muted)]">{label}</p>
                        <p
                          className="font-mono text-lg font-bold tabular-nums"
                          style={{ color }}
                        >
                          {count}
                        </p>
                        <p className="font-mono text-xs text-[var(--text-secondary)]">
                          {exitDist.total > 0
                            ? `${((count / exitDist.total) * 100).toFixed(0)}%`
                            : "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* -------------------------------------------------------------- */}
            {/* TODAY'S ACTIVITY                                                */}
            {/* -------------------------------------------------------------- */}
            <section>
              <h2 className="mb-3 font-mono text-sm font-semibold text-[var(--text-secondary)]">
                TODAY&apos;S ACTIVITY
              </h2>
              {todayTrades.length === 0 ? (
                <p className="font-sans text-sm text-[var(--text-muted)]">
                  No setups submitted today.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <StatCard
                    label="Setups Today"
                    value={String(todayTrades.length)}
                  />
                  <StatCard
                    label="Still Open"
                    value={String(
                      todayTrades.filter((t) => t.phase !== "closed").length
                    )}
                  />
                  <StatCard
                    label="Closed Today"
                    value={String(todayClosed.length)}
                    sub={`${todayClosed.filter((t) => t.outcome === "win").length}W / ${todayClosed.filter((t) => t.outcome === "loss").length}L`}
                  />
                  <StatCard
                    label="Today P&L"
                    value={
                      todayClosed.length > 0
                        ? `${todayPnl >= 0 ? "+" : ""}${formatCurrency(todayPnl)}`
                        : "—"
                    }
                    valueClass={todayPnl >= 0 ? "text-[#00D084]" : "text-[#FF4D6A]"}
                  />
                </div>
              )}
            </section>

            {/* -------------------------------------------------------------- */}
            {/* OPEN POSITIONS                                                  */}
            {/* -------------------------------------------------------------- */}
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
                          "Unreal. P&L (%)", "Shares", "Phase", "",
                        ].map((h, i) => (
                          <th key={i} className={thStaticClass}>{h}</th>
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
                              "cursor-pointer border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--background-elevated)]",
                              t.direction === "long"
                                ? "border-l-[3px] border-l-[var(--signal-long-muted)]"
                                : "border-l-[3px] border-l-[var(--signal-short-muted)]"
                            )}
                            onClick={() => setDetailTrade(t)}
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
                            <td
                              className="px-4 py-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => setCloseModalTrade(t)}
                                className="rounded border border-[var(--border-default)] px-2 py-0.5 font-mono text-xs text-[var(--text-secondary)] hover:border-[var(--signal-short)] hover:text-[var(--signal-short)]"
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
            </section>

            {/* -------------------------------------------------------------- */}
            {/* CLOSED TRADES                                                   */}
            {/* -------------------------------------------------------------- */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-mono text-sm font-semibold text-[var(--text-secondary)]">
                  CLOSED TRADES
                  <span className="ml-2 font-normal text-[var(--text-muted)]">
                    ({closedTrades.length})
                  </span>
                </h2>
                {closedTrades.length > 0 && (
                  <button
                    onClick={exportCSV}
                    className="flex items-center gap-1.5 rounded border border-[var(--border-default)] px-2 py-1 font-mono text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <Download size={12} />
                    Export CSV
                  </button>
                )}
              </div>

              {closedTrades.length === 0 ? (
                <p className="font-sans text-sm text-[var(--text-muted)]">
                  No closed trades yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--border-default)] bg-[var(--background-surface)]">
                        <th className={thClass} onClick={() => toggleSort("ticker")}>
                          Ticker{sortIndicator("ticker")}
                        </th>
                        <th className={thStaticClass}>Direction</th>
                        <th className={thClass} onClick={() => toggleSort("setupType")}>
                          Setup Type{sortIndicator("setupType")}
                        </th>
                        <th className={thClass} onClick={() => toggleSort("grade")}>
                          Grade{sortIndicator("grade")}
                        </th>
                        <th className={thStaticClass}>Entry</th>
                        <th className={thStaticClass}>Exit</th>
                        <th className={thClass} onClick={() => toggleSort("pnlDollars")}>
                          $ P&L{sortIndicator("pnlDollars")}
                        </th>
                        <th className={thClass} onClick={() => toggleSort("pnlPct")}>
                          % P&L{sortIndicator("pnlPct")}
                        </th>
                        <th className={thStaticClass}>Hold</th>
                        <th className={thClass} onClick={() => toggleSort("outcome")}>
                          Outcome{sortIndicator("outcome")}
                        </th>
                        <th className={thClass} onClick={() => toggleSort("exitReason")}>
                          Exit{sortIndicator("exitReason")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedClosed.map((t) => {
                        const hasExit = t.exitPrice != null;
                        const realizedPnlDollars = hasExit
                          ? pnlDollars(
                              t.entryPrice,
                              t.exitPrice!,
                              t.totalShares,
                              t.direction
                            )
                          : null;
                        const realizedPnlPct = hasExit
                          ? pnlPercent(t.entryPrice, t.exitPrice!, t.direction)
                          : null;

                        return (
                          <tr
                            key={t.tradeId}
                            className={cn(
                              "cursor-pointer border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--background-elevated)]",
                              t.direction === "long"
                                ? "border-l-[3px] border-l-[var(--signal-long-muted)]"
                                : "border-l-[3px] border-l-[var(--signal-short-muted)]"
                            )}
                            onClick={() => setDetailTrade(t)}
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
                                    realizedPnlDollars >= 0
                                      ? "text-[#00D084]"
                                      : "text-[#FF4D6A]"
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
                              {holdDuration(t.submittedAt, t.closedAt ?? null)}
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
                            <td className="px-4 py-2">
                              <ExitBadge reason={t.exitReason} />
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
