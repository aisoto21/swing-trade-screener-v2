import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SizingMethod } from "@/types";

export interface AppSettings {
  accountSize: number;
  riskPerTrade: number;
  sizingMethod: SizingMethod;
  maxPositionSize: number;
  minPrice: number;
  minVolume: number;
  minRR: number;
  minGrade: string;
  includeShortSetups: boolean;
  regimeOverride: string | null;
  theme: "dark" | "light";
  numberFormat: "US" | "EU";
  timezone: string;
  emailAlerts: boolean;
  emailAddress: string;
  optionsEnabled: boolean;
  optionsMaxPremiumPct: number;
  optionsMinIVP: number;
  optionsMinOI: number;
  optionsDTEMultiplier: number;
  optionsAllowNaked: boolean;
  optionsAllowSpreads: boolean;
  optionsAllowPMCC: boolean;
}

const DEFAULT: AppSettings = {
  accountSize: 25000,
  riskPerTrade: 0.01,
  sizingMethod: "fixed_risk",
  maxPositionSize: 0.05,
  minPrice: 10,
  minVolume: 500000,
  minRR: 1.5,
  minGrade: "C",
  includeShortSetups: true,
  regimeOverride: null,
  theme: "dark",
  numberFormat: "US",
  timezone: "America/New_York",
  emailAlerts: false,
  emailAddress: "",
  optionsEnabled: false,
  optionsMaxPremiumPct: 0.01,
  optionsMinIVP: 60,
  optionsMinOI: 500,
  optionsDTEMultiplier: 2,
  optionsAllowNaked: true,
  optionsAllowSpreads: true,
  optionsAllowPMCC: false,
};

interface SettingsState extends AppSettings {
  update: (partial: Partial<AppSettings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT,
      update: (partial) => set((s) => ({ ...s, ...partial })),
    }),
    { name: "edgescreen-settings" }
  )
);
