"use client";

import { useQuery } from "@tanstack/react-query";
import { MultiTimeframePanel } from "@/components/charts/MultiTimeframePanel";
import { SetupBadge } from "@/components/screener/SetupBadge";
import { GradeBadge } from "@/components/screener/GradeBadge";
import { OptionsContractCard } from "@/components/options/OptionsContractCard";
import { IVHistoryMiniChart } from "@/components/options/IVHistoryMiniChart";
import { useFeature } from "@/lib/hooks/useFeature";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { formatCurrency, formatPercent } from "@/lib/utils/formatter";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

async function fetchAnalysis(ticker: string) {
  const res = await fetch(`/api/quote/${ticker}`);
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
  const optionsLayer = useFeature("OPTIONS_LAYER");
  const settings = useSettingsStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ["analysis", ticker],
    queryFn: () => fetchAnalysis(ticker),
  });

  const { data: optionsRec } = useQuery({
    queryKey: ["options", ticker, data?.primarySetup],
    queryFn: () =>
      fetchOptionsRecommendation(ticker, data?.primarySetup, {
        accountSize: settings.accountSize,
        riskPerTrade: settings.riskPerTrade,
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

  const { primarySetup } = data;
  const t = primarySetup.tradeParams;
  const isLong = primarySetup.bias === "LONG";

  const priceRange = t.targets.t3.price - t.stop.price;
  const entryPct = ((t.entry.zone[0] + t.entry.zone[1]) / 2 - t.stop.price) / priceRange;
  const currentPct = (data.price - t.stop.price) / priceRange;

  return (
    <div className="min-h-screen bg-[var(--background-base)]">
      <div className="flex flex-col lg:flex-row">
        <main className="w-full shrink-0 p-4 lg:w-[65%]">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded border border-[var(--border-default)] px-2 py-1 font-mono text-xs text-[var(--text-secondary)]">
              {data.marketRegime?.regime ?? "—"}
            </span>
            <SetupBadge setup={primarySetup} />
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

        <aside className="sticky top-[76px] h-fit w-full shrink-0 p-4 lg:w-[35%]">
          <div className="space-y-6">
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
                  <p
                    className={cn(
                      "font-mono text-sm tabular-nums",
                      data.priceChangePercent >= 0 ? "text-[var(--signal-long)]" : "text-[var(--signal-short)]"
                    )}
                  >
                    {formatPercent(data.priceChangePercent, true)}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <SetupBadge setup={primarySetup} />
                <GradeBadge grade={primarySetup.grade} />
              </div>
              <div
                className={cn(
                  "mt-2 inline-block rounded px-4 py-2 font-mono text-sm font-semibold",
                  isLong
                    ? "bg-[var(--signal-long-muted)] text-[var(--signal-long)]"
                    : "bg-[var(--signal-short-muted)] text-[var(--signal-short)]"
                )}
              >
                {t.analystRating.replace(" ", " ").toUpperCase()}
              </div>
            </div>

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

            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
              <h3 className="mb-4 font-mono text-xs font-semibold text-[var(--text-secondary)]">STOP LOSS</h3>
              <p className="font-mono text-sm tabular-nums text-[var(--signal-short)]">
                {formatCurrency(t.stop.price)}
              </p>
              <p className="mt-1 font-mono text-xs tabular-nums text-[var(--text-muted)]">
                Risk: {formatCurrency((t.stop.riskPercent * (t.entry.zone[0] + t.entry.zone[1])) / 200)} ({formatPercent(t.stop.riskPercent)})
              </p>
              <p className="mt-1 font-sans text-xs text-[var(--text-muted)]">{t.stop.type}</p>
            </div>

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
                <div className="flex justify-between">
                  <span className="font-mono text-xs tabular-nums text-[var(--signal-long)]">
                    T1: {formatCurrency(t.targets.t1.price)} ({formatPercent(t.targets.t1.percentGain, true)})
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                    R:R {t.riskReward.toT1.toFixed(1)}:1 — Take 50%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-xs tabular-nums text-[var(--signal-long)]">
                    T2: {formatCurrency(t.targets.t2.price)} ({formatPercent(t.targets.t2.percentGain, true)})
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                    R:R {t.riskReward.toT2.toFixed(1)}:1 — Take 30%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-xs tabular-nums text-[var(--signal-long)]">
                    T3: {formatCurrency(t.targets.t3.price)} ({formatPercent(t.targets.t3.percentGain, true)})
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                    R:R {t.riskReward.toT3.toFixed(1)}:1 — Let 20% run
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
              <h3 className="mb-4 font-mono text-xs font-semibold text-[var(--text-secondary)]">POSITION SIZING</h3>
              <div className="space-y-1 font-mono text-xs tabular-nums">
                <p>Max shares: {t.positionSizing.maxShares}</p>
                <p>Max exposure: {formatCurrency(t.positionSizing.maxDollarExposure)}</p>
                <p>Portfolio %: {(t.positionSizing.portfolioPercent * 100).toFixed(1)}%</p>
                <p className="text-[var(--text-muted)]">
                  Risk amount: {formatCurrency(25000 * 0.01)} (1% of $25,000)
                </p>
                {t.positionSizing.concentrationWarning && (
                  <p className="text-[var(--regime-choppy)]">⚠ Concentration risk</p>
                )}
              </div>
            </div>

            <p className="font-mono text-xs text-[var(--text-secondary)]">
              Hold Duration: {t.holdDuration}
            </p>

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
