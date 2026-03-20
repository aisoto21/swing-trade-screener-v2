"use client";

import { memo } from "react";
import type { EarningsData } from "@/types";
import { cn } from "@/lib/utils/cn";
import { Tooltip } from "@/components/ui/Tooltip";

interface EarningsBadgeProps {
  earnings: EarningsData;
  className?: string;
}

export const EarningsBadge = memo(function EarningsBadge({ earnings, className }: EarningsBadgeProps) {
  if (earnings.riskLevel === "UNKNOWN" || earnings.daysToEarnings > 45) return null;

  const isHigh = earnings.riskLevel === "HIGH";
  const isModerate = earnings.riskLevel === "MODERATE";

  const badgeClass = isHigh
    ? "bg-[var(--signal-short-muted)] border-[var(--signal-short)]/40 text-[var(--signal-short)]"
    : isModerate
    ? "bg-[rgba(255,179,71,0.08)] border-[rgba(255,179,71,0.3)] text-[var(--regime-choppy)]"
    : "bg-[var(--background-subtle)] border-[var(--border-default)] text-[var(--text-muted)]";

  const label =
    earnings.daysToEarnings <= 0 ? "EARN TODAY"
    : earnings.daysToEarnings === 1 ? "EARN TOMORROW"
    : `EARN ${earnings.daysToEarnings}D`;

  return (
    <Tooltip width={224} className={cn("inline-flex", className)} content={
      <>
        <p className="mb-1 font-mono text-xs font-semibold text-[var(--text-primary)]">Earnings Risk</p>
        <div className="space-y-1 font-mono text-[11px]">
          <div className="flex justify-between gap-4"><span className="text-[var(--text-muted)]">Days to earnings</span><span className={isHigh ? "text-[var(--signal-short)]" : "text-[var(--text-primary)]"}>{earnings.daysToEarnings <= 0 ? "Today" : `${earnings.daysToEarnings} days`}</span></div>
          {earnings.nextEarningsDate && <div className="flex justify-between gap-4"><span className="text-[var(--text-muted)]">Date</span><span className="text-[var(--text-secondary)]">{earnings.nextEarningsDate}</span></div>}
          <div className="flex justify-between gap-4"><span className="text-[var(--text-muted)]">Risk level</span><span className={isHigh ? "text-[var(--signal-short)]" : isModerate ? "text-[var(--regime-choppy)]" : "text-[var(--text-muted)]"}>{earnings.riskLevel}</span></div>
        </div>
        {isHigh && <p className="mt-2 text-[10px] text-[var(--signal-short)]">⚠ High gap risk. Consider reducing size or waiting for post-earnings resolution.</p>}
        {isModerate && <p className="mt-2 text-[10px] text-[var(--regime-choppy)]">Earnings within 3 weeks. Factor into hold duration and position size.</p>}
      </>
    }>
      <span className={cn("inline-flex cursor-default items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium", badgeClass)}>
        {isHigh && <span className="animate-pulse">⚡</span>}
        {label}
      </span>
    </Tooltip>
  );
});
