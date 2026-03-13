import { create } from "zustand";
import type { MarketRegimeResult } from "@/types";

interface RegimeState {
  regime: MarketRegimeResult | null;
  lastUpdated: string | undefined;
  setRegime: (regime: MarketRegimeResult | null, lastUpdated?: string) => void;
  setLastUpdated: (s: string) => void;
}

export const useRegimeStore = create<RegimeState>((set) => ({
  regime: null,
  lastUpdated: undefined,
  setRegime: (regime, lastUpdated) =>
    set({
      regime,
      lastUpdated:
        lastUpdated ??
        new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/New_York",
        }) + " EST",
    }),
  setLastUpdated: (lastUpdated) => set({ lastUpdated }),
}));
