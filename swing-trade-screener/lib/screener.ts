import type {
  OHLCVBar,
  ScreenerResult,
  ScreenerFilters,
  DeepAnalysisResult,
  MarketRegimeResult,
  ATRData,
} from "@/types";
import { SCREENING_UNIVERSE, UNIVERSE } from "@/constants/universe";
import {
  MIN_PRICE,
  MIN_AVG_VOLUME,
} from "@/constants/indicators";
import { fetchOHLCV } from "@/lib/dataFetcher";
import { sma50, sma200 } from "@/lib/indicators/sma";
import { ema9 } from "@/lib/indicators/ema";
import { rsiFull } from "@/lib/indicators/rsi";
import { macdFull } from "@/lib/indicators/macd";
import { sessionVWAP, vwapAnchored } from "@/lib/indicators/vwap"; // Updated import
import { bollingerBands } from "@/lib/indicators/bollingerBands";
import { fibonacci } from "@/lib/indicators/fibonacci";
import { supportResistance } from "@/lib/indicators/supportResistance";
import { detectCandlePatterns } from "@/lib/indicators/candlePatterns";
import { volumeAnalysis } from "@/lib/indicators/volumeAnalysis";
import { atr, currentATR, atrPercent } from "@/lib/indicators/atr";
import { computeRSAnalysis } from "@/lib/indicators/relativeStrength";
import { classifySetups } from "@/lib/scoring/tradeSetupClassifier";
import { detectMarketRegime } from "@/lib/utils/marketRegime";
import { getEarningsCalendar } from "@/lib/utils/finnhub";

function toOHLCV(bars: OHLCVBar[]): OHLCVBar[] {
  return bars;
}

/**
 * Fetch and cache SPY bars for RS computation.
 * Keyed per process to avoid redundant fetches across a screener run.
 */
let _spyBarsCache: OHLCVBar[] | null = null;
let _spyCacheTime = 0;

async function getSpyBars(useMock: boolean): Promise<OHLCVBar[]> {
  const now = Date.now();
  // Cache for 5 minutes to avoid re-fetching SPY for every ticker in a batch
  if (_spyBarsCache && now - _spyCacheTime < 300_000) return _spyBarsCache;
  _spyBarsCache = await fetchOHLCV("SPY", "1D", useMock);
  _spyCacheTime = now;
  return _spyBarsCache;
}

/**
 * Compute earnings risk for a ticker.
 * Gracefully degrades to UNKNOWN if Finnhub key is not set.
 */
async function computeEarningsData(ticker: string) {
  try {
    const earningsData = await getEarningsCalendar(ticker);
    if (!earningsData || earningsData.length === 0) {
      return {
        daysToEarnings: 999,
        nextEarningsDate: undefined,
        riskLevel: "UNKNOWN" as const,
        insideEarningsWindow: false,
      };
    }

    const next = earningsData[0];
    const daysToEarnings = Math.ceil(
      (new Date(next.period).getTime() - Date.now()) / 86400000
    );

    const riskLevel =
      daysToEarnings <= 7
        ? "HIGH"
        : daysToEarnings <= 21
        ? "MODERATE"
        : "LOW";

    return {
      daysToEarnings,
      nextEarningsDate: next.period,
      riskLevel: riskLevel as "HIGH" | "MODERATE" | "LOW",
      insideEarningsWindow: daysToEarnings <= 14,
    };
  } catch {
    return {
      daysToEarnings: 999,
      nextEarningsDate: undefined,
      riskLevel: "UNKNOWN" as const,
      insideEarningsWindow: false,
    };
  }
}

/**
 * Run full screening for a single ticker.
 */
