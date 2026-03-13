"use client";

import { getMarketStatus } from "@/lib/utils/marketHours";

interface MarketStatusBarProps {
  spyPrice?: number;
  spyChange?: number;
  qqqPrice?: number;
  qqqChange?: number;
  vixPrice?: number;
  vixChange?: number;
}

export function MarketStatusBar({
  spyPrice = 542.3,
  spyChange = 0.34,
  qqqPrice = 461.2,
  qqqChange = 0.51,
  vixPrice = 18.2,
  vixChange = -0.8,
}: MarketStatusBarProps) {
  const { status, label, timeStr } = getMarketStatus();

  return (
    <div className="sticky top-0 z-40 flex h-7 items-center justify-between border-b border-[var(--border-default)] bg-[var(--background-surface)] px-4">
      <div className="flex items-center gap-6">
        <span
          className={`font-mono text-xs ${
            status === "open" ? "text-[var(--regime-bull)]" : "text-[var(--text-secondary)]"
          }`}
        >
          {status === "open" && <span className="animate-pulse-dot mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--regime-bull)]" />}
          {label}
        </span>
        <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
          SPY: ${spyPrice.toFixed(2)} ({spyChange >= 0 ? "+" : ""}{spyChange.toFixed(2)}%)
        </span>
        <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
          QQQ: ${qqqPrice.toFixed(2)} ({qqqChange >= 0 ? "+" : ""}{qqqChange.toFixed(2)}%)
        </span>
        <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
          VIX: {vixPrice.toFixed(1)} ({vixChange >= 0 ? "+" : ""}{vixChange.toFixed(1)})
        </span>
      </div>
      <a
        href="/"
        className="font-mono text-[13px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
      >
        EdgeScreen Pro
      </a>
      <a
        href="/settings"
        className="font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
      >
        Settings
      </a>
    </div>
  );
}
