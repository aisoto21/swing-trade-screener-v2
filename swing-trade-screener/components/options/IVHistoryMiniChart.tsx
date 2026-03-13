"use client";

import { useFeature } from "@/lib/hooks/useFeature";
import { useEffect, useState } from "react";

interface IVHistoryMiniChartProps {
  ticker: string;
  currentIV: number;
  height?: number;
}

export function IVHistoryMiniChart({
  ticker,
  currentIV,
  height = 60,
}: IVHistoryMiniChartProps) {
  const optionsEnabled = useFeature("OPTIONS_LAYER");
  const [history, setHistory] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!optionsEnabled) return;
    fetch(`/api/options/iv-history?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((data) => {
        setHistory(data.values ?? []);
      })
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [optionsEnabled, ticker]);

  if (!optionsEnabled) return null;

  if (loading) {
    return (
      <div
        className="flex items-center justify-center rounded border border-[var(--border-default)] bg-[var(--background-surface)] font-mono text-xs text-[var(--text-muted)]"
        style={{ height }}
      >
        Building IV history...
      </div>
    );
  }

  if (history.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded border border-[var(--border-default)] bg-[var(--background-surface)] font-mono text-xs text-[var(--text-muted)]"
        style={{ height }}
      >
        Building IV history... ({history.length}/30 days)
      </div>
    );
  }

  const min = Math.min(...history, currentIV);
  const max = Math.max(...history, currentIV);
  const range = max - min || 1;
  const points = [...history, currentIV];
  const w = 100 / points.length;

  return (
    <div
      className="rounded border border-[var(--border-default)] bg-[var(--background-surface)] p-2"
      style={{ height }}
    >
      <svg width="100%" height={height - 16} viewBox="0 0 100 44" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="var(--signal-neutral)"
          strokeWidth="0.5"
          points={points
            .map((v, i) => `${i * w},${44 - ((v - min) / range) * 40}`)
            .join(" ")}
        />
      </svg>
    </div>
  );
}