export async function screenTicker(
  ticker: string,
  filters: ScreenerFilters,
  useMock: boolean = false
): Promise<ScreenerResult | null> {
  const stock = UNIVERSE.find((s) => s.ticker === ticker) ?? {
    ticker,
    companyName: ticker,
    sector: "Unknown",
    marketCapTier: "large" as const,
  };

  const [daily, fourHour, fifteenMin, spyBars] = await Promise.all([
    fetchOHLCV(ticker, "1D", useMock),
    fetchOHLCV(ticker, "4H", useMock),
    fetchOHLCV(ticker, "15M", useMock),
    getSpyBars(useMock),
  ]);

  if (daily.length < 50) return null;

  const price = daily[daily.length - 1]?.close ?? 0;
  const prevClose = daily[daily.length - 2]?.close ?? price;
  const priceChangePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

  // ── Volume pre-filter (using actual avg volume, not market cap hack) ──────
  const avgVolume20 =
    daily.slice(-20).reduce((s, b) => s + b.volume, 0) /
    Math.min(20, daily.length);

  if (price < filters.minPrice) return null;
  if (avgVolume20 < filters.minVolume) return null;

  // NOTE: Removed the broken `price * 1e9` market cap filter.
  // avgVolume is a better liquidity proxy for swing trading anyway.
  // Real market cap requires sharesOutstanding from the quote endpoint.
  // TODO: Pull sharesOutstanding from Yahoo quote API if market cap
  //       filtering is critical for your universe.

  // ── Indicators ────────────────────────────────────────────────────────────
  const sma50Daily = sma50(daily);
  const sma200Daily = sma200(daily);
  const ema9Daily = ema9(daily);
  const ema9_4H = ema9(fourHour);
  const ema9_15M = ema9(fifteenMin);
  const sma50_4H = sma50(fourHour.length >= 50 ? fourHour : daily);

  // VWAP: use anchored VWAP for daily, session VWAP for intraday
  const avwapLong = vwapAnchored(daily, "LONG");
  const avwapShort = vwapAnchored(daily, "SHORT");
  const vwap4H = sessionVWAP(fourHour);
  const vwap15M = sessionVWAP(fifteenMin);

  // ATR
  const atrValues = atr(daily, 14);
  const atrCurrent = currentATR(daily, 14);
  const atrPct = atrPercent(daily, 14);
  const atrData: ATRData = {
    values: atrValues,
    current: atrCurrent,
    atrPercent: atrPct,
  };

  // Relative Strength
  const rsAnalysis =
    spyBars.length > 0 ? computeRSAnalysis(daily, spyBars) : undefined;

  // RS filter — skip tickers that are obvious laggards for long setups
  if (
    filters.minRSRating !== undefined &&
    rsAnalysis &&
    rsAnalysis.rating < filters.minRSRating
  ) {
    return null;
  }

  // Setup classification
  const setups = classifySetups({
    daily: toOHLCV(daily),
    fourHour: toOHLCV(fourHour),
    fifteenMin: toOHLCV(fifteenMin),
    rsiDaily: rsiFull(daily),
    rsi4H: rsiFull(fourHour),
    rsi15M: rsiFull(fifteenMin),
    macdDaily: macdFull(daily),
    macd4H: macdFull(fourHour),
    bbDaily: bollingerBands(daily),
    bb4H: bollingerBands(fourHour),
    vwap4H,
    vwap15M,
    avwapLong,   // anchored VWAP for daily long setups
    avwapShort,  // anchored VWAP for daily short setups
    volumeDaily: volumeAnalysis(daily),
    volume4H: volumeAnalysis(fourHour),
    srDaily: supportResistance(daily),
    fibDaily: fibonacci(daily),
    patternsDaily: detectCandlePatterns(daily, "1D"),
    patterns4H: detectCandlePatterns(fourHour, "4H"),
    sma50Daily,
    sma200Daily,
    ema9Daily,
    ema9_4H,
    ema9_15M,
    sma50_4H,
    atrDaily: atrValues,
    accountSize: filters.accountSize,
    riskPerTrade: filters.riskPerTrade,
  });

  // Apply filters
  const filtered = setups.filter((s) => {
    if (filters.biasFilter !== "BOTH" && s.bias !== filters.biasFilter) return false;
    const gradeOrder = { "A+": 4, A: 3, B: 2, C: 1 };
    if (gradeOrder[s.grade] < gradeOrder[filters.minSetupGrade]) return false;
    if (s.tradeParams.riskReward.toT1 < filters.minRR) return false;
    if (
      !filters.includeBearishSetups &&
      s.bias === "SHORT" &&
      filters.biasFilter === "LONG"
    )
      return false;
    return true;
  });

  if (filtered.length === 0) return null;

  // Earnings data (async, non-blocking to screener performance)
  const earningsData = await computeEarningsData(ticker);

  // Optionally filter out high-earnings-risk tickers
  if (filters.excludeEarningsRisk && earningsData.insideEarningsWindow) {
    return null;
  }

  const primary = filtered[0];
  const volAnalysis = volumeAnalysis(daily);

  // Estimated market cap from shares outstanding if available
  // For now we use a tier-based approximation from universe data
  const marketCapEstimate =
    stock.marketCapTier === "mega"
      ? price * 5e9
      : stock.marketCapTier === "large"
      ? price * 2e9
      : price * 5e8;

  return {
    ticker,
    companyName: stock.companyName,
    sector: stock.sector,
    price,
    priceChangePercent,
    marketCap: marketCapEstimate,
    setups: filtered,
    primarySetup: primary,
    volumeVsAvg: volAnalysis.currentVsAvg,
    volumeClassification: volAnalysis.classification,
    keyConfirmingFactors: primary.confirmingFactors.slice(0, 5),
    analystRating: primary.tradeParams.analystRating,
    timestamp: new Date().toISOString(),
    rsAnalysis,
    earningsData,
    atrData,
  };
}

