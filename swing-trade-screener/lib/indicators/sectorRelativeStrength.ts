import type { OHLCVBar, SectorRSResult } from "@/types";
import { fetchOHLCV } from "@/lib/dataFetcher";

export const SECTOR_ETFS: Record<string, string> = {
  Technology: "XLK",
  Healthcare: "XLV",
  "Financial Services": "XLF",
  "Consumer Cyclical": "XLY",
  "Consumer Defensive": "XLP",
  Energy: "XLE",
  Industrials: "XLI",
  Materials: "XLB",
  Utilities: "XLU",
  "Real Estate": "XLRE",
  "Communication Services": "XLC",
};

export type SectorName = keyof typeof SECTOR_ETFS;

const RS_LOOKBACK = 60;
const TREND_LOOKBACK = 10;

/**
 * Compute % return over a period
 */
function periodReturn(bars: OHLCVBar[], lookback: number): number {
  if (bars.length < lookback + 1) return 0;
  const start = bars[bars.length - lookback - 1]?.close ?? 0;
  const end = bars[bars.length - 1]?.close ?? 0;
  if (!start || start === 0) return 0;
  return ((end - start) / start) * 100;
}

/**
 * Compute sector RS vs SPY: (sector return - SPY return)
 * Positive = sector outperforming, negative = underperforming
 */
function computeRS(sectorBars: OHLCVBar[], spyBars: OHLCVBar[]): number {
  const sectorRet = periodReturn(sectorBars, RS_LOOKBACK);
  const spyRet = periodReturn(spyBars, RS_LOOKBACK);
  return sectorRet - spyRet;
}

/**
 * Determine trend: compare recent 10-day vs prior 50-day performance
 */
function computeTrend(
  sectorBars: OHLCVBar[],
  spyBars: OHLCVBar[]
): "improving" | "deteriorating" | "stable" {
  if (sectorBars.length < RS_LOOKBACK + 1 || spyBars.length < RS_LOOKBACK + 1) {
    return "stable";
  }
  const sectorRecent = periodReturn(sectorBars, TREND_LOOKBACK);
  const spyRecent = periodReturn(spyBars, TREND_LOOKBACK);
  const sectorPrior = periodReturn(
    sectorBars.slice(0, -TREND_LOOKBACK),
    RS_LOOKBACK - TREND_LOOKBACK
  );
  const spyPrior = periodReturn(
    spyBars.slice(0, -TREND_LOOKBACK),
    RS_LOOKBACK - TREND_LOOKBACK
  );
  const recentRS = sectorRecent - spyRecent;
  const priorRS = sectorPrior - spyPrior;
  const diff = recentRS - priorRS;
  if (diff > 1) return "improving";
  if (diff < -1) return "deteriorating";
  return "stable";
}

/**
 * Fetch sector ETF bars and SPY, compute RS for each sector, rank them.
 * Cache result for the scan session.
 */
let sectorCache: {
  results: SectorRSResult[];
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function computeSectorRanks(
  useMock: boolean = false
): Promise<SectorRSResult[]> {
  const now = Date.now();
  if (sectorCache && now - sectorCache.timestamp < CACHE_TTL_MS) {
    return sectorCache.results;
  }

  const etfs = Object.values(SECTOR_ETFS);
  const [spyBars, ...sectorBarsList] = await Promise.all([
    fetchOHLCV("SPY", "1D", useMock),
    ...etfs.map((etf) => fetchOHLCV(etf, "1D", useMock)),
  ]);

  if (spyBars.length < RS_LOOKBACK + 1) {
    return [];
  }

  const sectorNames = Object.keys(SECTOR_ETFS);
  const results: SectorRSResult[] = sectorNames.map((sector, i) => {
    const bars = sectorBarsList[i] ?? [];
    const etf = SECTOR_ETFS[sector] ?? "";
    const rs = bars.length >= RS_LOOKBACK + 1 ? computeRS(bars, spyBars) : 0;
    const trend = bars.length >= RS_LOOKBACK + 1 ? computeTrend(bars, spyBars) : "stable";
    return {
      sector,
      sectorETF: etf,
      sectorRS: rs,
      sectorRank: 0,
      sectorTrend: trend,
      isLeadingSector: false,
      isWeakSector: false,
    };
  });

  results.sort((a, b) => b.sectorRS - a.sectorRS);
  results.forEach((r, i) => {
    r.sectorRank = i + 1;
    r.isLeadingSector = i < 3;
    r.isWeakSector = i >= results.length - 3;
  });

  sectorCache = { results, timestamp: now };
  return results;
}

/**
 * Get SectorRSResult for a ticker's sector
 */
export function getSectorRSForTicker(
  sector: string,
  sectorRanks: SectorRSResult[]
): SectorRSResult | undefined {
  return sectorRanks.find(
    (r) => r.sector === sector || r.sector.toLowerCase() === sector.toLowerCase()
  );
}

/**
 * Clear cache (e.g. for testing)
 */
export function clearSectorCache(): void {
  sectorCache = null;
}
