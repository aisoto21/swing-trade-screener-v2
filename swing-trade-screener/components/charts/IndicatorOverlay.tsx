"use client";

import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import type { OHLCVBar } from "@/types";

interface IndicatorOverlayProps {
  data: OHLCVBar[];
  indicators: {
    sma50?: number[];
    sma200?: number[];
    ema9?: number[];
    vwap?: number[];
    bbUpper?: number[];
    bbMiddle?: number[];
    bbLower?: number[];
    rsi?: number[];
  };
  height?: number;
}

export function IndicatorOverlay({
  data,
  indicators,
  height = 300,
}: IndicatorOverlayProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    const chart = createChart(chartRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      width: chartRef.current.clientWidth,
      height,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#374151",
      },
    });

    const baseTime = (i: number) =>
      (new Date(data[i]?.date ?? 0).getTime() / 1000) as unknown as string;

    if (indicators.sma50?.length) {
      const series = chart.addLineSeries({ color: "#3b82f6", lineWidth: 2 });
      series.setData(
        indicators.sma50.map((v, i) => ({
          time: baseTime(i),
          value: v,
        })).filter((d) => !isNaN(d.value))
      );
    }
    if (indicators.sma200?.length) {
      const series = chart.addLineSeries({ color: "#8b5cf6", lineWidth: 2 });
      series.setData(
        indicators.sma200.map((v, i) => ({
          time: baseTime(i),
          value: v,
        })).filter((d) => !isNaN(d.value))
      );
    }
    if (indicators.ema9?.length) {
      const series = chart.addLineSeries({ color: "#f59e0b", lineWidth: 1 });
      series.setData(
        indicators.ema9.map((v, i) => ({
          time: baseTime(i),
          value: v,
        })).filter((d) => !isNaN(d.value))
      );
    }
    if (indicators.vwap?.length) {
      const series = chart.addLineSeries({ color: "#06b6d4", lineWidth: 1 });
      series.setData(
        indicators.vwap.map((v, i) => ({
          time: baseTime(i),
          value: v,
        })).filter((d) => !isNaN(d.value))
      );
    }
    if (indicators.bbUpper?.length) {
      const upper = chart.addLineSeries({ color: "rgba(139, 92, 246, 0.5)", lineWidth: 1 });
      upper.setData(
        indicators.bbUpper.map((v, i) => ({
          time: baseTime(i),
          value: v,
        })).filter((d) => !isNaN(d.value))
      );
      const lower = chart.addLineSeries({ color: "rgba(139, 92, 246, 0.5)", lineWidth: 1 });
      lower.setData(
        (indicators.bbLower ?? []).map((v, i) => ({
          time: baseTime(i),
          value: v,
        })).filter((d) => !isNaN(d.value))
      );
    }

    const handleResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data, indicators, height]);

  return <div ref={chartRef} />;
}
