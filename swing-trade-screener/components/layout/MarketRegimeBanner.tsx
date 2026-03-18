"use client";

import type { MarketRegimeResult } from "@/types";
import type { MarketBreadth } from "@/lib/utils/marketBreadth";
import { cn } from "@/lib/utils/cn";

interface MarketRegimeBannerProps {
  regime: MarketRegimeResult | null;
  breadth?: MarketBreadth | null;
  lastUpdated?: string;
}

const REGIME_STYLES: Record<string, { color: string; bg: string; border: string; glow?: boolean }> = {
  "Bull Market": { color: "var(--regime-bull)", bg: "rgba(0, 208, 132, 0.04)", border: "rgba(0, 208, 132, 0.3)" },
  "Bear Market": { color: "var(--regime-bear)", bg: "rgba(255, 77, 106, 0.04)", border: "rgba(255, 77, 106, 0.3)", glow: true },
  "Choppy/Sideways": { color: "var(--regime-choppy)", bg: "rgba(255, 179, 71, 0.04)", border: "rgba(255, 179, 71, 0.3)" },
  "Distribution": { color: "var(--regime-distribution)", bg: "rgba(255, 77, 106, 0.04)", border: "rgba(255, 77, 106, 0.3)" },
  "Accumulation": { color: "var(--regime-accumulation)", bg: "rgba(0, 208, 132, 0.04)", border: "rgba(0, 208, 132, 0.3)" },
};

export function MarketRegimeBanner({ regime, breadth, lastUpdated }: MarketRegimeBannerProps) {
  const style = regime ? REGIME_STYLES[regime.regime] ?? REGIME_STYLES["Choppy/Sideways"] : REGIME_STYLES["Choppy/Sideways"];
  const label = regime?.regime ?? "CHOPPY";
  const isChoppy = label === "Choppy/Sideways" || label === "CHOPPY";

  const breadthColor =
    breadth != null
      ? breadth.percentAbove50SMA > 70
        ? "text-[var(--signal-long)]"
        : breadth.percentAbove50SMA >= 50
          ? "text-[var(--regime-choppy)]"
          : "text-[var(--regime-bear)]";

  return (
    <div
      className={cn(
        "sticky top-7 z-30 flex flex-col border-b transition-opacity duration-300",
        style.glow && "shadow-[0_0_20px_rgba(255,77,106,0.15)]"
      )}
      style={{
        background: style.bg,
        borderBottomColor: style.border,
      }}
    >
      <div className="flex h-12 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          {isChoppy && (
            <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
          <span
            className="font-mono text-[13px] font-medium tracking-[0.12em]"
            style={{ color: style.color }}
          >
            {label.replace(" ", " ").toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex gap-6">
            <div className="text-center">
              <p className="font-mono text-xs tabular-nums text-[var(--text-primary)]">SPY</p>
              <p className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                {regime?.spyAbove50SMA ? "↑50" : "↓50"} / {regime?.spyAbove200SMA ? "↑200" : "↓200"}
              </p>
            </div>
            <div className="text-center">
              <p className="font-mono text-xs tabular-nums text-[var(--text-primary)]">QQQ</p>
              <p className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                {regime?.spyAbove50SMA ? "↑50" : "↓50"} / {regime?.spyAbove200SMA ? "↑200" : "↓200"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-[var(--text-muted)]">
            Last updated: {lastUpdated ?? "—"}
          </span>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--signal-long)] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--signal-long)]" />
          </span>
        </div>
      </div>

      {breadth != null && (
        <div className={cn("flex h-8 items-center border-t px-6 font-mono text-xs", breadthColor)} style={{ borderTopColor: style.border }}>
          Breadth: {breadth.percentAbove50SMA.toFixed(0)}% above 50 SMA · {breadth.percentAbove200SMA.toFixed(0)}% above 200 SMA · NH/NL: {breadth.newHighsCount}/{breadth.newLowsCount}
        </div>
      )}
    </div>
  );
}
