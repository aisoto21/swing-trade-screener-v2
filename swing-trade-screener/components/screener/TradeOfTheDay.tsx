"use client";

import Link from "next/link";
import type { ScreenerResult } from "@/types";
import { SetupBadge } from "./SetupBadge";
import { GradeBadge } from "./GradeBadge";
import { formatCurrency, formatPercent } from "@/lib/utils/formatter";

interface TradeOfTheDayProps {
  result: ScreenerResult | null;
}

export function TradeOfTheDay({ result }: TradeOfTheDayProps) {
  if (!result) return null;

  const { primarySetup } = result;
  const t = primarySetup.tradeParams;
  const isLong = primarySetup.bias === "LONG";

  return (
    <Link href={`/analysis/${result.ticker}`}>
      <div
        className={`group flex h-[140px] w-full items-center rounded-lg border border-[var(--border-default)] transition-all duration-100 hover:-translate-y-px hover:border-[var(--border-emphasis)]`}
        style={{
          borderLeftWidth: 3,
          borderLeftColor: isLong ? "var(--signal-long)" : "var(--signal-short)",
          background: isLong
            ? "linear-gradient(to right, rgba(0, 208, 132, 0.06), transparent)"
            : "linear-gradient(to right, rgba(255, 77, 106, 0.06), transparent)",
        }}
      >
        <div className="flex w-[40%] flex-col gap-1 px-6">
          <span className="font-mono text-3xl font-semibold text-[var(--text-primary)]">
            {result.ticker}
          </span>
          <span className="text-[13px] text-[var(--text-secondary)]">
            {result.companyName}
          </span>
          <div className="flex items-center gap-2">
            <SetupBadge setup={primarySetup} />
            <GradeBadge grade={primarySetup.grade} />
          </div>
        </div>

        <div className="flex w-[35%] items-center gap-6 border-x border-[var(--border-default)] px-6">
          <div>
            <p className="text-[11px] text-[var(--text-muted)]">Entry Zone</p>
            <p className="font-mono text-base tabular-nums text-[var(--text-primary)]">
              {formatCurrency(t.entry.zone[0])} – {formatCurrency(t.entry.zone[1])}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--text-muted)]">Stop Loss</p>
            <p className="font-mono text-base tabular-nums text-[var(--signal-short)]">
              {formatCurrency(t.stop.price)} ({formatPercent(t.stop.riskPercent)})
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--text-muted)]">Target 1</p>
            <p className="font-mono text-base tabular-nums text-[var(--signal-long)]">
              {formatCurrency(t.targets.t1.price)}
            </p>
          </div>
          <p className="font-mono text-lg font-semibold tabular-nums text-[var(--signal-long)]">
            {t.riskReward.toT1.toFixed(1)}:1
          </p>
        </div>

        <div className="flex w-[25%] flex-col items-end gap-2 px-6">
          <span className="rounded bg-[var(--signal-neutral)] px-4 py-2 font-mono text-xs font-medium text-white transition-colors hover:opacity-90">
            View Full Analysis →
          </span>
          <span className="text-xs text-[var(--text-secondary)]">
            {t.analystRating}
          </span>
          <span className="rounded-full bg-[var(--background-subtle)] px-3 py-1 font-mono text-[11px] text-[var(--text-secondary)]">
            {t.holdDuration}
          </span>
        </div>
      </div>
    </Link>
  );
}
