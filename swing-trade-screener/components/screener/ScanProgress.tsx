"use client";

interface ScanProgressProps {
  current: number;
  total: number;
  currentTicker?: string;
  estimatedSeconds?: number;
  onCancel?: () => void;
}

export function ScanProgress({
  current,
  total,
  currentTicker,
  estimatedSeconds,
  onCancel,
}: ScanProgressProps) {
  const pct = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="flex h-7 items-center gap-4 border-b border-[var(--border-default)] bg-[var(--background-surface)] px-4">
      <div className="flex-1">
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-[var(--background-subtle)]">
          <div
            className="h-full bg-[var(--signal-neutral)] transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
        Scanning {current} / {total} tickers
      </span>
      {currentTicker && (
        <span className="font-mono text-[11px] text-[var(--text-muted)]">
          {currentTicker}...
        </span>
      )}
      {estimatedSeconds !== undefined && estimatedSeconds > 0 && (
        <span className="font-mono text-[11px] text-[var(--text-muted)]">
          ~{estimatedSeconds}s remaining
        </span>
      )}
      {onCancel && (
        <button
          onClick={onCancel}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--background-subtle)] hover:text-[var(--text-primary)]"
          aria-label="Cancel scan"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
