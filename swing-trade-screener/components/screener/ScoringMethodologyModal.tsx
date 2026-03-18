"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ScoringMethodologyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScoringMethodologyModal({
  open,
  onOpenChange,
}: ScoringMethodologyModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How EdgeScreen Pro Works</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-sm text-[var(--text-secondary)]">

          {/* ── Setup Grading ─────────────────────────────────────────── */}
          <div>
            <h4 className="mb-1 font-mono font-semibold text-[var(--text-primary)]">
              Setup Grade (A+ to C)
            </h4>
            <p>
              Setups are scored across three pillars — <strong className="text-[var(--text-primary)]">Momentum (35%)</strong>,{" "}
              <strong className="text-[var(--text-primary)]">Trend (35%)</strong>, and{" "}
              <strong className="text-[var(--text-primary)]">Volume (30%)</strong> — and only
              surfaced when R:R ≥ 1.5:1 to T1. Higher grade = more confluence across all
              three pillars.
            </p>
            <ul className="mt-2 space-y-0.5 font-mono text-xs text-[var(--text-muted)]">
              <li>Momentum: RSI levels, divergence, MACD crossovers, histogram direction</li>
              <li>Trend: Price vs 50/200 SMA, 9 EMA alignment, MA stack order</li>
              <li>Volume: vs 20-day average, OBV slope, directional context (see below)</li>
            </ul>
          </div>

          {/* ── RS Rating ─────────────────────────────────────────────── */}
          <div>
            <h4 className="mb-1 font-mono font-semibold text-[var(--text-primary)]">
              RS Rating (0–100) — Relative Strength vs. SPY
            </h4>
            <p>
              Measures how a stock is performing relative to the S&P 500 over the past year,
              weighted toward recent performance. A stock with RS 80+ is outperforming the
              market — institutions are rotating into it. A stock with RS below 40 is a laggard
              regardless of how good the chart looks.
            </p>
            <ul className="mt-2 space-y-0.5 font-mono text-xs">
              <li className="text-[var(--grade-aplus)]">85+ RS + trending ↑ = Leader — highest conviction</li>
              <li className="text-[var(--signal-long)]">70–85 RS = Outperformer — worth pursuing long setups</li>
              <li className="text-[var(--text-muted)]">45–70 RS = Neutral — market-rate performance</li>
              <li className="text-[var(--regime-choppy)]">25–45 RS = Laggard — be cautious on longs</li>
              <li className="text-[var(--signal-short)]">{"< 25 RS = Avoid — do not buy laggards"}</li>
            </ul>
            <p className="mt-2 text-[var(--text-muted)] text-xs">
              The ↑ arrow means short-term RS is accelerating vs. long-term — often a leading
              signal before price breaks out. ★ means RS line is at a 52-week high.
            </p>
          </div>

          {/* ── ATR Stop Validation ───────────────────────────────────── */}
          <div>
            <h4 className="mb-1 font-mono font-semibold text-[var(--text-primary)]">
              ATR / Stop — Average True Range Validation
            </h4>
            <p>
              ATR measures a stock's average daily price range over 14 days. Stops are
              validated against ATR to ensure they aren't so tight that normal intraday
              noise triggers them, or so wide that the risk becomes unacceptable.
            </p>
            <ul className="mt-2 space-y-0.5 font-mono text-xs">
              <li className="text-[var(--signal-short)]">{"< 0.5× ATR: Stop too tight — noise will stop you out"}</li>
              <li className="text-[var(--signal-long)]">0.5–2.5× ATR: Validated range ✓</li>
              <li className="text-[var(--regime-choppy)]">{"> 2.5× ATR: Stop too wide — risk exceeds acceptable range"}</li>
            </ul>
            <p className="mt-2 text-[var(--text-muted)] text-xs">
              Setups with invalid stops are filtered out before they reach the results table.
              Every stop you see has already passed ATR validation.
            </p>
          </div>

          {/* ── Anchored VWAP ─────────────────────────────────────────── */}
          <div>
            <h4 className="mb-1 font-mono font-semibold text-[var(--text-primary)]">
              Anchored VWAP (AVWAP)
            </h4>
            <p>
              VWAP (Volume Weighted Average Price) represents the average price paid, weighted
              by volume. Unlike standard VWAP which resets every session, Anchored VWAP is
              anchored to a meaningful price event — the most recent significant swing low
              (for long setups) or swing high (for short setups).
            </p>
            <p className="mt-1">
              This is the price level institutions use as a cost-basis reference. When price
              reclaims AVWAP from above, it signals institutional re-accumulation. When it
              fails at AVWAP, it suggests continued distribution.
            </p>
            <ul className="mt-2 space-y-0.5 font-mono text-xs text-[var(--text-muted)]">
              <li>AVWAP Reclaim = price recovering above the swing-low anchor (bullish)</li>
              <li>AVWAP Rejection = price failing at the swing-high anchor (bearish)</li>
              <li>"Above anchored VWAP" in signals = confirming factor for longs</li>
              <li>"Below anchored VWAP — cost basis headwind" = risk factor for longs</li>
            </ul>
          </div>

          {/* ── Earnings Risk ─────────────────────────────────────────── */}
          <div>
            <h4 className="mb-1 font-mono font-semibold text-[var(--text-primary)]">
              Earnings Risk
            </h4>
            <p>
              Earnings announcements can cause 5–15%+ overnight gaps that stop out even
              well-structured setups. The screener flags upcoming earnings so you can
              decide whether to size down, wait, or skip entirely.
            </p>
            <ul className="mt-2 space-y-0.5 font-mono text-xs">
              <li className="text-[var(--signal-short)]">HIGH (within 7 days): Consider waiting or skipping</li>
              <li className="text-[var(--regime-choppy)]">MODERATE (8–21 days): Factor into hold duration</li>
              <li className="text-[var(--text-muted)]">LOW (22+ days): Minimal impact on swing timeframe</li>
            </ul>
            <p className="mt-2 text-[var(--text-muted)] text-xs">
              Enable "No earnings risk" in the filter bar to exclude all tickers with
              earnings within 14 days from results. Requires Finnhub API key.
            </p>
          </div>

          {/* ── Directional Volume ────────────────────────────────────── */}
          <div>
            <h4 className="mb-1 font-mono font-semibold text-[var(--text-primary)]">
              Directional Volume Signals
            </h4>
            <p>
              Volume alone is not a signal — direction matters. The same 2× volume spike
              means completely different things depending on where price closed and where
              it is relative to support/resistance.
            </p>
            <ul className="mt-2 space-y-0.5 font-mono text-xs text-[var(--text-muted)]">
              <li><span className="text-[var(--signal-long)]">Breakout on high volume:</span> High vol + bullish close above resistance</li>
              <li><span className="text-[var(--signal-long)]">Institutional accumulation:</span> High vol + bullish close near support + rising OBV</li>
              <li><span className="text-[var(--signal-short)]">Distribution signal:</span> High vol + bearish close near resistance (smart money selling)</li>
              <li><span className="text-[var(--regime-choppy)]">Climactic / Exhaustion:</span> Volume {">"}2.5× average — potential reversal zone</li>
            </ul>
          </div>

          {/* ── Market Regime ─────────────────────────────────────────── */}
          <div>
            <h4 className="mb-1 font-mono font-semibold text-[var(--text-primary)]">
              Market Regime
            </h4>
            <p>
              The banner at the top reflects SPY's current condition based on its position
              relative to the 50 and 200 SMA and RSI. In a Choppy or Bear regime,
              short setups carry higher conviction and long setups carry more risk.
            </p>
            <ul className="mt-2 space-y-0.5 font-mono text-xs">
              <li className="text-[var(--regime-bull)]">Bull Market: SPY above 50 + 200 SMA, RSI {">"}50</li>
              <li className="text-[var(--signal-short)]">Bear Market: SPY below both SMAs, confirmed downtrend</li>
              <li className="text-[var(--regime-choppy)]">Choppy/Sideways: Mixed signals — reduce size, be selective</li>
              <li className="text-[var(--text-muted)]">Distribution / Accumulation: Transitional phases</li>
            </ul>
          </div>

        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
