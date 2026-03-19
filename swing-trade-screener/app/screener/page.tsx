"use client";

import { useState, useCallback, useEffect } from "react";
import { FilterPanel } from "@/components/screener/FilterPanel";
import { ResultsTable } from "@/components/screener/ResultsTable";
import { TradeOfTheDay, getTradeOfTheDay } from "@/components/screener/TradeOfTheDay";
import { ScanProgress } from "@/components/screener/ScanProgress";
import { ScoringMethodologyModal } from "@/components/screener/ScoringMethodologyModal";
import { useFeature } from "@/lib/hooks/useFeature";
import type { ScreenerResult, ScreenerFilters, ContractRecommendation } from "@/types";
import { SCREENING_UNIVERSE } from "@/constants/universe";
import { useRegimeStore } from "@/lib/stores/regimeStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";

const DEFAULT_FILTERS: ScreenerFilters = {
  minPrice: 10,
  minVolume: 500000,
  minMarketCap: 300_000_000,
  biasFilter: "BOTH",
  minSetupGrade: "B",
  minRR: 1.5,
  accountSize: 25000,
  riskPerTrade: 0.01,
  includeBearishSetups: true,
  // New defaults — conservative: no RS filter out of the box
  minRSRating: 0,
  excludeEarningsRisk: false,
};

