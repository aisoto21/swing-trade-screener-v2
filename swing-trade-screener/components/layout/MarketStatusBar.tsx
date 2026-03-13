"use client";

import { useEffect, useState } from "react";
import { getMarketStatus } from "@/lib/utils/marketHours";

interface QuoteData {
  spyPrice: number;
  spyChange: number;
  qqqPrice: number;
  qqqChange: number;
  vixPrice: number;
  vixChange: number;
}

export function MarketStatusBar() {
  const { status, label } = getMarketStatus();
  const [quotes, setQuotes] = useState<QuoteData | null>(null);

  useEffect(() => {
    async function fetchQuotes() {
      try {
        const [spyRes, qqqRes, vixRes] = await Promise.all([
          fetch("/api/marketquote/SPY"),
          fetch("/api/marketquote/QQQ"),
          fetch("/api/marketquote/%5EVIX"),  // ^VIX URL-encoded
        ]);
        const [spy, qqq, vix] = await Promise.all([
          spyRes.json(),
          qqqRes.json(),
          vixRes.json(),
        ]);
        setQuotes({
          spyPrice: spy.price ?? 0,
          spyChange: spy.changePercent ?? 0,
          qqqPrice: qqq.price ?? 0,
          qqqChange: qqq.changePercent ?? 0,
          vixPrice: vix.price ?? 0,
          vixChange: vix.change ?? 0,
        });
      } catch {
        // silently fail
      }
    }

    fetchQuotes();
    const interval = setInterval(fetchQuotes, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fmt = (n: number, decimals = 2) => n.toFixed(decimals);
  const sign = (n: number) => (n >= 0 ? "+" : "");

  return (
    <div className="sticky top-0 z-40 flex h-7 items-center justify-between border-b border-[var(--border-default)] bg-[var(--background-surface)] px-4">
      <div className="flex items-center gap-6">
        <span
          className={`font-mono text-xs ${
            status === "open" ? "text-[var(--regime-bull)]" : "text-[var(--text-secondary)]"
          }`}
        >
          {status === "open" && (
            <span className="animate-pulse-dot mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--regime-bull)]" />
          )}
          {label}
        </span>
        {quotes ? (
          <>
            <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
              SPY: ${fmt(quotes.spyPrice)} ({sign(quotes.spyChange)}{fmt(quotes.spyChange)}%)
            </span>
            <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
              QQQ: ${fmt(quotes.qqqPrice)} ({sign(quotes.qqqChange)}{fmt(quotes.qqqChange)}%)
            </span>
            <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
              VIX: {fmt(quotes.vixPrice, 1)} ({sign(quotes.vixChange)}{fmt(quotes.vixChange, 1)})
            </span>
          </>
        ) : (
          <span className="font-mono text-xs text-[var(--text-muted)]">Loading quotes…</span>
        )}
      </div>
      <a href="/" className="font-mono text-[13px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
        EdgeScreen Pro
      </a>
      <a href="/settings" className="font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
        Settings
      </a>
    </div>
  );
}
