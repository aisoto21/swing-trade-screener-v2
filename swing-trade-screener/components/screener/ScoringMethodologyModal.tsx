"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ScoringMethodologyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScoringMethodologyModal({
  open,
  onOpenChange,
}: ScoringMethodologyModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How Setups Are Scored</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-[var(--text-secondary)]">
          <p>
            Setups are graded <strong className="text-[var(--text-primary)]">A+</strong> to{" "}
            <strong className="text-[var(--text-primary)]">C</strong> based on the number of
            confirming indicators across momentum, trend, and volume.
          </p>
          <div>
            <h4 className="mb-2 font-medium text-[var(--text-primary)]">Momentum (35%)</h4>
            <p>
              RSI overbought/oversold, divergence, MACD crossovers, histogram
              direction.
            </p>
          </div>
          <div>
            <h4 className="mb-2 font-medium text-[var(--text-primary)]">Trend (35%)</h4>
            <p>
              Price vs 50/200 SMA, 9 EMA alignment, Golden/Death cross, MA stack
              order.
            </p>
          </div>
          <div>
            <h4 className="mb-2 font-medium text-[var(--text-primary)]">Volume (30%)</h4>
            <p>
              Volume vs 20-day average (1.5x+ = institutional), volume trend,
              OBV slope.
            </p>
          </div>
          <p>
            Higher grade = more confluence. Only setups with R:R ≥ 1.5:1 to T1
            are surfaced. Market regime (Bull/Bear/Choppy) adjusts signal
            confidence.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
