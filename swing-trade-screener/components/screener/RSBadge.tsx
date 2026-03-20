"use client";

import { memo } from "react";
import type { RSAnalysis } from "@/types";
import { cn } from "@/lib/utils/cn";
import { Tooltip } from "@/components/ui/Tooltip";

interface RSBadgeProps {
  rs: RSAnalysis | null | undefined;
  className?: string;
}

const CLASSIFICATION_STYLES: Record<RSAnalysis["classification"], { color: string; bg: string; label: string }> = {
  Leader: { color: "text-[var(--grade-aplus)]", bg: "bg-[rgba(255,215,0,0.08)] border-[rgba(255,215,0,0.3)]", label: "RS Leader" },
  Outperformer: { color: "text-[var(--signal-long)]", bg: "bg-[var(--signal-long-muted)] border-[var(--signal-long)]/30", label: "Outperformer" },
  Neutral: { color: "text-[var(--text-secondary)]", bg: "bg-[var(--background-subtle)] border-[var(--border-default)]", label: "Neutral" },
  Laggard: { color: "text-[var(--regime-choppy)]", bg: "bg-[rgba(255,179,71,0.08)] border-[rgba(255,179,71,0.3)]", label: "Laggard" },
  Avoid: { color: "text-[var(--signal-short)]", bg: "bg-[var(--signal-short-muted)] border-[var(--signal-short)]/30", label: "Avoid" },
};

export const RSBadge = memo(function RSBadge({ rs, className }: RSBadgeProps) {
  if (!rs) return <span className="font-mono text-xs text-[var(--text-muted)]">—</span>;
  const style = CLASSIFICATION_STYLES[rs.classification];

  return (
    <Tooltip width={264} className={cn("inline-flex items-center gap-1.5", className)} content={
      <>
        <p className="mb-1 font-mono text-xs font-semibold text-[var(--text-primary)]">Relative Strength vs. SPY</p>
        <div className="space-y-1 font-mono text-[11px]">
          <div className="flex justify-between gap-4"><span className="text-[var(--text-muted)]">Classification</span><span className={style.color}>{style.label}</span></div>
          <div className="flex justify-between gap-4"><span className="text-[var(--text-muted)]">RS Rating (0–100)</span><span className="text-[var(--text-primary)]">{rs.rating.toFixed(1)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-[var(--text-muted)]">1-Quarter RS</span><span className={rs.rs63 > 100 ? "text-[var(--signal-long)]" : "text-[var(--signal-short)]"}>{rs.rs63.toFixed(1)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-[var(--text-muted)]">1-Year RS</span><span className={rs.rs252 > 100 ? "text-[var(--signal-long)]" : "text-[var(--signal-short)]"}>{rs.rs252.toFixed(1)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-[var(--text-muted)]">Trend</span><span className={rs.trending ? "text-[var(--signal-long)]" : "text-[var(--text-secondary)]"}>{rs.trending ? "↑ Accelerating" : "→ Stable/Declining"}</span></div>
          {rs.rsNewHigh && <p className="mt-1 text-[var(--grade-aplus)]">★ RS at 52-week high — leading signal</p>}
        </div>
      </>
    }>
      <span className={cn("inline-flex cursor-default items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px]", style.bg, style.color)}>
        {rs.trending && <span className="text-[var(--signal-long)]">↑</span>}
        {rs.rsNewHigh && <span className="text-[var(--grade-aplus)]">★</span>}
        <span className="tabular-nums">{rs.rating.toFixed(0)}</span>
        <span className="opacity-60">RS</span>
      </span>
    </Tooltip>
  );
});
