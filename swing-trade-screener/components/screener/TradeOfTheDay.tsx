"use client";

import Link from "next/link";
import type { ScreenerResult } from "@/types";
import { SetupBadge } from "./SetupBadge";
import { GradeBadge } from "./GradeBadge";
import { RSBadge } from "./RSBadge";
import { EarningsBadge } from "./EarningsBadge";
import { formatCurrency, formatPercent } from "@/lib/utils/formatter";

interface TradeOfTheDayProps {
  result: ScreenerResult | null;
  accountSize?: number;
  riskPerTrade?: number;
}

/**
 * Improved Trade of the Day selection.
 *
 * Old logic: confirmingFactors.length + riskReward.toT1
 * Problem: A setup with 6 weak signals + 2.1 R:R beat a setup with 4 strong
 *          signals + 1.8 R:R. Grade was secondary. RS wasn't considered at all.
 *
 * New logic: weighted composite score
 *   - Grade:              A+ = 100, A = 75, B = 50, C = 25 (weight: 40%)
 *   - RS Rating:          0–100 (weight: 30%)
 *   - R:R to T1:          capped at 4:1, normalized to 0–100 (weight: 20%)
 *   - Confirming factors: count, capped at 6 (weight: 10%)
 *
 * Additionally, tickers with HIGH earnings risk are penalized.
 */
export function getTradeOfTheDay(results: ScreenerResult[]): ScreenerResult | null {
  const valid = results.filter(
    (r) => r?.primarySetup?.tradeParams?.riskReward?.toT1 != null
  );
  if (valid.length === 0) return null;

  const gradeScore: Record<string, number> = { "A+": 100, A: 75, B: 50, C: 25 };

  const scored = valid.map((r) => {
    const grade = gradeScore[r.primarySetup?.grade ?? "C"] ?? 25;
    const rs = r.rsAnalysis?.rating ?? 50;
    const rr = Math.min(4, r.primarySetup?.tradeParams?.riskReward?.toT1 ?? 1.5);
    const rrNorm = ((rr - 1.5) / 2.5) * 100; // 1.5:1 → 0, 4:1 → 100
    const factors = Math.min(6, r.primarySetup?.confirmingFactors?.length ?? 0);
    const factorsNorm = (factors / 6) * 100;

    const composite =
      grade * 0.4 +
      rs * 0.3 +
      rrNorm * 0.2 +
      factorsNorm * 0.1;

    // Penalize high earnings risk — don't want the TOTD to blow up on earnings
    const earningsPenalty = r.earningsData?.riskLevel === "HIGH" ? 25 : 0;

    return { result: r, score: composite - earningsPenalty };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.result ?? null;
}

export function TradeOfTheDay({
  result,
  accountSize = 25000,
  riskPerTrade = 0.01,
}: TradeOfTheDayProps) {
  if (!result?.primarySetup?.tradeParams) return null;

  const { primarySetup } = result;
  const t = primarySetup.tradeParams;
  const isLong = primarySetup.bias === "LONG";

  return (
    <Link href={`/analysis/${result.ticker}?accountSize=${accountSize}&riskPerTrade=${riskPerTrade}`}>
      <div
        className="group flex h-[140px] w-full items-center rounded-lg border border-[var(--border-default)] transition-all duration-100 hover:-translate-y-px hover:border-[var(--border-emphasis)]"
        style={{
          borderLeftWidth: 3,
          borderLeftColor: isLong ? "var(--signal-long)" : "var(--signal-short)",
          background: isLong
            ? "linear-gradient(to right, rgba(0, 208, 132, 0.06), transparent)"
            : "linear-gradient(to right, rgba(255, 77, 106, 0.06), transparent)",
        }}
      >
        {/* Left: ticker + setup */}
        <div className="flex w-[38%] flex-col gap-1 px-6">
          <span className="font-mono text-3xl font-semibold text-[var(--text-primary)]">
            {result.ticker}
          </span>
          <span className="text-[13px] text-[var(--text-secondary)]">
            {result.companyName}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <SetupBadge setup={primarySetup} />
            <GradeBadge grade={primarySetup.grade} />
            {/* New: Show RS and Earnings on TOTD */}
            {result.rsAnalysis && <RSBadge rs={result.rsAnalysis} />}
            {result.earningsData && <EarningsBadge earnings={result.earningsData} />}
          </div>
        </div>

        {/* Center: trade params */}
        <div className="flex w-[37%] items-center gap-6 border-x border-[var(--border-default)] px-6">
          <div>
            <p className="text-[11px] text-[var(--text-muted)]">Entry Zone</p>
            <p className="font-mono text-base tabular-nums text-[var(--text-primary)]">
              {formatCurrency(t.entry?.zone?.[0])} – {formatCurrency(t.entry?.zone?.[1])}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--text-muted)]">Stop Loss</p>
            <p className="font-mono text-base tabular-nums text-[var(--signal-short)]">
              {formatCurrency(t.stop?.price)}{" "}
              <span className="text-xs">
                ({t.stop?.atrMultiple ? `${t.stop.atrMultiple.toFixed(1)}× ATR` : formatPercent(t.stop?.riskPercent ?? 0)})
              </span>
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

        {/* Right: CTA */}
        <div className="flex w-[25%] flex-col items-end gap-2 px-6">
          <span className="rounded bg-[var(--signal-neutral)] px-4 py-2 font-mono text-xs font-medium text-white transition-colors hover:opacity-90">
            View Full Analysis →
          </span>
          <span className="text-xs text-[var(--text-secondary)]">
            {t.analystRating ?? "—"}
          </span>
          <span className="rounded-full bg-[var(--background-subtle)] px-3 py-1 font-mono text-[11px] text-[var(--text-secondary)]">
            {t.holdDuration ?? "—"}
          </span>
        </div>
      </div>
    </Link>
  );
}
