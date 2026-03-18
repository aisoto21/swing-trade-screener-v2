import type { TradeEntry } from "@/lib/stores/tradeLogStore";

export interface PerformanceMetrics {
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  profitFactor: number;
  totalRealizedPL: number;
  totalRealizedPLPercent: number;
  largestWin: number;
  largestLoss: number;
  bySetup: Record<string, { trades: number; winRate: number; avgReturn: number }>;
  byGrade: Record<string, { trades: number; winRate: number; avgReturn: number }>;
  byStrategy: Record<string, { trades: number; winRate: number; avgReturn: number }>;
  avgHoldDays: number;
  winRateByHoldDuration: Record<string, number>;
  last10WinRate: number;
  last30DayReturn: number;
  avgRRActual: number;
  stopHitRate: number;
  t1HitRate: number;
}

export function computePerformanceMetrics(
  trades: TradeEntry[]
): PerformanceMetrics {
  const closed = trades.filter((t) => t.exitDate != null && t.realizedPL != null);
  const wins = closed.filter((t) => (t.realizedPL ?? 0) > 0);
  const losses = closed.filter((t) => (t.realizedPL ?? 0) < 0);

  const totalTrades = closed.length;
  const winRate = totalTrades > 0 ? wins.length / totalTrades : 0;
  const avgWin =
    wins.length > 0
      ? wins.reduce((s, t) => s + (t.realizedPLPercent ?? 0), 0) / wins.length
      : 0;
  const avgLoss =
    losses.length > 0
      ? losses.reduce((s, t) => s + (t.realizedPLPercent ?? 0), 0) /
        losses.length
      : 0;
  const lossRate = 1 - winRate;
  const expectancy = winRate * avgWin + lossRate * avgLoss;
  const totalGains = wins.reduce((s, t) => s + (t.realizedPL ?? 0), 0);
  const totalLosses = Math.abs(
    losses.reduce((s, t) => s + (t.realizedPL ?? 0), 0)
  );
  const profitFactor = totalLosses > 0 ? totalGains / totalLosses : 0;

  const totalRealizedPL = closed.reduce((s, t) => s + (t.realizedPL ?? 0), 0);
  const totalCost = closed.reduce((s, t) => s + t.totalCost, 0);
  const totalRealizedPLPercent =
    totalCost > 0 ? (totalRealizedPL / totalCost) * 100 : 0;

  const returns = closed.map((t) => t.realizedPLPercent ?? 0);
  const largestWin = returns.length > 0 ? Math.max(...returns, 0) : 0;
  const largestLoss = returns.length > 0 ? Math.min(...returns, 0) : 0;

  const bySetup: Record<string, { trades: number; winRate: number; avgReturn: number }> = {};
  const byGrade: Record<string, { trades: number; winRate: number; avgReturn: number }> = {};
  const byStrategy: Record<string, { trades: number; winRate: number; avgReturn: number }> = {};

  for (const t of closed) {
    const setup = t.setupName;
    const grade = t.setupGrade;
    const strategy = t.strategy;
    if (!bySetup[setup])
      bySetup[setup] = { trades: 0, winRate: 0, avgReturn: 0 };
    if (!byGrade[grade])
      byGrade[grade] = { trades: 0, winRate: 0, avgReturn: 0 };
    if (!byStrategy[strategy])
      byStrategy[strategy] = { trades: 0, winRate: 0, avgReturn: 0 };
    bySetup[setup].trades++;
    bySetup[setup].winRate += (t.realizedPL ?? 0) > 0 ? 1 : 0;
    bySetup[setup].avgReturn += t.realizedPLPercent ?? 0;
    byGrade[grade].trades++;
    byGrade[grade].winRate += (t.realizedPL ?? 0) > 0 ? 1 : 0;
    byGrade[grade].avgReturn += t.realizedPLPercent ?? 0;
    byStrategy[strategy].trades++;
    byStrategy[strategy].winRate += (t.realizedPL ?? 0) > 0 ? 1 : 0;
    byStrategy[strategy].avgReturn += t.realizedPLPercent ?? 0;
  }

  for (const k of Object.keys(bySetup)) {
    bySetup[k].winRate = bySetup[k].trades > 0 ? bySetup[k].winRate / bySetup[k].trades : 0;
    bySetup[k].avgReturn = bySetup[k].trades > 0 ? bySetup[k].avgReturn / bySetup[k].trades : 0;
  }
  for (const k of Object.keys(byGrade)) {
    byGrade[k].winRate = byGrade[k].trades > 0 ? byGrade[k].winRate / byGrade[k].trades : 0;
    byGrade[k].avgReturn = byGrade[k].trades > 0 ? byGrade[k].avgReturn / byGrade[k].trades : 0;
  }
  for (const k of Object.keys(byStrategy)) {
    byStrategy[k].winRate = byStrategy[k].trades > 0 ? byStrategy[k].winRate / byStrategy[k].trades : 0;
    byStrategy[k].avgReturn = byStrategy[k].trades > 0 ? byStrategy[k].avgReturn / byStrategy[k].trades : 0;
  }

  const avgHoldDays =
    closed.length > 0
      ? closed.reduce((s, t) => s + (t.holdDays ?? 0), 0) / closed.length
      : 0;

  const winRateByHoldDuration: Record<string, number> = {};
  const byHold = closed.reduce<Record<string, TradeEntry[]>>((acc, t) => {
    const h = t.plannedHoldDuration ?? "Swing";
    if (!acc[h]) acc[h] = [];
    acc[h].push(t);
    return acc;
  }, {});
  for (const [h, arr] of Object.entries(byHold)) {
    const w = arr.filter((t) => (t.realizedPL ?? 0) > 0).length;
    winRateByHoldDuration[h] = arr.length > 0 ? w / arr.length : 0;
  }

  const last10 = closed.slice(-10);
  const last10WinRate =
    last10.length > 0
      ? last10.filter((t) => (t.realizedPL ?? 0) > 0).length / last10.length
      : 0;

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const last30 = closed.filter(
    (t) => t.exitDate && new Date(t.exitDate).getTime() >= thirtyDaysAgo
  );
  const last30DayReturn = last30.reduce(
    (s, t) => s + (t.realizedPLPercent ?? 0),
    0
  );

  const stopHits = closed.filter((t) => t.exitReason === "Stop").length;
  const t1Hits = closed.filter((t) => t.exitReason === "T1").length;
  const stopHitRate = totalTrades > 0 ? stopHits / totalTrades : 0;
  const t1HitRate = totalTrades > 0 ? t1Hits / totalTrades : 0;

  const rrActual =
    closed.length > 0
      ? closed.reduce((s, t) => {
          const planned = t.plannedRR ?? 1.5;
          const actual =
            t.plannedStop && t.exitPrice
              ? Math.abs(t.exitPrice - (t.entryPrice + t.plannedStop) / 2) /
                Math.abs(t.entryPrice - t.plannedStop)
              : 0;
          return s + (actual / planned);
        }, 0) / closed.length
      : 0;

  return {
    totalTrades,
    winRate,
    avgWin,
    avgLoss,
    expectancy,
    profitFactor,
    totalRealizedPL,
    totalRealizedPLPercent,
    largestWin,
    largestLoss,
    bySetup,
    byGrade,
    byStrategy,
    avgHoldDays,
    winRateByHoldDuration,
    last10WinRate,
    last30DayReturn,
    avgRRActual: rrActual,
    stopHitRate,
    t1HitRate,
  };
}
