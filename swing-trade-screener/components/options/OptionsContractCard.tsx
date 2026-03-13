"use client";

import { useFeature } from "@/lib/hooks/useFeature";
import type { ContractRecommendation } from "@/types";
import { formatCurrency } from "@/lib/utils/formatter";
import { cn } from "@/lib/utils/cn";

interface OptionsContractCardProps {
  recommendation: ContractRecommendation | null;
  underlyingPrice: number;
}

const STRUCTURE_LABELS: Record<string, string> = {
  long_call: "Long Call",
  long_put: "Long Put",
  bull_call_spread: "Bull Call Spread",
  bear_put_spread: "Bear Put Spread",
  pmcc: "PMCC",
  none: "None",
};

export function OptionsContractCard({
  recommendation,
  underlyingPrice,
}: OptionsContractCardProps) {
  const optionsEnabled = useFeature("OPTIONS_LAYER");
  if (!optionsEnabled) return null;
  if (!recommendation) return null;

  const { ivAnalysis, greeks, expectedMove } = recommendation;
  const moveToBE =
    ((recommendation.breakevenAtExpiration - underlyingPrice) / underlyingPrice) * 100;

  const ivpColor =
    ivAnalysis.ivPercentile < 30
      ? "text-[var(--signal-long)]"
      : ivAnalysis.ivPercentile > 60
      ? "text-[var(--signal-short)]"
      : "text-[var(--text-secondary)]";

  const ivTrendColor =
    ivAnalysis.ivTrend === "contracting"
      ? "text-[var(--signal-long)]"
      : ivAnalysis.ivTrend === "expanding"
      ? "text-[var(--regime-choppy)]"
      : "text-[var(--text-secondary)]";

  return (
    <div
      className="rounded-lg border-l-4 border-[var(--regime-choppy)] border-[var(--border-default)] bg-[var(--background-surface)] p-4"
      style={{ borderLeftColor: "var(--regime-choppy)" }}
    >
      <h3 className="mb-4 font-mono text-xs font-semibold text-[var(--text-secondary)]">
        OPTIONS RECOMMENDATION
      </h3>

      <div className="mb-4">
        <h4 className="mb-2 font-mono text-xs text-[var(--text-muted)]">
          IV Environment
        </h4>
        <div className="flex items-center gap-4">
          <div>
            <p className="font-mono text-2xl font-bold tabular-nums">
              <span className={ivpColor}>{ivAnalysis.ivPercentile.toFixed(0)}</span>
              <span className="text-sm font-normal text-[var(--text-muted)]">
                {ivAnalysis.historicalDaysAvailable < 252 ? " (30d)" : ""} IVP
              </span>
            </p>
          </div>
          <div>
            <p className={cn("font-mono text-xs", ivTrendColor)}>
              IV Trend: {ivAnalysis.ivTrend}
            </p>
            <p className="font-mono text-xs text-[var(--text-muted)]">
              IV vs HV: {ivAnalysis.ivVsHV}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="mb-2 font-mono text-xs text-[var(--text-muted)]">
          Recommended Structure
        </h4>
        <span className="inline-block rounded bg-[var(--signal-neutral-muted)] px-3 py-1 font-mono text-sm font-medium text-[var(--signal-neutral)]">
          {STRUCTURE_LABELS[recommendation.structure] ?? recommendation.structure}
        </span>
        <p className="mt-2 font-mono text-lg tabular-nums text-[var(--text-primary)]">
          {recommendation.ticker} {recommendation.longStrike}
          {recommendation.contractType === "call" ? "C" : "P"} {recommendation.expiration}
        </p>
        <p className="font-mono text-xs text-[var(--text-muted)]">
          {recommendation.dte} days to expiration
        </p>
        <p className="font-mono text-xs text-[var(--text-muted)]">
          {formatCurrency(recommendation.midPrice)} per contract
        </p>
      </div>

      <div className="mb-4">
        <h4 className="mb-2 font-mono text-xs text-[var(--text-muted)]">
          Position Details
        </h4>
        <div className="space-y-1 font-mono text-xs tabular-nums">
          <p>Contracts: {recommendation.contracts}</p>
          <p>Total premium: {formatCurrency(recommendation.totalPremium)}</p>
          <p>Max risk: {formatCurrency(recommendation.maxRisk)}</p>
          <p>Breakeven at expiration: {formatCurrency(recommendation.breakevenAtExpiration)}</p>
          <p>% move needed to breakeven: {moveToBE >= 0 ? "+" : ""}{moveToBE.toFixed(1)}%</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded bg-[var(--background-subtle)] p-2">
          <p className="font-mono text-[10px] text-[var(--text-muted)]">Delta</p>
          <p className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
            {greeks.delta.toFixed(2)} — moves ${greeks.delta.toFixed(2)} per $1
          </p>
        </div>
        <div className="rounded bg-[var(--background-subtle)] p-2">
          <p className="font-mono text-[10px] text-[var(--text-muted)]">Theta</p>
          <p className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
            ${greeks.theta.toFixed(0)}/day — daily time decay
          </p>
        </div>
        <div className="rounded bg-[var(--background-subtle)] p-2">
          <p className="font-mono text-[10px] text-[var(--text-muted)]">Vega</p>
          <p className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
            +${greeks.vega.toFixed(0)} — gain per 1% IV increase
          </p>
        </div>
        <div className="rounded bg-[var(--background-subtle)] p-2">
          <p className="font-mono text-[10px] text-[var(--text-muted)]">PoP</p>
          <p className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
            {greeks.probabilityOfProfit.toFixed(0)}% — probability of profit
          </p>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="mb-2 font-mono text-xs text-[var(--text-muted)]">
          Expected Move
        </h4>
        <p className="font-mono text-xs text-[var(--text-primary)]">
          Options market implies ±{formatCurrency(expectedMove.up)} (±{expectedMove.pct.toFixed(1)}%) over {recommendation.dte} days
        </p>
      </div>

      {recommendation.warnings.length > 0 && (
        <div className="mb-4 space-y-1">
          {recommendation.warnings.map((w, i) => (
            <p key={i} className="flex items-center gap-2 font-mono text-xs text-[var(--signal-short)]">
              <span>⚠</span> {w}
            </p>
          ))}
        </div>
      )}

      {recommendation.rationale.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 font-mono text-xs text-[var(--text-muted)]">
            Rationale
          </h4>
          <ul className="space-y-1">
            {recommendation.rationale.map((r, i) => (
              <li key={i} className="text-xs text-[var(--text-secondary)]">
                • {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendation.upgradeNote && (
        <div className="rounded border border-[var(--border-default)] bg-[var(--background-subtle)] px-3 py-2 font-mono text-[10px] text-[var(--text-muted)]">
          {recommendation.upgradeNote}
        </div>
      )}
    </div>
  );
}
