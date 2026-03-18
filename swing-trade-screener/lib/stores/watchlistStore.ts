import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ScreenType =
  | "Swing"
  | "Position"
  | "Quality Growth"
  | "Deep Value";

export interface WatchlistEntry {
  id: string;
  ticker: string;
  companyName: string;
  setupName: string;
  screenType: ScreenType;
  entryZoneLow: number;
  entryZoneHigh: number;
  plannedStop: number;
  plannedT1: number;
  note?: string;
  addedAt: string;
  alertOnEntry: boolean;
}

function generateId(): string {
  return (
    crypto.randomUUID?.() ??
    `wl-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export interface WatchlistState {
  entries: WatchlistEntry[];
  addEntry: (entry: Omit<WatchlistEntry, "id" | "addedAt">) => void;
  removeEntry: (id: string) => void;
  toggleAlert: (id: string) => void;
  isWatching: (ticker: string) => boolean;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (entry) =>
        set((state) => ({
          entries: [
            ...state.entries,
            {
              ...entry,
              id: generateId(),
              addedAt: new Date().toISOString(),
            },
          ],
        })),

      removeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        })),

      toggleAlert: (id) =>
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id ? { ...e, alertOnEntry: !e.alertOnEntry } : e
          ),
        })),

      isWatching: (ticker) =>
        get().entries.some(
          (e) => e.ticker.toUpperCase() === ticker.toUpperCase()
        ),
    }),
    { name: "edgescreen-watchlist" }
  )
);
