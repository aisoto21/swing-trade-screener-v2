"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { OptionsToggle, type OptionsMode } from "@/components/options/OptionsToggle";
import { Select } from "@/components/ui/select";
import type { ScreenerFilters } from "@/types";
import { cn } from "@/lib/utils/cn";

interface FilterPanelProps {
  filters: ScreenerFilters;
  onFiltersChange: (f: ScreenerFilters) => void;
  onRun: () => void;
  isLoading: boolean;
  optionsMode?: OptionsMode;
  onOptionsModeChange?: (v: OptionsMode) => void;
}

const SECTORS = [
  "All", "Technology", "Consumer Cyclical", "Consumer Defensive",
  "Healthcare", "Financial Services", "Industrials", "Energy",
  "Communication Services", "Real Estate", "Utilities", "Basic Materials",
];

function SegmentedControl<T extends string>({
  value, options, onChange,
}: {
  value: T; options: readonly T[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded border border-[var(--border-default)] bg-[var(--background-surface)] p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "rounded px-3 py-1.5 font-mono text-xs transition-colors",
            value === opt
              ? "border border-[var(--signal-neutral)] bg-[var(--background-elevated)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function FilterPanel({
  filters, onFiltersChange, onRun, isLoading,
  optionsMode = "Stocks", onOptionsModeChange,
}: FilterPanelProps) {
  const update = (updates: Partial<ScreenerFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const hasActiveAdvanced =
    (filters.minRSRating ?? 0) > 0 ||
    filters.excludeEarningsRisk ||
    (filters.sector && filters.sector !== "All");

  return (
    <div className="sticky top-[76px] z-20 border-b border-[var(--border-default)] bg-[var(--background-base)]">
      {/* ── Primary filter bar ── */}
      <div className="flex h-12 flex-wrap items-center gap-4 px-4 md:flex-nowrap">
        {onOptionsModeChange && (
          <OptionsToggle value={optionsMode} onChange={onOptionsModeChange} />
        )}

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-[var(--text-muted)]">Bias</span>
          <SegmentedControl
            value={filters.biasFilter}
            options={["BOTH", "LONG", "SHORT"] as const}
            onChange={(v) => update({ biasFilter: v })}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-[var(--text-muted)]">Grade</span>
          <SegmentedControl
            value={filters.minSetupGrade === "C" ? "ALL" : filters.minSetupGrade}
            options={["ALL", "A+", "A", "B"] as const}
            onChange={(v) => update({ minSetupGrade: v === "ALL" ? "C" : v })}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-[var(--text-muted)]">
            R:R {filters.minRR.toFixed(1)}x
          </span>
          <input
            type="range" min={1} max={3} step={0.1} value={filters.minRR}
            onChange={(e) => update({ minRR: parseFloat(e.target.value) })}
            className="h-1.5 w-24 accent-[var(--signal-neutral)]"
          />
        </div>

        {/* Advanced toggle */}
        <button
          onClick={() => setAdvancedOpen((o) => !o)}
          className={cn(
            "flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs transition-colors",
            advancedOpen || hasActiveAdvanced
              ? "border-[var(--signal-neutral)]/50 bg-[var(--signal-neutral)]/10 text-[var(--signal-neutral)]"
              : "border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          )}
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          Filters
          {hasActiveAdvanced && (
            <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[var(--signal-neutral)]" />
          )}
        </button>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-[var(--text-muted)]">$</span>
            <Input
              type="number" value={filters.accountSize}
              onChange={(e) => update({ accountSize: parseInt(e.target.value) || 25000 })}
              className="h-8 w-24 font-mono text-xs tabular-nums"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-[var(--text-muted)]">Risk</span>
            <Input
              type="number" value={(filters.riskPerTrade * 100).toFixed(1)}
              onChange={(e) => update({ riskPerTrade: (parseFloat(e.target.value) || 1) / 100 })}
              className="h-8 w-14 font-mono text-xs tabular-nums"
            />
            <span className="font-mono text-xs text-[var(--text-muted)]">%</span>
          </div>
          <button
            onClick={onRun} disabled={isLoading}
            className="flex h-9 w-[140px] items-center justify-center rounded bg-[var(--signal-neutral)] font-mono text-xs font-medium text-white transition-all hover:brightness-110 hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Scanning...
              </span>
            ) : "Run Screen"}
          </button>
        </div>
      </div>

      {/* ── Advanced drawer ── */}
      {advancedOpen && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[var(--border-default)] bg-[var(--background-subtle)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-[var(--text-muted)]" title="Minimum Relative Strength Rating vs SPY (0–100)">
              Min RS: {filters.minRSRating ?? 0}
            </span>
            <input
              type="range" min={0} max={90} step={5}
              value={filters.minRSRating ?? 0}
              onChange={(e) => update({ minRSRating: parseInt(e.target.value) })}
              className="h-1.5 w-24 accent-[var(--signal-neutral)]"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-1.5" title="Hide tickers with earnings within 14 days">
            <input
              type="checkbox"
              checked={filters.excludeEarningsRisk ?? false}
              onChange={(e) => update({ excludeEarningsRisk: e.target.checked })}
              className="rounded border-[var(--border-default)]"
            />
            <span className="font-mono text-xs text-[var(--text-secondary)]">Exclude earnings risk</span>
          </label>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={filters.includeBearishSetups ?? true}
              onChange={(e) => update({ includeBearishSetups: e.target.checked })}
              className="rounded border-[var(--border-default)]"
            />
            <span className="font-mono text-xs text-[var(--text-secondary)]">Include shorts</span>
          </label>

          <Select
            value={filters.sector ?? "All"}
            onChange={(e) => update({ sector: e.target.value === "All" ? undefined : e.target.value })}
            className="h-8 w-40 border-[var(--border-default)] bg-[var(--background-surface)] font-mono text-xs"
          >
            {SECTORS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>

          <button
            onClick={() => {
              update({ minRSRating: 0, excludeEarningsRisk: false, sector: undefined, includeBearishSetups: true });
            }}
            className="font-mono text-xs text-[var(--text-muted)] hover:text-[var(--signal-short)]"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

