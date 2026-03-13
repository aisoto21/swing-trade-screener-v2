"use client";

import { Input } from "@/components/ui/input";
import { OptionsToggle, type OptionsMode } from "@/components/options/OptionsToggle";
import { Select } from "@/components/ui/select";
import type { ScreenerFilters } from "@/types";
import type { SetupGrade } from "@/types";
import { cn } from "@/lib/utils/cn";

interface FilterPanelProps {
  filters: ScreenerFilters;
  onFiltersChange: (f: ScreenerFilters) => void;
  onRun: () => void;
  isLoading: boolean;
  optionsMode?: OptionsMode;
  onOptionsModeChange?: (v: OptionsMode) => void;
}

const GRADE_OPTIONS: SetupGrade[] = ["A+", "A", "B", "C"];
const SECTORS = [
  "All",
  "Technology",
  "Consumer Cyclical",
  "Consumer Defensive",
  "Healthcare",
  "Financial Services",
  "Industrials",
  "Energy",
  "Communication Services",
  "Real Estate",
  "Utilities",
  "Basic Materials",
];

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
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
  filters,
  onFiltersChange,
  onRun,
  isLoading,
  optionsMode = "Stocks",
  onOptionsModeChange,
}: FilterPanelProps) {
  const update = (updates: Partial<ScreenerFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  return (
    <>
      <div className="sticky top-[76px] z-20 flex h-12 flex-wrap items-center gap-4 border-b border-[var(--border-default)] bg-[var(--background-base)] px-4 md:flex-nowrap">
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
            Min R:R: {filters.minRR.toFixed(1)}x
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={filters.minRR}
            onChange={(e) => update({ minRR: parseFloat(e.target.value) })}
            className="h-1.5 w-24 accent-[var(--signal-neutral)]"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={filters.includeBearishSetups ?? true}
            onChange={(e) => update({ includeBearishSetups: e.target.checked })}
            className="rounded border-[var(--border-default)]"
          />
          <span className="font-mono text-xs text-[var(--text-secondary)]">
            Short setups
          </span>
        </label>

        <Select
          value={filters.sector ?? "All"}
          onChange={(e) => update({ sector: e.target.value === "All" ? undefined : e.target.value })}
          className="h-8 w-32 border-[var(--border-default)] bg-[var(--background-surface)] font-mono text-xs"
        >
          {SECTORS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-[var(--text-muted)]">$</span>
            <Input
              type="number"
              value={filters.accountSize}
              onChange={(e) => update({ accountSize: parseInt(e.target.value) || 25000 })}
              className="h-8 w-24 font-mono text-xs tabular-nums"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-[var(--text-muted)]">Risk</span>
            <Input
              type="number"
              value={(filters.riskPerTrade * 100).toFixed(1)}
              onChange={(e) => update({ riskPerTrade: (parseFloat(e.target.value) || 1) / 100 })}
              className="h-8 w-14 font-mono text-xs tabular-nums"
            />
            <span className="font-mono text-xs text-[var(--text-muted)]">%</span>
          </div>
          <button
            onClick={onRun}
            disabled={isLoading}
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
            ) : (
              "Run Screen"
            )}
          </button>
        </div>
      </div>
    </>
  );
}
