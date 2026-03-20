"use client";

import { memo } from "react";
import type { SetupResult } from "@/types";
import { cn } from "@/lib/utils/cn";
import { Tooltip } from "@/components/ui/Tooltip";

interface SetupBadgeProps {
  setup: SetupResult;
  className?: string;
}

export const SetupBadge = memo(function SetupBadge({ setup, className }: SetupBadgeProps) {
  const isLong = setup.bias === "LONG";
  const isAplus = setup.grade === "A+";

  return (
    <Tooltip width={288} className={cn("max-w-[160px]", className)} content={
      <>
        <p className="font-mono text-xs font-medium text-[var(--text-primary)]">{setup.name}</p>
        <p className="mt-1 font-mono text-[11px] text-[var(--text-secondary)]">
          {setup.bias} • {setup.timeframe} • Grade: {setup.grade}
        </p>
        {((setup.confirmingFactors ?? []).length > 0 || (setup.riskFactors ?? []).length > 0) && (
          <ul className="mt-2 space-y-1">
            {(setup.confirmingFactors ?? []).map((f, i) => (
              <li key={i} className="font-mono text-[11px] text-[var(--signal-long)]">✓ {f}</li>
            ))}
            {(setup.riskFactors ?? []).map((f, i) => (
              <li key={i} className="font-mono text-[11px] text-[var(--signal-short)]">⚠ {f}</li>
            ))}
          </ul>
        )}
      </>
    }>
      <span
        className={cn(
          "inline-flex max-w-full cursor-default items-center truncate rounded border px-2 py-0.5 font-mono text-[11px] tracking-[0.08em]",
          isLong
            ? "border-[var(--signal-long)]/40 bg-[var(--signal-long-muted)] text-[var(--signal-long)]"
            : "border-[var(--signal-short)]/40 bg-[var(--signal-short-muted)] text-[var(--signal-short)]"
        )}
        title={setup.name}
      >
        {isAplus && <span className="mr-1 text-[var(--grade-aplus)]">●</span>}
        {setup.name}
      </span>
    </Tooltip>
  );
});