export default function ScreenerPage() {
  const [filters, setFilters] = useState<ScreenerFilters>(DEFAULT_FILTERS);
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const { setRegime, setBreadth, setLastUpdated } = useRegimeStore();
  const settings = useSettingsStore();
  const [isLoading, setIsLoading] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: SCREENING_UNIVERSE.length });
  const [failedCount, setFailedCount] = useState(0);
  const [scoringModalOpen, setScoringModalOpen] = useState(false);
  const [optionsMode, setOptionsMode] = useState<"Stocks" | "Options" | "Both">("Stocks");
  const [optionsRecommendations, setOptionsRecommendations] = useState<Record<string, ContractRecommendation | null>>({});
  const optionsLayer = useFeature("OPTIONS_LAYER");

  useEffect(() => {
    if (!optionsLayer || optionsMode === "Stocks" || results.length === 0) {
      setOptionsRecommendations({});
      return;
    }
    setOptionsRecommendations({});
    const tickers = results.slice(0, 20).map((r) => r.ticker);
    let cancelled = false;
    (async () => {
      for (const ticker of tickers) {
        if (cancelled) break;
        try {
          const result = results.find((r) => r.ticker === ticker);
          const res = await fetch("/api/options/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ticker,
              setupResult: result?.primarySetup,
              filters: {
                accountSize: filters.accountSize,
                riskPerTrade: filters.riskPerTrade,
                optionsMinIVP: settings.optionsMinIVP,
                optionsMinOI: settings.optionsMinOI,
                optionsDTEMultiplier: settings.optionsDTEMultiplier,
                optionsAllowNaked: settings.optionsAllowNaked,
                optionsAllowSpreads: settings.optionsAllowSpreads,
                optionsAllowPMCC: settings.optionsAllowPMCC,
              },
            }),
          });
          const data = await res.json();
          if (cancelled) break;
          if (data.disabled) continue;
          const rec: ContractRecommendation | null = data.error ? null : data;
          setOptionsRecommendations((prev) => ({ ...prev, [ticker]: rec }));
        } catch {
          if (!cancelled) setOptionsRecommendations((prev) => ({ ...prev, [ticker]: null }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [
    optionsLayer, optionsMode, results,
    filters.accountSize, filters.riskPerTrade,
    settings.optionsMinIVP, settings.optionsMinOI,
    settings.optionsDTEMultiplier, settings.optionsAllowNaked,
    settings.optionsAllowSpreads, settings.optionsAllowPMCC,
  ]);

  const runScreener = useCallback(async () => {
    setIsLoading(true);
    setResults([]);
    setFailedCount(0);
    setRegime(null);
    setBreadth(null);

    try {
      const res = await fetch("/api/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      });

      if (!res.ok) throw new Error("Scan failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              if (msg.type === "regime") setRegime(msg.data);
              else if (msg.type === "breadth") setBreadth(msg.data);
              else if (msg.type === "progress") setProgress(msg.data);
              else if (msg.type === "result") {
                const screenResult = msg.data?.result ?? msg.data;
                if (screenResult?.primarySetup) {
                  setResults((r) => [...r, screenResult]);
                }
              } else if (msg.type === "done") {
                const now = new Date();
                setLastScan(now);
                setLastUpdated(
                  now.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "America/New_York",
                  }) + " EST"
                );
              } else if (msg.type === "error") throw new Error(msg.data?.message);
            } catch {
              // skip parse errors
            }
          }
        }
      }

      setProgress({ current: SCREENING_UNIVERSE.length, total: SCREENING_UNIVERSE.length });
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters, setRegime, setBreadth, setLastUpdated]);

  const exportCSV = useCallback(() => {
    if (results.length === 0) return;
    const headers = [
      "Ticker", "Company", "Price", "Change%", "Setup", "Grade", "Bias",
      "RS Rating", "RS Classification", "Earnings Days", "Earnings Risk",
      "ATR %", "Stop ATR Multiple",
      "Entry Low", "Entry High", "Stop", "T1", "T2", "T3",
      "R:R", "Hold", "Rating",
    ];
    const rows = results.map((r) => [
      r.ticker,
      r.companyName,
      r.price,
      r.priceChangePercent,
      r.primarySetup.name,
      r.primarySetup.grade,
      r.primarySetup.bias,
      r.rsAnalysis?.rating?.toFixed(1) ?? "",
      r.rsAnalysis?.classification ?? "",
      r.earningsData?.daysToEarnings ?? "",
      r.earningsData?.riskLevel ?? "",
      r.atrData?.atrPercent?.toFixed(2) ?? "",
      r.primarySetup.tradeParams.stop.atrMultiple?.toFixed(2) ?? "",
      r.primarySetup.tradeParams.entry.zone[0],
      r.primarySetup.tradeParams.entry.zone[1],
      r.primarySetup.tradeParams.stop.price,
      r.primarySetup.tradeParams.targets.t1.price,
      r.primarySetup.tradeParams.targets.t2.price,
      r.primarySetup.tradeParams.targets.t3.price,
      r.primarySetup.tradeParams.riskReward.toT1,
      r.primarySetup.tradeParams.holdDuration,
      r.primarySetup.tradeParams.analystRating,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `edgescreen-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  // Improved TOTD — uses weighted composite score (see TradeOfTheDay.tsx)
  const tradeOfTheDay = getTradeOfTheDay(results);

  return (
    <div className="min-h-screen bg-[var(--background-base)]">
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-mono text-xl font-semibold text-[var(--text-primary)]">
            EdgeScreen Pro
          </h1>
          <button
            onClick={() => setScoringModalOpen(true)}
            className="font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          >
            How Setups Are Scored
          </button>
        </div>

        <TradeOfTheDay
          result={tradeOfTheDay}
        />

        {isLoading && (
          <ScanProgress
            current={progress.current}
            total={progress.total}
            estimatedSeconds={Math.ceil((progress.total - progress.current) * 0.18)}
          />
        )}

        <FilterPanel
          filters={filters}
          onFiltersChange={setFilters}
          onRun={runScreener}
          isLoading={isLoading}
          optionsMode={optionsMode}
          onOptionsModeChange={setOptionsMode}
        />

        {failedCount > 0 && (
          <div className="my-2 rounded border border-[var(--regime-choppy)] bg-[rgba(255,179,71,0.1)] px-4 py-2 font-mono text-xs text-[var(--regime-choppy)]">
            Data fetch failed for {failedCount} tickers — results may be incomplete
          </div>
        )}

        <ResultsTable
          results={results}
          onExportCSV={exportCSV}
          scanProgress={isLoading ? progress : undefined}
          isLoading={isLoading}
          optionsMode={optionsMode}
          optionsRecommendations={optionsRecommendations}
          regime={regime?.regime ?? null}
          onRelaxGrade={() => setFilters((f) => ({ ...f, minSetupGrade: "C" }))}
          onLowerRR={() => setFilters((f) => ({ ...f, minRR: 1.0 }))}
        />
      </div>

      <ScoringMethodologyModal open={scoringModalOpen} onOpenChange={setScoringModalOpen} />
    </div>
  );
}
