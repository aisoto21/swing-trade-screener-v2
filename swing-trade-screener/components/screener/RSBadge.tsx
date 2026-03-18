"use client";

import { memo } from "react";
import type { RSAnalysis } from "@/types";
import { cn } from "@/lib/utils/cn";

interface RSBadgeProps {
  rs: RSAnalysis;
  className?: string;
}

const CLASSIFICATION_STYLES: Record<RSAnalysis["classification"], { color: string; bg: string; label: string }> = {
  Leader: {
    color: "text-[var(--grade-aplus)]",
    bg: "bg-[rgba(255,215,0,0.08)] border-[rgba(255,215,0,0.3)]",
    label: "RS Leader",
  },
  Outperformer: {
    color: "text-[var(--signal-long)]",
    bg: "bg-[var(--signal-long-muted)] border-[var(--signal-long)]/30",
    label: "Outperformer",
  },
  Neutral: {
    color: "text-[var(--text-secondary)]",
    bg: "bg-[var(--background-subtle)] border-[var(--border-default)]",
    label: "Neutral",
  },
  Laggard: {
    color: "text-[var(--regime-choppy)]",
    bg: "bg-[rgba(255,179,71,0.08)] border-[rgba(255,179,71,0.3)]",
    label: "Laggard",
  },
  Avoid: {
    color: "text-[var(--signal-short)]",
    bg: "bg-[var(--signal-short-muted)] border-[var(--signal-short)]/30",
    label: "Avoid",
  },
};

export const RSBadge = memo(function RSBadge({ rs, className }: RSBadgeProps) {
  const style = CLASSIFICATION_STYLES[rs.classification];

  return (
    <div className={cn("group relative inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px]",
          style.bg,
          style.color
        )}
      >
        {/* RS trend arrow */}
        {rs.trending && (
          <span className="text-[var(--signal-long)]" title="RS trending higher (short-term RS accelerating)">
            ↑
          </span>
        )}
        {rs.rsNewHigh && (
          <span className="text-[var(--grade-aplus)]" title="RS line at 52-week high">
            ★
          </span>
        )}
        <span className="tabular-nums">{rs.rating.toFixed(0)}</span>
        <span className="opacity-60">RS</span>
      </span>

      {/* Tooltip */}
      <div className="absolute bottom-full left-0 z-[200] mb-1 hidden w-64 rounded border border-[var(--border-default)] bg-[var(--background-elevated)] p-3 shadow-lg group-hover:block">
        <p className="mb-1 font-mono text-xs font-semibold text-[var(--text-primary)]">
          Relative Strength vs. SPY
        </p>
        <div className="space-y-1 font-mono text-[11px]">
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Classification</span>
            <span className={style.color}>{style.label}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">RS Rating (0–100)</span>
            <span className="text-[var(--text-primary)]">{rs.rating.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">1-Quarter RS</span>
            <span className={rs.rs63 > 100 ? "text-[var(--signal-long)]" : "text-[var(--signal-short)]"}>
              {rs.rs63.toFixed(1)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">1-Year RS</span>
            <span className={rs.rs252 > 100 ? "text-[var(--signal-long)]" : "text-[var(--signal-short)]"}>
              {rs.rs252.toFixed(1)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">RS Trend</span>
            <span className={rs.trending ? "text-[var(--signal-long)]" : "text-[var(--text-secondary)]"}>
              {rs.trending ? "↑ Accelerating" : "→ Stable/Declining"}
            </span>
          </div>
          {rs.rsNewHigh && (
            <p className="mt-1 text-[var(--grade-aplus)]">
              ★ RS line at 52-week high — leading signal
            </p>
          )}
        </div>
      </div>
    </div>
  );
});
