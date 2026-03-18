import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TradeStatus = "open" | "closed" | "cancelled";

export type TradeStrategy =
  | "Swing"
  | "Position"
  | "Quality Growth"
  | "Deep Value";

export interface TradeEntry {
  id: string;
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

  exitDate?: string;
  exitPrice?: number;
  exitReason?: "T1" | "T2" | "T3" | "Stop" | "Manual" | "Expired";

  realizedPL?: number;
  realizedPLPercent?: number;
  holdDays?: number;
  maxFavorableExcursion?: number;
  maxAdverseExcursion?: number;

  marketRegime?: string;
  sector?: string;
  sectorRank?: number;
  rsRating?: number;
  notes?: string;
}

function generateId(): string {
  return crypto.randomUUID?.() ?? `trade-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface TradeLogState {
  trades: TradeEntry[];
  addTrade: (trade: Omit<TradeEntry, "id">) => void;
  closeTrade: (
    id: string,
    exitPrice: number,
    exitReason: TradeEntry["exitReason"],
    notes?: string
  ) => void;
  updateTrade: (id: string, updates: Partial<TradeEntry>) => void;
  deleteTrade: (id: string) => void;
  getOpenTrades: () => TradeEntry[];
  getClosedTrades: () => TradeEntry[];
  getTradesByStrategy: (strategy: TradeStrategy) => TradeEntry[];
}

export const useTradeLogStore = create<TradeLogState>()(
  persist(
    (set, get) => ({
      trades: [],

      addTrade: (trade) =>
        set((state) => ({
          trades: [
            ...state.trades,
            { ...trade, id: generateId() },
          ],
        })),

      closeTrade: (id, exitPrice, exitReason, notes) =>
        set((state) => {
          const trade = state.trades.find((t) => t.id === id);
          if (!trade) return state;
          const entryPrice = trade.entryPrice;
          const isLong = trade.bias === "LONG";
          const realizedPL =
            (exitPrice - entryPrice) * trade.shares * (isLong ? 1 : -1);
          const realizedPLPercent =
            ((exitPrice - entryPrice) / entryPrice) * 100 * (isLong ? 1 : -1);
          const exitDate = new Date().toISOString().slice(0, 10);
          const entryDate = new Date(trade.entryDate).getTime();
          const holdDays = Math.floor(
            (Date.now() - entryDate) / (24 * 60 * 60 * 1000)
          );
          return {
            trades: state.trades.map((t) =>
              t.id === id
                ? {
                    ...t,
                    exitDate,
                    exitPrice,
                    exitReason,
                    realizedPL,
                    realizedPLPercent,
                    holdDays,
                    notes: notes != null ? notes : t.notes,
                  }
                : t
            ),
          };
        }),

      updateTrade: (id, updates) =>
        set((state) => ({
          trades: state.trades.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

      deleteTrade: (id) =>
        set((state) => ({
          trades: state.trades.filter((t) => t.id !== id),
        })),

      getOpenTrades: () =>
        get().trades.filter(
          (t) => !t.exitDate && !t.exitPrice
        ),

      getClosedTrades: () =>
        get().trades.filter(
          (t) => t.exitDate != null && t.exitPrice != null
        ),

      getTradesByStrategy: (strategy) =>
        get().trades.filter((t) => t.strategy === strategy),
    }),
    { name: "edgescreen-trade-log" }
  )
);
