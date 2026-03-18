"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { TradeEntry } from "@/lib/stores/tradeLogStore";
import { formatCurrency } from "@/lib/utils/formatter";

const EXIT_REASONS: TradeEntry["exitReason"][] = [
  "T1",
  "T2",
  "T3",
  "Stop",
  "Manual",
  "Expired",
];

interface CloseTradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: TradeEntry | null;
  onClose: (
    id: string,
    exitPrice: number,
    exitReason: TradeEntry["exitReason"],
    notes?: string
  ) => void;
}

export function CloseTradeModal({
  open,
  onOpenChange,
  trade,
  onClose,
}: CloseTradeModalProps) {
  const [exitPrice, setExitPrice] = useState("");
  const [exitReason, setExitReason] = useState<TradeEntry["exitReason"]>("Manual");
  const [notes, setNotes] = useState("");

  if (!trade) return null;

  const exitPriceNum = parseFloat(exitPrice);
  const isValid = !Number.isNaN(exitPriceNum) && exitPriceNum > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    onClose(trade.id, exitPriceNum, exitReason, notes.trim() || undefined);
    setExitPrice("");
    setExitReason("Manual");
    setNotes("");
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setExitPrice("");
      setExitReason("Manual");
      setNotes("");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-lg">
            Close Trade — {trade.ticker}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded border border-[var(--border-default)] bg-[var(--background-subtle)] p-3 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Entry</span>
              <span>{formatCurrency(trade.entryPrice)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-[var(--text-muted)]">Stop</span>
              <span className="text-[var(--signal-short)]">
                {formatCurrency(trade.plannedStop)}
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-[var(--text-muted)]">T1</span>
              <span className="text-[var(--signal-long)]">
                {formatCurrency(trade.plannedT1)}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
              Exit Price
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder={formatCurrency(trade.plannedT1)}
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              className="font-mono tabular-nums"
            />
          </div>

          <div>
            <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
              Exit Reason
            </label>
            <div className="flex flex-wrap gap-2">
              {EXIT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setExitReason(r)}
                  className={`rounded border px-2 py-1 font-mono text-xs transition-colors ${
                    exitReason === r
                      ? "border-[var(--signal-neutral)] bg-[var(--background-elevated)] text-[var(--text-primary)]"
                      : "border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {r}
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
            onClick={() => handleOpenChange(false)}
            className="rounded border border-[var(--border-default)] bg-[var(--background-surface)] px-3 py-1.5 font-mono text-xs text-[var(--text-secondary)] hover:bg-[var(--background-subtle)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className="rounded bg-[var(--signal-short)] px-3 py-1.5 font-mono text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Close Trade
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
