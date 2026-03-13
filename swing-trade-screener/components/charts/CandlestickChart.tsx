"use client";

import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi } from "lightweight-charts";
import type { OHLCVBar } from "@/types";

interface CandlestickChartProps {
  data: OHLCVBar[];
  height?: number;
  showVolume?: boolean;
}

export function CandlestickChart({
  data,
  height = 400,
  showVolume = true,
}: CandlestickChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

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

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
    });

    const isDaily = data.length >= 2 && Math.abs(
      new Date(data[1].date).getTime() - new Date(data[0].date).getTime()
    ) >= 86400000;
    const formatted = data.map((b) => ({
      time: isDaily
        ? (new Date(b.date).toISOString().slice(0, 10) as string)
        : (new Date(b.date).getTime() / 1000 as number),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));

    candlestickSeries.setData(formatted);

    if (showVolume) {
      const volumeSeries = chart.addHistogramSeries({
        color: "#26a69a",
        priceFormat: { type: "volume" },
        priceScaleId: "",
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
        visible: false,
      });
      const volData = data.map((b, i) => ({
        time: formatted[i]?.time ?? (new Date(b.date).getTime() / 1000 as number),
        value: b.volume,
        color: b.close >= b.open ? "rgba(16, 185, 129, 0.5)" : "rgba(239, 68, 68, 0.5)",
      }));
      volumeSeries.setData(volData);
    }

    chartApiRef.current = chart;
    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartApiRef.current = null;
      seriesRef.current = null;
    };
  }, [data.length, height, showVolume]);

  useEffect(() => {
    if (!seriesRef.current || data.length === 0) return;
    const isDaily = (() => {
      const d1 = new Date(data[0].date).getTime();
      const d2 = new Date(data[Math.min(1, data.length - 1)].date).getTime();
      return Math.abs(d2 - d1) >= 86400000;
    })();
    const formatted = data.map((b) => ({
      time: isDaily
        ? (new Date(b.date).toISOString().slice(0, 10) as string)
        : (new Date(b.date).getTime() / 1000 as number),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    seriesRef.current.setData(formatted);
  }, [data]);

  return <div ref={chartRef} />;
}