/**
 * Run full screener over universe
 */
export async function* runScreener(
  filters: ScreenerFilters,
  batchSize: number = 20,
  useMock: boolean = false
): AsyncGenerator<ScreenerResult, void, unknown> {
  const tickers = SCREENING_UNIVERSE.map((s) => s.ticker);
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((t) => screenTicker(t, filters, useMock))
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        yield r.value;
      }
    }
  }
}

/**
 * Get market regime (SPY-based)
 */
export async function getMarketRegime(useMock: boolean = false): Promise<MarketRegimeResult> {
  const spyBars = await fetchOHLCV("SPY", "1D", useMock);
  if (spyBars.length < 200) {
    return {
      regime: "Choppy/Sideways",
      spyAbove50SMA: false,
      spyAbove200SMA: false,
      spyRSIAbove50: false,
      spyConfirmedDowntrend: false,
      timestamp: new Date().toISOString(),
    };
  }
  return detectMarketRegime(spyBars);
}

/**
 * Deep analysis for single ticker
 */
export async function analyzeTicker(
  ticker: string,
  useMock: boolean = false,
  accountSize: number = 25000,
  riskPerTrade: number = 0.01
): Promise<DeepAnalysisResult | null> {
  const [daily, fourHour, fifteenMin, spyBars] = await Promise.all([
    fetchOHLCV(ticker, "1D", useMock),
    fetchOHLCV(ticker, "4H", useMock),
    fetchOHLCV(ticker, "15M", useMock),
    getSpyBars(useMock),
  ]);

  if (daily.length < 50) return null;

  const stock = UNIVERSE.find((s) => s.ticker === ticker) ?? {
    ticker,
    companyName: ticker,
    sector: "Unknown",
    marketCapTier: "large" as const,
  };

  const price = daily[daily.length - 1]?.close ?? 0;
  const prevClose = daily[daily.length - 2]?.close ?? price;
  const priceChangePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
  const marketCap =
    stock.marketCapTier === "mega"
      ? price * 5e9
      : stock.marketCapTier === "large"
      ? price * 2e9
      : price * 5e8;

  const sma50Daily = sma50(daily);
  const sma200Daily = sma200(daily);
  const ema9Daily = ema9(daily);
  const ema9_4H = ema9(fourHour);
  const ema9_15M = ema9(fifteenMin);
  const sma50_4H = sma50(fourHour.length >= 50 ? fourHour : daily);
  const atrValues = atr(daily, 14);
  const atrCurrent = currentATR(daily, 14);
  const atrPct = atrPercent(daily, 14);

  const avwapLong = vwapAnchored(daily, "LONG");
  const avwapShort = vwapAnchored(daily, "SHORT");
  const vwap4H = sessionVWAP(fourHour);
  const vwap15M = sessionVWAP(fifteenMin);

  const rsAnalysis =
    spyBars.length > 0 ? computeRSAnalysis(daily, spyBars) : undefined;
  const earningsData = await computeEarningsData(ticker);

  const atrData: ATRData = {
    values: atrValues,
    current: atrCurrent,
    atrPercent: atrPct,
  };

  const setups = classifySetups({
    daily: toOHLCV(daily),
    fourHour: toOHLCV(fourHour),
    fifteenMin: toOHLCV(fifteenMin),
    rsiDaily: rsiFull(daily),
    rsi4H: rsiFull(fourHour),
    rsi15M: rsiFull(fifteenMin),
    macdDaily: macdFull(daily),
    macd4H: macdFull(fourHour),
    bbDaily: bollingerBands(daily),
    bb4H: bollingerBands(fourHour),
    vwap4H,
    vwap15M,
    avwapLong,
    avwapShort,
    volumeDaily: volumeAnalysis(daily),
    volume4H: volumeAnalysis(fourHour),
    srDaily: supportResistance(daily),
    fibDaily: fibonacci(daily),
    patternsDaily: detectCandlePatterns(daily, "1D"),
    patterns4H: detectCandlePatterns(fourHour, "4H"),
    sma50Daily,
    sma200Daily,
    ema9Daily,
    ema9_4H,
    ema9_15M,
    sma50_4H,
    atrDaily: atrValues,
    accountSize,
    riskPerTrade,
  });

  const primary = setups[0];
  const volAnalysis = volumeAnalysis(daily);
  const regime = await getMarketRegime(useMock);

  if (!primary) return null;

  return {
    ticker,
    companyName: stock.companyName,
    sector: stock.sector,
    price,
    priceChangePercent,
    marketCap,
    ohlcv: { "1D": daily, "4H": fourHour, "15M": fifteenMin },
    indicators: {
      daily: {
        sma50: sma50Daily,
        sma200: sma200Daily,
        ema9: ema9Daily,
        rsi: rsiFull(daily),
        macd: macdFull(daily),
        bollingerBands: bollingerBands(daily),
        fibonacci: fibonacci(daily),
        supportResistance: supportResistance(daily),
        avwapLong,
        avwapShort,
        atr: atrValues,
      },
      fourHour: {
        sma50: sma50_4H,
        ema9: ema9_4H,
        rsi: rsiFull(fourHour),
        macd: macdFull(fourHour),
        bollingerBands: bollingerBands(fourHour),
        vwap: vwap4H,
      },
      fifteenMin: {
        ema9: ema9_15M,
        rsi: rsiFull(fifteenMin),
        vwap: vwap15M,
      },
    },
    volumeAnalysis: volAnalysis,
    supportResistance: supportResistance(daily),
    fibonacci: fibonacci(daily),
    candlestickPatterns: [
      ...detectCandlePatterns(daily, "1D"),
      ...detectCandlePatterns(fourHour, "4H"),
    ],
    setups,
    primarySetup: primary,
    analystRating: primary.tradeParams.analystRating,
    analystRatingBreakdown: { momentum: 60, trend: 65, volume: 55 },
    marketRegime: regime,
    timestamp: new Date().toISOString(),
    rsAnalysis,
    earningsData,
    atrData,
  };
}
