import { create } from "zustand";
import type { MarketRegimeResult } from "@/types";
import type { MarketBreadth } from "@/lib/utils/marketBreadth";

interface RegimeState {
  regime: MarketRegimeResult | null;
  breadth: MarketBreadth | null;
  lastUpdated: string | undefined;
  setRegime: (regime: MarketRegimeResult | null, lastUpdated?: string) => void;
  setBreadth: (breadth: MarketBreadth | null) => void;
  setLastUpdated: (s: string) => void;
}

export const useRegimeStore = create<RegimeState>((set) => ({
  regime: null,
  breadth: null,
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
  setBreadth: (breadth) => set({ breadth }),
  setLastUpdated: (lastUpdated) => set({ lastUpdated }),
}));
