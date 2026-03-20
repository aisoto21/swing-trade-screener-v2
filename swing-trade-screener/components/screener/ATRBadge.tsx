"use client";

import { memo } from "react";
import type { ATRData } from "@/types";
import { cn } from "@/lib/utils/cn";
import { Tooltip } from "@/components/ui/Tooltip";

interface ATRBadgeProps {
  atr: ATRData;
  stopAtrMultiple?: number;
  className?: string;
}

export const ATRBadge = memo(function ATRBadge({ atr, stopAtrMultiple, className }: ATRBadgeProps) {
  const isHighVol = atr.atrPercent > 4;
  const isLowVol = atr.atrPercent < 1;
  const volColor = isHighVol ? "text-[var(--regime-choppy)]" : isLowVol ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]";

  return (
    <Tooltip width={240} className={cn("inline-flex flex-col gap-0.5", className)} content={
      <>
        <p className="mb-1 font-mono text-xs font-semibold text-[var(--text-primary)]">Volatility Context (ATR 14)</p>
        <div className="space-y-1 font-mono text-[11px]">
          <div className="flex justify-between gap-4"><span className="text-[var(--text-muted)]">ATR (14-day)</span><span className="text-[var(--text-primary)]">${atr.current.toFixed(2)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-[var(--text-muted)]">ATR as % of price</span><span className={volColor}>{atr.atrPercent.toFixed(2)}%</span></div>
          {stopAtrMultiple !== undefined && (
            <div className="flex justify-between gap-4">
              <span className="text-[var(--text-muted)]">Stop distance</span>
              <span className={stopAtrMultiple < 0.8 ? "text-[var(--signal-short)]" : stopAtrMultiple > 2 ? "text-[var(--regime-choppy)]" : "text-[var(--signal-long)]"}>{stopAtrMultiple.toFixed(2)}× ATR</span>
            </div>
          )}
        </div>
        <div className="mt-2 space-y-0.5 text-[10px] text-[var(--text-muted)]">
          <p>{"< 0.5× ATR: Stop too tight (noise risk)"}</p>
          <p>0.5–2.5× ATR: Optimal range ✓</p>
          <p>{"> 2.5× ATR: Stop too wide (excess risk)"}</p>
        </div>
        {isHighVol && <p className="mt-1 text-[10px] text-[var(--regime-choppy)]">High volatility stock — use reduced position size.</p>}
      </>
    }>
      <span className="cursor-default">
        <span className={cn("font-mono text-xs tabular-nums", volColor)}>{atr.atrPercent.toFixed(1)}% ATR</span>
        {stopAtrMultiple !== undefined && (
          <span className="block font-mono text-[10px] text-[var(--text-muted)]">Stop: {stopAtrMultiple.toFixed(1)}×</span>
        )}
      </span>
    </Tooltip>
  );
});
