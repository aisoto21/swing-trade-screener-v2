/**
 * US market hours (Eastern)
 * Pre-market: 4:00 AM - 9:30 AM
 * Regular: 9:30 AM - 4:00 PM
 * After-hours: 4:00 PM - 8:00 PM
 */

export function getMarketStatus(): {
  status: "open" | "pre-market" | "after-hours" | "closed";
  label: string;
  timeStr: string;
} {
  const now = new Date();
  const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hours = est.getHours();
  const minutes = est.getMinutes();
  const day = est.getDay();
  const timeStr = est.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });

  const isWeekend = day === 0 || day === 6;
  const timeMins = hours * 60 + minutes;

  if (isWeekend) {
    return { status: "closed", label: "○ MARKET CLOSED", timeStr: `${timeStr} EST` };
  }

  if (timeMins >= 9 * 60 + 30 && timeMins < 16 * 60) {
    return { status: "open", label: "● MARKET OPEN", timeStr: `${timeStr} EST` };
  }
  if (timeMins >= 4 * 60 && timeMins < 9 * 60 + 30) {
    return { status: "pre-market", label: `○ PRE-MARKET ${timeStr}`, timeStr: `${timeStr} EST` };
  }
  if (timeMins >= 16 * 60 && timeMins < 20 * 60) {
    return { status: "after-hours", label: `○ AFTER-HOURS ${timeStr}`, timeStr: `${timeStr} EST` };
  }

  return { status: "closed", label: "○ MARKET CLOSED", timeStr: `${timeStr} EST` };
}
