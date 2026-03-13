"use client";

import { useState, useEffect } from "react";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export default function SettingsPage() {
  const settings = useSettingsStore();
  const [saved, setSaved] = useState(false);
  const [optionsSource, setOptionsSource] = useState<string>("yahoo-finance2 (free)");
  const [optionsSectionOpen, setOptionsSectionOpen] = useState(false);

  useEffect(() => {
    fetch("/api/options/source")
      .then((r) => r.json())
      .then((d) => setOptionsSource(d.label ?? "yahoo-finance2 (free)"))
      .catch(() => {});
  }, []);

  const handleSave = () => {
    useSettingsStore.persist.rehydrate();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--background-base)] p-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/screener" className="mb-4 inline-block font-mono text-xs text-[var(--text-muted)] hover:text-[var(--signal-neutral)]">
          ← Back to Screener
        </Link>
        <h1 className="font-mono text-xl font-semibold text-[var(--text-primary)]">
          Settings
        </h1>

        <div className="mt-8 space-y-8">
          <section>
            <h2 className="mb-4 font-mono text-sm font-semibold text-[var(--text-secondary)]">
              RISK PARAMETERS
            </h2>
            <div className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Account size
                </label>
                <input
                  type="number"
                  value={settings.accountSize}
                  onChange={(e) =>
                    settings.update({ accountSize: parseInt(e.target.value) || 25000 })
                  }
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--background-base)] px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Risk per trade: {(settings.riskPerTrade * 100).toFixed(1)}%
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.1}
                  value={settings.riskPerTrade * 100}
                  onChange={(e) =>
                    settings.update({
                      riskPerTrade: parseFloat(e.target.value) / 100,
                    })
                  }
                  className="w-full accent-[var(--signal-neutral)]"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Max position size: {(settings.maxPositionSize * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min={3}
                  max={10}
                  step={1}
                  value={settings.maxPositionSize * 100}
                  onChange={(e) =>
                    settings.update({
                      maxPositionSize: parseInt(e.target.value) / 100,
                    })
                  }
                  className="w-full accent-[var(--signal-neutral)]"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 font-mono text-sm font-semibold text-[var(--text-secondary)]">
              SCREENING PREFERENCES
            </h2>
            <div className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Min price
                </label>
                <input
                  type="number"
                  value={settings.minPrice}
                  onChange={(e) =>
                    settings.update({ minPrice: parseInt(e.target.value) || 10 })
                  }
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--background-base)] px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Min volume
                </label>
                <input
                  type="number"
                  value={settings.minVolume}
                  onChange={(e) =>
                    settings.update({ minVolume: parseInt(e.target.value) || 500000 })
                  }
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--background-base)] px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Min R:R: {settings.minRR.toFixed(1)}
                </label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={settings.minRR}
                  onChange={(e) =>
                    settings.update({ minRR: parseFloat(e.target.value) })
                  }
                  className="w-full accent-[var(--signal-neutral)]"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Min grade
                </label>
                <select
                  value={settings.minGrade}
                  onChange={(e) => settings.update({ minGrade: e.target.value })}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--background-base)] px-3 py-2 font-mono text-sm"
                >
                  <option value="C">C (all)</option>
                  <option value="B">B</option>
                  <option value="A">A</option>
                  <option value="A+">A+</option>
                </select>
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.includeShortSetups}
                  onChange={(e) =>
                    settings.update({ includeShortSetups: e.target.checked })
                  }
                  className="rounded"
                />
                <span className="font-mono text-xs text-[var(--text-secondary)]">
                  Include short setups
                </span>
              </label>
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Regime override
                </label>
                <select
                  value={settings.regimeOverride ?? ""}
                  onChange={(e) =>
                    settings.update({
                      regimeOverride: e.target.value || null,
                    })
                  }
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--background-base)] px-3 py-2 font-mono text-sm"
                >
                  <option value="">None</option>
                  <option value="Bull Market">Bull</option>
                  <option value="Bear Market">Bear</option>
                  <option value="Choppy/Sideways">Choppy</option>
                </select>
              </div>
            </div>
          </section>

          <section>
            <button
              type="button"
              onClick={() => setOptionsSectionOpen((o) => !o)}
              className="mb-4 flex w-full items-center justify-between font-mono text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              OPTIONS ANALYSIS
              <span className="text-[var(--text-muted)]">{optionsSectionOpen ? "−" : "+"}</span>
            </button>
            {optionsSectionOpen && (
            <div className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.optionsEnabled}
                  onChange={(e) =>
                    settings.update({ optionsEnabled: e.target.checked })
                  }
                  className="rounded"
                />
                <span className="font-mono text-xs text-[var(--text-secondary)]">
                  Enable options analysis (requires OPTIONS_LAYER flag in config)
                </span>
              </label>
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Max premium per trade: {(settings.optionsMaxPremiumPct * 100).toFixed(1)}%
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={5}
                  step={0.5}
                  value={settings.optionsMaxPremiumPct * 100}
                  onChange={(e) =>
                    settings.update({
                      optionsMaxPremiumPct: parseFloat(e.target.value) / 100,
                    })
                  }
                  className="w-full accent-[var(--signal-neutral)]"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Only recommend when IVP below: {settings.optionsMinIVP}
                </label>
                <input
                  type="range"
                  min={30}
                  max={80}
                  step={5}
                  value={settings.optionsMinIVP}
                  onChange={(e) =>
                    settings.update({ optionsMinIVP: parseInt(e.target.value) })
                  }
                  className="w-full accent-[var(--signal-neutral)]"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Minimum open interest
                </label>
                <input
                  type="number"
                  value={settings.optionsMinOI}
                  onChange={(e) =>
                    settings.update({ optionsMinOI: parseInt(e.target.value) || 500 })
                  }
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--background-base)] px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Minimum DTE multiplier: {settings.optionsDTEMultiplier}x hold duration
                </label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.5}
                  value={settings.optionsDTEMultiplier}
                  onChange={(e) =>
                    settings.update({
                      optionsDTEMultiplier: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-[var(--signal-neutral)]"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.optionsAllowNaked}
                  onChange={(e) =>
                    settings.update({ optionsAllowNaked: e.target.checked })
                  }
                  className="rounded"
                />
                <span className="font-mono text-xs text-[var(--text-secondary)]">
                  Allow naked long calls/puts
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.optionsAllowSpreads}
                  onChange={(e) =>
                    settings.update({ optionsAllowSpreads: e.target.checked })
                  }
                  className="rounded"
                />
                <span className="font-mono text-xs text-[var(--text-secondary)]">
                  Allow debit spreads
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.optionsAllowPMCC}
                  onChange={(e) =>
                    settings.update({ optionsAllowPMCC: e.target.checked })
                  }
                  className="rounded"
                />
                <span className="font-mono text-xs text-[var(--text-secondary)]">
                  Allow PMCC (Poor Man&apos;s Covered Call)
                </span>
              </label>
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Data source
                </label>
                <p className="font-mono text-xs text-[var(--text-secondary)]">
                  {optionsSource}
                </p>
              </div>
            </div>
            )}
          </section>

          <section>
            <h2 className="mb-4 font-mono text-sm font-semibold text-[var(--text-secondary)]">
              DISPLAY
            </h2>
            <div className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--background-surface)] p-4">
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Theme
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => settings.update({ theme: "dark" })}
                    className={cn(
                      "rounded px-4 py-2 font-mono text-xs",
                      settings.theme === "dark"
                        ? "bg-[var(--signal-neutral)] text-white"
                        : "bg-[var(--background-subtle)] text-[var(--text-secondary)]"
                    )}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => settings.update({ theme: "light" })}
                    className={cn(
                      "rounded px-4 py-2 font-mono text-xs",
                      settings.theme === "light"
                        ? "bg-[var(--signal-neutral)] text-white"
                        : "bg-[var(--background-subtle)] text-[var(--text-secondary)]"
                    )}
                  >
                    Light
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Number format
                </label>
                <select
                  value={settings.numberFormat}
                  onChange={(e) =>
                    settings.update({
                      numberFormat: e.target.value as "US" | "EU",
                    })
                  }
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--background-base)] px-3 py-2 font-mono text-sm"
                >
                  <option value="US">US (1,234.56)</option>
                  <option value="EU">EU (1.234,56)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                  Timezone
                </label>
                <select
                  value={settings.timezone}
                  onChange={(e) => settings.update({ timezone: e.target.value })}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--background-base)] px-3 py-2 font-mono text-sm"
                >
                  <option value="America/New_York">Eastern (EST/EDT)</option>
                  <option value="America/Chicago">Central</option>
                  <option value="America/Denver">Mountain</option>
                  <option value="America/Los_Angeles">Pacific</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.emailAlerts}
                  onChange={(e) =>
                    settings.update({ emailAlerts: e.target.checked })
                  }
                  className="rounded"
                />
                <span className="font-mono text-xs text-[var(--text-secondary)]">
                  Email alerts for A+ setups
                </span>
              </label>
              {settings.emailAlerts && (
                <div>
                  <label className="mb-1 block font-mono text-xs text-[var(--text-muted)]">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={settings.emailAddress}
                    onChange={(e) =>
                      settings.update({ emailAddress: e.target.value })
                    }
                    placeholder="you@example.com"
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--background-base)] px-3 py-2 font-mono text-sm"
                  />
                </div>
              )}
            </div>
          </section>

          <button
            onClick={handleSave}
            className="w-full rounded bg-[var(--signal-neutral)] py-3 font-mono text-sm font-medium text-white transition-colors hover:brightness-110"
          >
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
