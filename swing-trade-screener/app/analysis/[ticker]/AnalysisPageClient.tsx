"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MultiTimeframePanel } from "@/components/charts/MultiTimeframePanel";
import { SetupBadge } from "@/components/screener/SetupBadge";
import { GradeBadge } from "@/components/screener/GradeBadge";
import { RSBadge } from "@/components/screener/RSBadge";
import { EarningsBadge } from "@/components/screener/EarningsBadge";
import { ATRBadge } from "@/components/screener/ATRBadge";
import { OptionsContractCard } from "@/components/options/OptionsContractCard";
import { IVHistoryMiniChart } from "@/components/options/IVHistoryMiniChart";
import { useFeature } from "@/lib/hooks/useFeature";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { formatCurrency, formatPercent } from "@/lib/utils/formatter";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

async function fetchAnalysis(ticker: string, accountSize: number, riskPerTrade: number) {
  const params = new URLSearchParams({
    accountSize: accountSize.toString(),
    riskPerTrade: riskPerTrade.toString(),
  });
  const res = await fetch(`/api/quote/${ticker}?${params}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function fetchOptionsRecommendation(
  ticker: string,
  setupResult: unknown,
  filters: { accountSize?: number; riskPerTrade?: number }
) {
  const res = await fetch("/api/options/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, setupResult, filters }),
  });
  const data = await res.json();
  if (data.disabled || data.error) return null;
  return data;
}

export default function AnalysisPageClient({ ticker }: { ticker: string }) {
  const searchParams = useSearchParams();
  const accountSize = parseFloat(searchParams.get("accountSize") ?? "25000");
  const riskPerTrade = parseFloat(searchParams.get("riskPerTrade") ?? "0.01");

  const optionsLayer = useFeature("OPTIONS_LAYER");
  const settings = useSettingsStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ["analysis", ticker, accountSize, riskPerTrade],
    queryFn: () => fetchAnalysis(ticker, accountSize, riskPerTrade),
  });

  const { data: optionsRec } = useQuery({
    queryKey: ["options", ticker, data?.primarySetup],
    queryFn: () =>
      fetchOptionsRecommendation(ticker, data?.primarySetup, {
        accountSize,
        riskPerTrade,
        optionsMinIVP: settings.optionsMinIVP,
        optionsMinOI: settings.optionsMinOI,
        optionsDTEMultiplier: settings.optionsDTEMultiplier,
        optionsAllowNaked: settings.optionsAllowNaked,
        optionsAllowSpreads: settings.optionsAllowSpreads,
        optionsAllowPMCC: settings.optionsAllowPMCC,
      }),
    enabled: !!optionsLayer && !!data?.primarySetup,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background-base)]">
        <p className="font-mono text-sm text-[var(--text-muted)]">Loading analysis...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--background-base)]">
        <p className="font-mono text-sm text-[var(--signal-short)]">Failed to load analysis</p>
        <Link href="/screener" className="font-mono text-sm text-[var(--signal-neutral)] hover:underline">
          ← Back to Screener
        </Link>
      </div>
    );
  }

  const { primarySetup, rsAnalysis, earningsData, atrData } = data;
  const t = primarySetup.tradeParams;
  const isLong = primarySetup.bias === "LONG";

  const priceRange = t.targets.t3.price - t.stop.price;
  const entryPct = ((t.entry.zone[0] + t.entry.zone[1]) / 2 - t.stop.price) / priceRange;
  const currentPct = (data.price - t.stop.price) / priceRange;

  // RS classification context
  const rsClassColor = rsAnalysis
    ? rsAnalysis.classification === "Leader" ? "text-[var(--grade-aplus)]"
      : rsAnalysis.classification === "Outperformer" ? "text-[var(--signal-long)]"
      : rsAnalysis.classification === "Laggard" || rsAnalysis.classification === "Avoid"
        ? "text-[var(--signal-short)]"
      : "text-[var(--text-secondary)]"
    : "text-[var(--text-secondary)]";

  return (
    <div className="min-h-screen bg-[var(--background-base)]">
      <div className="flex flex-col lg:flex-row">

        {/* ── Chart panel ────────────────────────────────────────────────── */}
        <main className="w-full shrink-0 p-4 lg:w-[65%]">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded border border-[var(--border-default)] px-2 py-1 font-mono text-xs text-[var(--text-secondary)]">
              {data.marketRegime?.regime ?? "—"}
            </span>
            <SetupBadge setup={primarySetup} />
            {rsAnalysis && <RSBadge rs={rsAnalysis} />}
          </div>

          <div className="rounded-lg border border-[var(--border-default)] bg-[#0D0E11] p-4" style={{ minHeight: 420 }}>
            <MultiTimeframePanel
              daily={data.ohlcv["1D"]}
              fourHour={data.ohlcv["4H"]}
              fifteenMin={data.ohlcv["15M"]}
              indicators={data.indicators}
              overlayToggles={{
                sma50: true,
                sma200: true,
                ema9: true,
                vwap: true,
                bollingerBands: true,
              }}
            />
          </div>
        </main>

        {/* ── Side panel ─────────────────────────────────────────────────── */}
        <aside className="sticky top-[76px] h-fit w-full shrink-0 p-4 lg:w-[35%]">
          <div className="space-y-6">

            {/* Header */}
            <div>
              <Link href="/screener" className="mb-2 inline-block font-mono text-xs text-[var(--text-muted)] hover:text-[var(--signal-neutral)]">
                ← Back to Screener
              </Link>
              <div className="flex items-end justify-between">
                <div>
                  <h1 className="font-mono text-2xl font-bold text-[var(--text-primary)]">
                    {data.ticker}
                  </h1>
                  <p className="font-sans text-sm text-[var(--text-secondary)]">
                    {data.companyName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xl tabular-nums text-[var(--text-primary)]">
                    {formatCurrency(data.price)}
                  </p>
                  <p className={cn(
                    "font-mono text-sm tabular-nums",
                    data.priceChangePercent >= 0 ? "text-[var(--signal-long)]" : "text-[var(--signal-short)]"
                  )}>
                    {formatPercent(data.priceChangePercent, true)}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SetupBadge setup={primarySetup} />
                <GradeBadge grade={primarySetup.grade} />
                {earningsData && <EarningsBadge earnings={earningsData} />}
              </div>
              <div className={cn(
                "mt-2 inline-block rounded px-4 py-2 font-mono text-sm font-semibold",
                isLong ? "bg-[var(--signal-long-muted)] text-[var(--signal-long)]" : "bg-[var(--signal-short-muted)] text-[var(--signal-short)]"
              )}>
                {t.analystRating.toUpperCase()}
              </div>
            </div>

            {/* ── NEW: Relative Strength Panel ─────────────────────────── */}
            {rsAnalysis && (
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
                <h3 className="mb-3 font-mono text-xs font-semibold text-[var(--text-secondary)]">
                  RELATIVE STRENGTH VS. SPY
                </h3>
                <div className="flex items-start justify-between">
                  <div>
                    <p className={cn("font-mono text-2xl font-bold tabular-nums", rsClassColor)}>
                      {rsAnalysis.rating.toFixed(0)}
                      <span className="ml-1 text-sm font-normal text-[var(--text-muted)]">/ 100</span>
                    </p>
                    <p className={cn("font-mono text-xs font-medium mt-0.5", rsClassColor)}>
                      {rsAnalysis.classification}
                    </p>
                  </div>
                  <div className="space-y-1 text-right">
                    <div className="font-mono text-xs">
                      <span className="text-[var(--text-muted)]">63D RS: </span>
                      <span className={rsAnalysis.rs63 > 100 ? "text-[var(--signal-long)]" : "text-[var(--signal-short)]"}>
                        {rsAnalysis.rs63.toFixed(1)}
                      </span>
                    </div>
                    <div className="font-mono text-xs">
                      <span className="text-[var(--text-muted)]">252D RS: </span>
                      <span className={rsAnalysis.rs252 > 100 ? "text-[var(--signal-long)]" : "text-[var(--signal-short)]"}>
                        {rsAnalysis.rs252.toFixed(1)}
                      </span>
                    </div>
                    {rsAnalysis.trending && (
                      <p className="font-mono text-xs text-[var(--signal-long)]">↑ RS accelerating</p>
                    )}
                    {rsAnalysis.rsNewHigh && (
                      <p className="font-mono text-xs text-[var(--grade-aplus)]">★ RS new high</p>
                    )}
                  </div>
                </div>
                {/* RS bar */}
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--background-subtle)]">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      rsAnalysis.rating >= 70 ? "bg-[var(--signal-long)]"
                      : rsAnalysis.rating >= 45 ? "bg-[var(--regime-choppy)]"
                      : "bg-[var(--signal-short)]"
                    )}
                    style={{ width: `${rsAnalysis.rating}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--text-muted)]">
                  <span>Avoid</span>
                  <span>Neutral</span>
                  <span>Leader</span>
                </div>
              </div>
            )}

            {/* ── NEW: Earnings Risk Panel ──────────────────────────────── */}
            {earningsData && earningsData.daysToEarnings <= 45 && earningsData.riskLevel !== "UNKNOWN" && (
              <div className={cn(
                "rounded-lg border p-4",
                earningsData.riskLevel === "HIGH"
                  ? "border-[var(--signal-short)]/40 bg-[var(--signal-short-muted)]"
                  : earningsData.riskLevel === "MODERATE"
                  ? "border-[rgba(255,179,71,0.3)] bg-[rgba(255,179,71,0.06)]"
                  : "border-[var(--border-default)] bg-[var(--background-surface)]"
              )}>
                <h3 className="mb-3 font-mono text-xs font-semibold text-[var(--text-secondary)]">
                  EARNINGS RISK
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn(
                      "font-mono text-lg font-bold",
                      earningsData.riskLevel === "HIGH" ? "text-[var(--signal-short)]" : "text-[var(--regime-choppy)]"
                    )}>
                      {earningsData.daysToEarnings <= 0 ? "Today" : `${earningsData.daysToEarnings} days`}
                    </p>
                    <p className="font-mono text-xs text-[var(--text-muted)]">until earnings</p>
                  </div>
                  <div className="text-right">
                    {earningsData.nextEarningsDate && (
                      <p className="font-mono text-xs text-[var(--text-secondary)]">
                        {earningsData.nextEarningsDate}
                      </p>
                    )}
                    <p className={cn(
                      "font-mono text-xs font-semibold",
                      earningsData.riskLevel === "HIGH" ? "text-[var(--signal-short)]" : "text-[var(--regime-choppy)]"
                    )}>
                      {earningsData.riskLevel} RISK
                    </p>
                  </div>
                </div>
                {earningsData.riskLevel === "HIGH" && (
                  <p className="mt-2 font-sans text-xs text-[var(--signal-short)]">
                    ⚠ Consider waiting for post-earnings resolution or reducing position size significantly.
                  </p>
                )}
                {earningsData.riskLevel === "MODERATE" && (
                  <p className="mt-2 font-sans text-xs text-[var(--regime-choppy)]">
                    Earnings within 3 weeks. Factor into your hold duration and exit timing.
                  </p>
                )}
              </div>
            )}

            {/* ── NEW: ATR / Volatility Context Panel ──────────────────── */}
            {atrData && (
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
                <h3 className="mb-3 font-mono text-xs font-semibold text-[var(--text-secondary)]">
                  VOLATILITY CONTEXT (ATR 14)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="font-mono text-[10px] text-[var(--text-muted)]">Daily ATR</p>
                    <p className="font-mono text-base tabular-nums text-[var(--text-primary)]">
                      {formatCurrency(atrData.current)}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] text-[var(--text-muted)]">ATR % of Price</p>
                    <p className={cn(
                      "font-mono text-base tabular-nums",
                      atrData.atrPercent > 4 ? "text-[var(--regime-choppy)]"
                      : atrData.atrPercent < 1 ? "text-[var(--text-muted)]"
                      : "text-[var(--text-primary)]"
                    )}>
                      {atrData.atrPercent.toFixed(2)}%
                    </p>
                  </div>
                  {t.stop.atrMultiple !== undefined && (
                    <>
                      <div>
                        <p className="font-mono text-[10px] text-[var(--text-muted)]">Stop Distance</p>
                        <p className={cn(
                          "font-mono text-base tabular-nums",
                          t.stop.atrMultiple < 0.8 ? "text-[var(--signal-short)]"
                          : t.stop.atrMultiple > 2.5 ? "text-[var(--regime-choppy)]"
                          : "text-[var(--signal-long)]"
                        )}>
                          {t.stop.atrMultiple.toFixed(2)}× ATR
                        </p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] text-[var(--text-muted)]">Stop Quality</p>
                        <p className={cn(
                          "font-mono text-sm",
                          t.stop.atrMultiple >= 0.5 && t.stop.atrMultiple <= 2.5
                            ? "text-[var(--signal-long)]"
                            : "text-[var(--regime-choppy)]"
                        )}>
                          {t.stop.atrMultiple >= 0.5 && t.stop.atrMultiple <= 2.5
                            ? "✓ Validated"
                            : "⚠ Review"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <p className="mt-2 font-sans text-[10px] text-[var(--text-muted)]">
                  ATR-validated stops filter out setups that are too tight for normal price noise or too wide for acceptable risk.
                </p>
              </div>
            )}

            {/* Entry Zone */}
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
              <h3 className="mb-4 font-mono text-xs font-semibold text-[var(--text-secondary)]">ENTRY ZONE</h3>
              <p className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
                {formatCurrency(t.entry.zone[0])} – {formatCurrency(t.entry.zone[1])}
              </p>
              <p className="mt-2 font-sans text-xs text-[var(--text-muted)]">{t.entry.trigger}</p>
              <span className="mt-1 inline-block rounded bg-[var(--background-subtle)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                {t.entry.type}
              </span>
            </div>

            {/* Stop Loss */}
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
              <h3 className="mb-4 font-mono text-xs font-semibold text-[var(--text-secondary)]">STOP LOSS</h3>
              <p className="font-mono text-sm tabular-nums text-[var(--signal-short)]">
                {formatCurrency(t.stop.price)}
              </p>
              <p className="mt-1 font-mono text-xs tabular-nums text-[var(--text-muted)]">
                Risk: {formatCurrency((t.stop.riskPercent * (t.entry.zone[0] + t.entry.zone[1])) / 200)} ({formatPercent(t.stop.riskPercent)})
              </p>
              {t.stop.atrMultiple !== undefined && (
                <p className="font-mono text-xs text-[var(--text-muted)]">
                  {t.stop.atrMultiple.toFixed(2)}× ATR from entry
                </p>
              )}
              <p className="mt-1 font-sans text-xs text-[var(--text-muted)]">{t.stop.type}</p>
            </div>

            {/* Profit Targets */}
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
              <h3 className="mb-4 font-mono text-xs font-semibold text-[var(--text-secondary)]">PROFIT TARGETS</h3>
              <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-[var(--background-subtle)]">
                <div className="relative h-full">
                  <div className="absolute left-0 top-0 h-full bg-[var(--signal-short)]" style={{ width: `${entryPct * 100}%` }} />
                  <div className="absolute top-0 h-full bg-[var(--signal-long)]" style={{ left: `${entryPct * 100}%`, width: `${(1 - entryPct) * 100}%` }} />
                  <div className="absolute top-0 h-3 w-0.5 -translate-x-px bg-[var(--text-primary)]" style={{ left: `${Math.max(0, Math.min(1, currentPct)) * 100}%` }} />
                </div>
              </div>
              <div className="space-y-2">
                {(["t1", "t2", "t3"] as const).map((key, idx) => (
                  <div key={key} className="flex justify-between">
                    <span className="font-mono text-xs tabular-nums text-[var(--signal-long)]">
                      T{idx + 1}: {formatCurrency(t.targets[key].price)} ({formatPercent(t.targets[key].percentGain, true)})
                    </span>
                    <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                      R:R {t.riskReward[`toT${idx + 1}` as "toT1" | "toT2" | "toT3"].toFixed(1)}:1 — Take {t.targets[key].partialPercent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Position Sizing */}
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
              <h3 className="mb-4 font-mono text-xs font-semibold text-[var(--text-secondary)]">POSITION SIZING</h3>
              <div className="space-y-1 font-mono text-xs tabular-nums">
                <p>Max shares: {t.positionSizing.maxShares}</p>
                <p>Max exposure: {formatCurrency(t.positionSizing.maxDollarExposure)}</p>
                <p>Portfolio %: {(t.positionSizing.portfolioPercent * 100).toFixed(1)}%</p>
                <p className="text-[var(--text-muted)]">
                  Risk amount: {formatCurrency(accountSize * riskPerTrade)} ({(riskPerTrade * 100).toFixed(1)}% of {formatCurrency(accountSize)})
                </p>
                {t.positionSizing.concentrationWarning && (
                  <p className="text-[var(--regime-choppy)]">⚠ Concentration risk</p>
                )}
              </div>
            </div>

            <p className="font-mono text-xs text-[var(--text-secondary)]">Hold Duration: {t.holdDuration}</p>

            {/* Confirming Factors */}
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
              <h3 className="mb-2 font-mono text-xs font-semibold text-[var(--text-secondary)]">CONFIRMING FACTORS</h3>
              <ul className="space-y-1">
                {primarySetup.confirmingFactors.map((f: string, i: number) => (
                  <li key={i} className="flex items-center gap-2 font-sans text-xs text-[var(--signal-long)]">
                    <span>●</span> {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Risk Factors */}
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
              <h3 className="mb-2 font-mono text-xs font-semibold text-[var(--text-secondary)]">RISK FACTORS</h3>
              <ul className="space-y-1">
                {primarySetup.riskFactors.length === 0 ? (
                  <li className="font-sans text-xs text-[var(--text-muted)]">None identified</li>
                ) : (
                  primarySetup.riskFactors.map((f: string, i: number) => (
                    <li key={i} className="flex items-center gap-2 font-sans text-xs text-[var(--signal-short)]">
                      <span>⚠</span> {f}
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Options Layer */}
            {optionsLayer && (
              <>
                <OptionsContractCard recommendation={optionsRec ?? null} underlyingPrice={data.price} />
                <IVHistoryMiniChart ticker={ticker} currentIV={optionsRec?.ivAnalysis?.currentIV ?? 0} />
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
