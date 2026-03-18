"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useWatchlistStore } from "@/lib/stores/watchlistStore";
import type { WatchlistEntry, ScreenType } from "@/lib/stores/watchlistStore";
import { formatCurrency } from "@/lib/utils/formatter";
import { cn } from "@/lib/utils/cn";

const SCREEN_TYPES: ScreenType[] = [
  "Swing",
  "Position",
  "Quality Growth",
  "Deep Value",
];

export function PortfolioWatchlist() {
  const { entries, addEntry, removeEntry, toggleAlert } = useWatchlistStore();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [pricesLoading, setPricesLoading] = useState(false);

  const [form, setForm] = useState({
    ticker: "",
    companyName: "",
    setupName: "",
    screenType: "Swing" as ScreenType,
    entryZoneLow: 0,
    entryZoneHigh: 0,
    plannedStop: 0,
    plannedT1: 0,
    note: "",
    alertOnEntry: true,
  });

  const tickers = entries.map((e) => e.ticker).join(",");
  useEffect(() => {
    if (entries.length === 0) {
      setPrices({});
      return;
    }
    setPricesLoading(true);
    Promise.all(
      entries.map((e) =>
        fetch(`/api/marketquote/${e.ticker}`)
          .then((r) => r.json())
          .then((d) => ({ ticker: e.ticker, price: d?.price as number }))
          .catch(() => ({ ticker: e.ticker, price: NaN }))
      )
    )
      .then((results) => {
        const map: Record<string, number> = {};
        for (const r of results) {
          map[r.ticker] = r.price;
        }
        setPrices(map);
      })
      .finally(() => setPricesLoading(false));
  }, [tickers, entries.length]);

  const handleAdd = () => {
    if (!form.ticker.trim() || form.entryZoneLow <= 0 || form.entryZoneHigh <= 0) return;
    addEntry({
      ticker: form.ticker.toUpperCase().trim(),
      companyName: form.companyName.trim() || form.ticker,
      setupName: form.setupName.trim() || "—",
      screenType: form.screenType,
      entryZoneLow: form.entryZoneLow,
      entryZoneHigh: form.entryZoneHigh,
      plannedStop: form.plannedStop,
      plannedT1: form.plannedT1,
      note: form.note.trim() || undefined,
      alertOnEntry: form.alertOnEntry,
    });
    setForm({
      ticker: "",
      companyName: "",
      setupName: "",
      screenType: "Swing",
      entryZoneLow: 0,
      entryZoneHigh: 0,
      plannedStop: 0,
      plannedT1: 0,
      note: "",
      alertOnEntry: true,
    });
    setAddModalOpen(false);
  };

  const getDistanceToEntry = (e: WatchlistEntry): string => {
    const price = prices[e.ticker];
    if (price == null || Number.isNaN(price)) return "—";
    if (price >= e.entryZoneLow && price <= e.entryZoneHigh) return "IN ZONE";
    const pct =
      ((e.entryZoneHigh - price) / price) * 100;
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% away`;
  };

  const isInZone = (e: WatchlistEntry): boolean => {
    const price = prices[e.ticker];
    if (price == null || Number.isNaN(price)) return false;
    return price >= e.entryZoneLow && price <= e.entryZoneHigh;
  };

  const isApproaching = (e: WatchlistEntry): boolean => {
    const price = prices[e.ticker];
    if (price == null || Number.isNaN(price)) return false;
    if (isInZone(e)) return false;
    const pct = ((e.entryZoneHigh - price) / price) * 100;
    return pct > -5 && pct < 5;
  };

  return (
    <div className="mt-8 rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-mono text-sm font-semibold text-[var(--text-secondary)]">
          Watchlist — setups to monitor
        </h2>
        <button
          onClick={() => setAddModalOpen(true)}
          className="rounded border border-[var(--signal-neutral)] px-3 py-1.5 font-mono text-xs text-[var(--signal-neutral)] hover:bg-[var(--signal-neutral)]/10"
        >
          Add to Watchlist
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="font-sans text-sm text-[var(--text-muted)]">
          No watchlist entries. Add tickers from the screener or manually.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th className="px-3 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">
                  Ticker
                </th>
                <th className="px-3 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">
                  Screen
                </th>
                <th className="px-3 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">
                  Setup
                </th>
                <th className="px-3 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">
                  Entry Zone
                </th>
                <th className="px-3 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">
                  Stop
                </th>
                <th className="px-3 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">
                  T1
                </th>
                <th className="px-3 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">
                  Distance to Entry
                </th>
                <th className="px-3 py-2 text-left font-mono text-xs font-medium text-[var(--text-secondary)]">
                  Alert
                </th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const dist = getDistanceToEntry(e);
                const inZone = isInZone(e);
                const approaching = isApproaching(e);
                return (
                  <tr
                    key={e.id}
                    className="border-b border-[var(--border-default)]"
                  >
                    <td className="px-3 py-2 font-mono text-sm font-bold">
                      {e.ticker}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {e.screenType}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {e.setupName}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums">
                      {formatCurrency(e.entryZoneLow)} – {formatCurrency(e.entryZoneHigh)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums text-[var(--signal-short)]">
                      {formatCurrency(e.plannedStop)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums text-[var(--signal-long)]">
                      {formatCurrency(e.plannedT1)}
                    </td>
                    <td className="px-3 py-2">
                      {pricesLoading ? (
                        <span className="inline-block h-4 w-12 animate-pulse rounded bg-[var(--background-subtle)]" />
                      ) : (
                        <span
                          className={cn(
                            "font-mono text-xs",
                            inZone && "text-[var(--signal-long)] font-medium",
                            approaching && !inZone && "text-[var(--regime-choppy)]",
                            !inZone && !approaching && "text-[var(--text-muted)]"
                          )}
                        >
                          {inZone && (
                            <span className="inline-flex items-center gap-1">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--signal-long)]" />
                              {dist}
                            </span>
                          )}
                          {!inZone && dist}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleAlert(e.id)}
                        className={cn(
                          "rounded p-1",
                          e.alertOnEntry
                            ? "text-[var(--signal-neutral)]"
                            : "text-[var(--text-muted)]"
                        )}
                        title={e.alertOnEntry ? "Alert on" : "Alert off"}
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                        </svg>
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      {removeConfirmId === e.id ? (
                        <span className="flex gap-1">
                          <button
                            onClick={() => removeEntry(e.id)}
                            className="font-mono text-[10px] text-[var(--signal-short)] hover:underline"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setRemoveConfirmId(null)}
                            className="font-mono text-[10px] text-[var(--text-muted)] hover:underline"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setRemoveConfirmId(e.id)}
                          className="text-[var(--text-muted)] hover:text-[var(--signal-short)]"
                          title="Remove"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono">Add to Watchlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">Ticker *</label>
              <input
                type="text"
                value={form.ticker}
                onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-mono text-sm"
                placeholder="AAPL"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">Company name</label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-sans text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">Screen type</label>
              <select
                value={form.screenType}
                onChange={(e) => setForm((f) => ({ ...f, screenType: e.target.value as ScreenType }))}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-mono text-sm"
              >
                {SCREEN_TYPES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">Setup name</label>
              <input
                type="text"
                value={form.setupName}
                onChange={(e) => setForm((f) => ({ ...f, setupName: e.target.value }))}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-sans text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">Entry Zone Low *</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.entryZoneLow || ""}
                  onChange={(e) => setForm((f) => ({ ...f, entryZoneLow: parseFloat(e.target.value) || 0 }))}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">Entry Zone High *</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.entryZoneHigh || ""}
                  onChange={(e) => setForm((f) => ({ ...f, entryZoneHigh: parseFloat(e.target.value) || 0 }))}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">Stop</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.plannedStop || ""}
                  onChange={(e) => setForm((f) => ({ ...f, plannedStop: parseFloat(e.target.value) || 0 }))}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">T1</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.plannedT1 || ""}
                  onChange={(e) => setForm((f) => ({ ...f, plannedT1: parseFloat(e.target.value) || 0 }))}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">Note</label>
              <textarea
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={2}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-sans text-sm"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={form.alertOnEntry}
                onChange={(e) => setForm((f) => ({ ...f, alertOnEntry: e.target.checked }))}
                className="rounded border-[var(--border-default)]"
              />
              <span className="font-mono text-xs text-[var(--text-secondary)]">
                Alert when price enters entry zone
              </span>
            </label>
          </div>
          <DialogFooter>
            <button
              onClick={() => setAddModalOpen(false)}
              className="rounded border border-[var(--border-default)] px-3 py-1.5 font-mono text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!form.ticker.trim() || form.entryZoneLow <= 0 || form.entryZoneHigh <= 0}
              className="rounded bg-[var(--signal-neutral)] px-3 py-1.5 font-mono text-xs text-white disabled:opacity-50"
            >
              Add
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
