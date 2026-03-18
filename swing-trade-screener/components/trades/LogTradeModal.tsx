"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { TradeStrategy } from "@/lib/stores/tradeLogStore";
import type { DeepAnalysisResult } from "@/types";
import { formatCurrency } from "@/lib/utils/formatter";

const STRATEGIES: TradeStrategy[] = [
  "Swing",
  "Position",
  "Quality Growth",
  "Deep Value",
];

interface LogTradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis: DeepAnalysisResult | null;
  onLog: (trade: {
    ticker: string;
    companyName: string;
    bias: "LONG" | "SHORT";
    setupName: string;
    setupGrade: string;
    strategy: TradeStrategy;
    entryDate: string;
    entryPrice: number;
    shares: number;
    totalCost: number;
    plannedStop: number;
    plannedT1: number;
    plannedT2: number;
    plannedT3: number;
    plannedRR: number;
    plannedHoldDuration: string;
    sector?: string;
    marketRegime?: string;
    notes?: string;
  }) => void;
}

export function LogTradeModal({
  open,
  onOpenChange,
  analysis,
  onLog,
}: LogTradeModalProps) {
  const [entryPrice, setEntryPrice] = useState("");
  const [shares, setShares] = useState("");
  const [strategy, setStrategy] = useState<TradeStrategy>("Swing");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (analysis && open) {
      const t = analysis.primarySetup?.tradeParams;
      setEntryPrice(
        t
          ? String(
              ((t.entry.zone[0] + t.entry.zone[1]) / 2).toFixed(2)
            )
          : String(analysis.price.toFixed(2))
      );
      setShares(t ? String(t.positionSizing.maxShares) : "");
      setStrategy("Swing");
      setNotes("");
    }
  }, [analysis, open]);

  if (!analysis) return null;

  const t = analysis.primarySetup?.tradeParams;
  const entryNum = parseFloat(entryPrice) || analysis.price;
  const sharesNum = parseInt(shares, 10) || (t?.positionSizing.maxShares ?? 0);
  const totalCost = entryNum * sharesNum;

  const handleSubmit = () => {
    if (!t) return;
    onLog({
      ticker: analysis.ticker,
      companyName: analysis.companyName,
      bias: analysis.primarySetup.bias,
      setupName: analysis.primarySetup.name,
      setupGrade: analysis.primarySetup.grade,
      strategy,
      entryDate: new Date().toISOString().slice(0, 10),
      entryPrice: entryNum,
      shares: sharesNum,
      totalCost,
      plannedStop: t.stop.price,
      plannedT1: t.targets.t1.price,
      plannedT2: t.targets.t2.price,
      plannedT3: t.targets.t3.price,
      plannedRR: t.riskReward.toT1,
      plannedHoldDuration: t.holdDuration,
      sector: analysis.sector,
      marketRegime: analysis.marketRegime?.regime,
      notes: notes.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-lg">
            Log Trade — {analysis.ticker}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                Entry Price
              </label>
              <Input
                type="number"
                step="0.01"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                Shares
              </label>
              <Input
                type="number"
                min={1}
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
          </div>

          {t && (
            <div className="rounded border border-[var(--border-default)] bg-[var(--background-subtle)] p-3 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Stop</span>
                <span className="text-[var(--signal-short)]">
                  {formatCurrency(t.stop.price)}
                </span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-[var(--text-muted)]">T1 / T2 / T3</span>
                <span className="text-[var(--signal-long)]">
                  {formatCurrency(t.targets.t1.price)} /{" "}
                  {formatCurrency(t.targets.t2.price)} /{" "}
                  {formatCurrency(t.targets.t3.price)}
                </span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-[var(--text-muted)]">Total Cost</span>
                <span className="tabular-nums">
                  {formatCurrency(totalCost)}
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
              Strategy
            </label>
            <div className="flex flex-wrap gap-2">
              {STRATEGIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStrategy(s)}
                  className={`rounded border px-2 py-1 font-mono text-xs transition-colors ${
                    strategy === s
                      ? "border-[var(--signal-neutral)] bg-[var(--background-elevated)] text-[var(--text-primary)]"
                      : "border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              className="w-full rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-2 font-sans text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--signal-neutral)]"
            />
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-1.5 font-mono text-xs text-[var(--text-secondary)] hover:bg-[var(--background-subtle)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!t || sharesNum < 1}
            className="rounded bg-[var(--signal-neutral)] px-3 py-1.5 font-mono text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Log Trade
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
