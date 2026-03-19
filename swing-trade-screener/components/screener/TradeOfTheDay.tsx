"use client";

import Link from "next/link";
import { useFeature } from "@/lib/hooks/useFeature";
import type { ScreenerResult } from "@/types";
import { SetupBadge } from "./SetupBadge";
import { cn } from "@/lib/utils/cn";
import { GradeBadge } from "./GradeBadge";
import { formatCurrency, formatPercent } from "@/lib/utils/formatter";

interface TradeOfTheDayProps {
  result: ScreenerResult | null;
}

export function getTradeOfTheDay(results: ScreenerResult[]): ScreenerResult | null {
  if (!results.length) return null;

  const scored = results
    .filter((r) => r.primarySetup?.tradeParams)
    .map((r) => {
      const setup = r.primarySetup;
      const t = setup.tradeParams;
      const gradeScore = { "A+": 4, A: 3, B: 2, C: 1 }[setup.grade] ?? 0;
      const rsScore = r.rsAnalysis?.rating ?? 50;
      const rrScore = t.riskReward?.toT1 ?? 0;
      const signalScore = setup.confirmingFactors?.length ?? 0;
      const earningsPenalty = r.earnings?.riskLevel === "HIGH" ? -25 : 0;

      const total =
        gradeScore * 10 +   // 40 pts max (grade)
        rsScore * 0.3 +     // 30 pts max (RS 0-100)
        rrScore * 5 +       // 20 pts max (R:R)
        signalScore * 2 +   // 10 pts (signals)
        earningsPenalty;

      return { result: r, score: total };
    });

  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  return scored[0].result;
}

export function TradeOfTheDay({ result }: TradeOfTheDayProps) {
  const wallStreetFeature = useFeature("WALL_STREET_CONSENSUS");
  if (!result?.primarySetup?.tradeParams) return null;

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
            {result.preMarketContext?.hasSignificantGap && (
              <span
                className={cn(
                  "rounded px-2 py-0.5 font-mono text-[10px] font-medium",
                  result.preMarketContext.gapDirection === "up" &&
                    "bg-[var(--signal-long)]/20 text-[var(--signal-long)]",
                  result.preMarketContext.gapDirection === "down" &&
                    "bg-[var(--signal-short)]/20 text-[var(--signal-short)]"
                )}
              >
                {result.preMarketContext.preMarketChange != null &&
                  (result.preMarketContext.preMarketChange >= 0 ? "+" : "")}
                {result.preMarketContext.preMarketChange?.toFixed(1)}% pre-mkt
              </span>
            )}
          </div>
        </div>

        <div className="flex w-[35%] items-center gap-6 border-x border-[var(--border-default)] px-6">
          <div>
            <p className="text-[11px] text-[var(--text-muted)]">Entry Zone</p>
            <p className="font-mono text-base tabular-nums text-[var(--text-primary)]">
              {formatCurrency(t.entry?.zone?.[0])} – {formatCurrency(t.entry?.zone?.[1])}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--text-muted)]">Stop Loss</p>
            <p className="font-mono text-base tabular-nums text-[var(--signal-short)]">
              {formatCurrency(t.stop?.price)} ({formatPercent(t.stop?.riskPercent ?? 0)})
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--text-muted)]">Target 1</p>
            <p className="font-mono text-base tabular-nums text-[var(--signal-long)]">
              {formatCurrency(t.targets?.t1?.price)}
            </p>
          </div>
          <p className="font-mono text-lg font-semibold tabular-nums text-[var(--signal-long)]">
            {(t.riskReward?.toT1 ?? 0).toFixed(1)}:1
          </p>
        </div>

        <div className="flex w-[25%] flex-col items-end gap-2 px-6">
          <span className="rounded bg-[var(--signal-neutral)] px-4 py-2 font-mono text-xs font-medium text-white transition-colors hover:opacity-90">
            View Full Analysis →
          </span>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] text-[var(--text-muted)]">EdgeScreen</span>
            <span className="text-xs text-[var(--text-secondary)]">
              {t.analystRating ?? "—"}
            </span>
            {wallStreetFeature && result.wallStreetConsensus && (
              <>
                <span className="mt-1 text-[10px] text-[var(--text-muted)]">Wall Street</span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {result.wallStreetConsensus.consensusLabel}
                  {result.wallStreetConsensus.totalAnalysts > 0 &&
                    ` (${result.wallStreetConsensus.totalAnalysts})`}
                </span>
                {result.wallStreetConsensus.upsideToMean != null && (
                  <span className="text-[10px] text-[var(--signal-long)]">
                    Mean target: {formatPercent(result.wallStreetConsensus.upsideToMean, true)}
                  </span>
                )}
                <span
                  className={cn(
                    "mt-0.5 rounded px-2 py-0.5 font-mono text-[10px]",
                    result.wallStreetConsensus.edgeScreenAgreement === "agrees" &&
                      "bg-[var(--signal-long)]/20 text-[var(--signal-long)]",
                    result.wallStreetConsensus.edgeScreenAgreement === "neutral" &&
                      "bg-[var(--regime-choppy)]/20 text-[var(--regime-choppy)]",
                    result.wallStreetConsensus.edgeScreenAgreement === "disagrees" &&
                      "bg-[var(--signal-short)]/20 text-[var(--signal-short)]"
                  )}
                >
                  {result.wallStreetConsensus.edgeScreenAgreement === "agrees" && "✓ ALIGNED"}
                  {result.wallStreetConsensus.edgeScreenAgreement === "neutral" && "⚠ DIVERGING"}
                  {result.wallStreetConsensus.edgeScreenAgreement === "disagrees" && "✗ OPPOSED"}
                </span>
              </>
            )}
          </div>
          <span className="rounded-full bg-[var(--background-subtle)] px-3 py-1 font-mono text-[11px] text-[var(--text-secondary)]">
            {t.holdDuration ?? "—"}
          </span>
        </div>
      </div>
    </Link>
  );
}
