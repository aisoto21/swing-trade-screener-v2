/**
 * Unusual Options Activity detection
 */

import type { OptionsChain } from "@/types";

export interface UnusualActivityResult {
  unusualActivity: boolean;
  detail?: string;
}

export function detectUnusualActivity(chain: OptionsChain): UnusualActivityResult {
  const contracts = [...chain.calls, ...chain.puts];
  if (contracts.length === 0) return { unusualActivity: false };

  const avgVolume =
    contracts.reduce((s, c) => s + c.volume, 0) / contracts.length || 1;

  const unusual: Array<{ strike: number; type: string; volume: number; oi: number; mid: number }> = [];

  for (const c of contracts) {
    const volToOI = c.openInterest > 0 ? c.volume / c.openInterest : 0;
    const mid = (c.bid + c.ask) / 2 || c.last;

    if (c.volume > c.openInterest * 0.5 && c.volume > 1000) {
      unusual.push({
        strike: c.strike,
        type: c.type === "call" ? "C" : "P",
        volume: c.volume,
        oi: c.openInterest,
        mid,
      });
    } else if (c.volume > avgVolume * 5 && c.volume > 100) {
      unusual.push({
        strike: c.strike,
        type: c.type === "call" ? "C" : "P",
        volume: c.volume,
        oi: c.openInterest,
        mid,
      });
    }
  }

  if (unusual.length === 0) return { unusualActivity: false };

  unusual.sort((a, b) => b.volume * b.mid - a.volume * a.mid);

  const top = unusual[0];
  const notional = top.volume * 100 * top.mid;
  const ratio = top.oi > 0 ? (top.volume / top.oi).toFixed(1) : "—";

  return {
    unusualActivity: true,
    detail: `${top.volume.toLocaleString()} ${top.type === "C" ? "calls" : "puts"} at $${top.strike} strike (${ratio}x avg, $${(notional / 1000).toFixed(0)}k notional)`,
  };
}
