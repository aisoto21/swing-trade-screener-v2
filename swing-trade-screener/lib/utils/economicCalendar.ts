import type { HoldDuration, EconomicEvent, EconomicRisk } from "@/types";

/**
 * Known economic events for 2025-2026.
 * Update quarterly. FOMC = Fed rate decision. NFP = Non-Farm Payrolls.
 * CPI/PPI/PCE = inflation releases.
 */
export const ECONOMIC_CALENDAR: EconomicEvent[] = [
  // 2025 FOMC
  { date: "2025-01-29", name: "FOMC Rate Decision", impact: "HIGH", description: "Federal Reserve interest rate decision" },
  { date: "2025-03-19", name: "FOMC Rate Decision", impact: "HIGH", description: "Federal Reserve interest rate decision" },
  { date: "2025-05-07", name: "FOMC Rate Decision", impact: "HIGH", description: "Federal Reserve interest rate decision" },
  { date: "2025-06-18", name: "FOMC Rate Decision", impact: "HIGH", description: "Federal Reserve interest rate decision" },
  { date: "2025-07-30", name: "FOMC Rate Decision", impact: "HIGH", description: "Federal Reserve interest rate decision" },
  { date: "2025-09-17", name: "FOMC Rate Decision", impact: "HIGH", description: "Federal Reserve interest rate decision" },
  { date: "2025-10-29", name: "FOMC Rate Decision", impact: "HIGH", description: "Federal Reserve interest rate decision" },
  { date: "2025-12-10", name: "FOMC Rate Decision", impact: "HIGH", description: "Federal Reserve interest rate decision" },
  // 2026 FOMC
  { date: "2026-01-28", name: "FOMC Rate Decision", impact: "HIGH", description: "Federal Reserve interest rate decision" },
  { date: "2026-03-18", name: "FOMC Rate Decision", impact: "HIGH", description: "Federal Reserve interest rate decision" },
  { date: "2026-04-29", name: "FOMC Rate Decision", impact: "HIGH", description: "Federal Reserve interest rate decision" },
  { date: "2026-06-17", name: "FOMC Rate Decision", impact: "HIGH", description: "Federal Reserve interest rate decision" },
  { date: "2026-07-29", name: "FOMC Rate Decision", impact: "HIGH", description: "Federal Reserve interest rate decision" },
  { date: "2026-09-16", name: "FOMC Rate Decision", impact: "HIGH", description: "Federal Reserve interest rate decision" },
  { date: "2026-10-28", name: "FOMC Rate Decision", impact: "HIGH", description: "Federal Reserve interest rate decision" },
  { date: "2026-12-09", name: "FOMC Rate Decision", impact: "HIGH", description: "Federal Reserve interest rate decision" },
  // 2025 NFP (first Friday of month)
  { date: "2025-01-03", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2025-02-07", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2025-03-07", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2025-04-04", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2025-05-02", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2025-06-06", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2025-07-04", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2025-08-01", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2025-09-05", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2025-10-03", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2025-11-07", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2025-12-05", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2026-01-02", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2026-02-06", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2026-03-06", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2026-04-03", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2026-05-01", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2026-06-05", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2026-07-03", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2026-08-07", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2026-09-04", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2026-10-02", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2026-11-06", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  { date: "2026-12-04", name: "Non-Farm Payrolls", impact: "HIGH", description: "Employment report" },
  // CPI (mid-month, approximate)
  { date: "2025-01-15", name: "CPI", impact: "HIGH", description: "Consumer Price Index" },
  { date: "2025-02-12", name: "CPI", impact: "HIGH", description: "Consumer Price Index" },
  { date: "2025-03-12", name: "CPI", impact: "HIGH", description: "Consumer Price Index" },
  { date: "2025-04-10", name: "CPI", impact: "HIGH", description: "Consumer Price Index" },
  { date: "2025-05-14", name: "CPI", impact: "HIGH", description: "Consumer Price Index" },
  { date: "2025-06-11", name: "CPI", impact: "HIGH", description: "Consumer Price Index" },
  { date: "2025-07-10", name: "CPI", impact: "HIGH", description: "Consumer Price Index" },
  { date: "2025-08-13", name: "CPI", impact: "HIGH", description: "Consumer Price Index" },
  { date: "2025-09-10", name: "CPI", impact: "HIGH", description: "Consumer Price Index" },
  { date: "2025-10-15", name: "CPI", impact: "HIGH", description: "Consumer Price Index" },
  { date: "2025-11-12", name: "CPI", impact: "HIGH", description: "Consumer Price Index" },
  { date: "2025-12-10", name: "CPI", impact: "HIGH", description: "Consumer Price Index" },
  { date: "2026-01-14", name: "CPI", impact: "HIGH", description: "Consumer Price Index" },
  { date: "2026-02-11", name: "CPI", impact: "HIGH", description: "Consumer Price Index" },
  { date: "2026-03-11", name: "CPI", impact: "HIGH", description: "Consumer Price Index" },
];

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function tradingDaysBetween(from: Date, to: Date): number {
  let count = 0;
  const d = new Date(from);
  while (d <= to) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/**
 * Hold duration to days (approximate)
 */
function holdDurationToDays(h: HoldDuration): number {
  switch (h) {
    case "Scalp":
      return 3;
    case "Short Swing":
      return 10;
    case "Swing":
      return 21;
    case "Extended Swing":
      return 56;
    default:
      return 21;
  }
}

/**
 * Find next HIGH impact event within the hold window.
 * HIGH: within 2 trading days
 * MODERATE: within 5 trading days
 * NONE: no major event within hold window
 */
export function checkEconomicRisk(holdDuration: HoldDuration): EconomicRisk {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowDays = holdDurationToDays(holdDuration);

  const highImpact = ECONOMIC_CALENDAR.filter((e) => e.impact === "HIGH");
  const futureEvents = highImpact
    .map((e) => ({ event: e, date: parseDate(e.date) }))
    .filter(({ date }) => date >= today)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const nextEvent = futureEvents[0];
  if (!nextEvent) {
    return {
      hasNearTermEvent: false,
      riskLevel: "NONE",
    };
  }

  const daysUntil = tradingDaysBetween(today, nextEvent.date);
  const hasNearTermEvent = daysUntil <= windowDays;

  let riskLevel: EconomicRisk["riskLevel"] = "NONE";
  if (daysUntil <= 2) riskLevel = "HIGH";
  else if (daysUntil <= 5) riskLevel = "MODERATE";

  return {
    hasNearTermEvent,
    nextEvent: nextEvent.event,
    daysUntilEvent: daysUntil,
    riskLevel,
  };
}
