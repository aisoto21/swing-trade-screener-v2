"use client";

import { useFeature } from "@/lib/hooks/useFeature";
import { cn } from "@/lib/utils/cn";

export type OptionsMode = "Stocks" | "Options" | "Both";

interface OptionsToggleProps {
  value: OptionsMode;
  onChange: (v: OptionsMode) => void;
}

export function OptionsToggle({ value, onChange }: OptionsToggleProps) {
  const optionsEnabled = useFeature("OPTIONS_LAYER");
  if (!optionsEnabled) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs text-[var(--text-muted)]">Mode</span>
      <div className="flex rounded border border-[var(--border-default)] bg-[var(--background-surface)] p-0.5">
        {(["Stocks", "Options", "Both"] as OptionsMode[]).map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              "rounded px-3 py-1.5 font-mono text-xs transition-colors",
              value === opt
                ? "border border-[var(--signal-neutral)] bg-[var(--background-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
