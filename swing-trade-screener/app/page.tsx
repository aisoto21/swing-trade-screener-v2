import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background-base)] p-8">
      <div className="max-w-2xl space-y-6 text-center">
        <h1 className="font-mono text-4xl font-bold tracking-tight text-[var(--text-primary)]">EdgeScreen Pro</h1>
        <p className="text-lg text-[var(--text-secondary)]">
          Professional-grade swing trade stock screener. Identify high-conviction
          long and short setups across multiple timeframes using momentum, trend,
          and volume analysis.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/screener">
            <Button size="lg">Run Screener</Button>
          </Link>
          <Link href="/analysis/AAPL">
            <Button variant="outline" size="lg">
              Sample Analysis (AAPL)
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="outline" size="lg">
              Settings
            </Button>
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 text-left">
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
            <h3 className="mb-2 font-mono font-semibold text-[var(--text-primary)]">Multi-Timeframe</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Daily, 4H, and 15M analysis with 200+ indicators
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
            <h3 className="mb-2 font-mono font-semibold text-[var(--text-primary)]">Setup Detection</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Golden Cross, VWAP Reclaim, Fib Confluence, and more
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
            <h3 className="mb-2 font-mono font-semibold text-[var(--text-primary)]">Trade Parameters</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Entry zones, stops, targets, R:R, position sizing
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
            <h3 className="mb-2 font-mono font-semibold text-[var(--text-primary)]">Market Regime</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              SPY/QQQ-based regime detection for context
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
