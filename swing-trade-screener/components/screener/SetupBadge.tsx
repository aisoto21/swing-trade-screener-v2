"use client";

import { memo } from "react";
import type { SetupResult } from "@/types";
import { cn } from "@/lib/utils/cn";

interface SetupBadgeProps {
  setup: SetupResult;
  className?: string;
}

export const SetupBadge = memo(function SetupBadge({ setup, className }: SetupBadgeProps) {
  const isLong = setup.bias === "LONG";
  const isAplus = setup.grade === "A+";

  return (
    <div className={cn("group relative max-w-[160px]", className)}>
      <span
        className={cn(
          "inline-flex max-w-full items-center truncate rounded border px-2 py-0.5 font-mono text-[11px] tracking-[0.08em]",
          isLong
            ? "border-[var(--signal-long)]/40 bg-[var(--signal-long-muted)] text-[var(--signal-long)]"
            : "border-[var(--signal-short)]/40 bg-[var(--signal-short-muted)] text-[var(--signal-short)]"
        )}
        title={setup.name}
      >
        {isAplus && <span className="mr-1 text-[var(--grade-aplus)]">●</span>}
        {setup.name}
      </span>
      <div className="absolute left-0 top-full z-50 mt-1 hidden w-72 rounded border border-[var(--border-default)] bg-[var(--background-elevated)] p-3 shadow-lg group-hover:block">
        <p className="font-medium text-[var(--text-primary)]">{setup.name}</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {setup.bias} • {setup.timeframe} • Grade: {setup.grade}
        </p>
        <ul className="mt-2 space-y-1 text-xs">
          {setup.confirmingFactors.map((f, i) => (
            <li key={i} className="text-[var(--signal-long)]">✓ {f}</li>
          ))}
          {setup.riskFactors.map((f, i) => (
            <li key={i} className="text-[var(--signal-short)]">⚠ {f}</li>
          ))}
        </ul>
      </div>
    </div>
  );
});
