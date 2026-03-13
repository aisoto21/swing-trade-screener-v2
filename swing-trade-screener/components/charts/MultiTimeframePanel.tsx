"use client";

import { useState } from "react";
import { CandlestickChart } from "./CandlestickChart";
import { IndicatorOverlay } from "./IndicatorOverlay";
import type { OHLCVBar } from "@/types";
import type { Timeframe } from "@/types";

interface MultiTimeframePanelProps {
  daily: OHLCVBar[];
  fourHour: OHLCVBar[];
  fifteenMin: OHLCVBar[];
  indicators?: {
    daily?: Record<string, unknown>;
    fourHour?: Record<string, unknown>;
    fifteenMin?: Record<string, unknown>;
  };
  overlayToggles?: {
    sma50: boolean;
    sma200: boolean;
    ema9: boolean;
    vwap: boolean;
    bollingerBands: boolean;
  };
}

export function MultiTimeframePanel({
  daily,
  fourHour,
  fifteenMin,
  indicators = {},
  overlayToggles = {
    sma50: true,
    sma200: true,
    ema9: true,
    vwap: false,
    bollingerBands: false,
  },
}: MultiTimeframePanelProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");

  const data =
    timeframe === "1D" ? daily : timeframe === "4H" ? fourHour : fifteenMin;

  const ind = timeframe === "1D" ? indicators.daily : timeframe === "4H" ? indicators.fourHour : indicators.fifteenMin;
  const indObj = (ind ?? {}) as Record<string, unknown>;
  const bb = indObj.bollingerBands as { upper?: number[]; middle?: number[]; lower?: number[] } | undefined;

  const overlayIndicators = {
    sma50: overlayToggles.sma50 ? (indObj.sma50 as number[]) : undefined,
    sma200: overlayToggles.sma200 ? (indObj.sma200 as number[]) : undefined,
    ema9: overlayToggles.ema9 ? (indObj.ema9 as number[]) : undefined,
    vwap: overlayToggles.vwap ? (indObj.vwap as { values?: number[] })?.values : undefined,
    bbUpper: overlayToggles.bollingerBands ? bb?.upper : undefined,
    bbMiddle: overlayToggles.bollingerBands ? bb?.middle : undefined,
    bbLower: overlayToggles.bollingerBands ? bb?.lower : undefined,
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["1D", "4H", "15M"] as Timeframe[]).map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
              timeframe === tf
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <CandlestickChart data={data} height={400} showVolume />
      </div>

      {Object.values(overlayIndicators).some(Boolean) && (
        <div className="rounded-lg border bg-card p-4">
          <h4 className="mb-2 text-sm font-medium">Indicator Overlay</h4>
          <IndicatorOverlay
            data={data}
            indicators={overlayIndicators}
            height={200}
          />
        </div>
      )}
    </div>
  );
}
