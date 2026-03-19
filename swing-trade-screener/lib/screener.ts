import type {
  OHLCVBar,
  ScreenerResult,
  ScreenerFilters,
  DeepAnalysisResult,
  MarketRegimeResult,
  WallStreetConsensus,
  AnalystRating,
  SectorRSResult,
} from "@/types";
import { SCREENING_UNIVERSE, UNIVERSE } from "@/constants/universe";
import {
  MIN_PRICE,
  MIN_AVG_VOLUME,
  MIN_MARKET_CAP,
} from "@/constants/indicators";
import { fetchOHLCV } from "@/lib/dataFetcher";
import { sma50, sma200 } from "@/lib/indicators/sma";
import { ema9 } from "@/lib/indicators/ema";
import { rsiFull } from "@/lib/indicators/rsi";
import { macdFull } from "@/lib/indicators/macd";
import { sessionVWAP as vwap } from "@/lib/indicators/vwap";
import { bollingerBands } from "@/lib/indicators/bollingerBands";
import { fibonacci } from "@/lib/indicators/fibonacci";
import { supportResistance } from "@/lib/indicators/supportResistance";
import { detectCandlePatterns } from "@/lib/indicators/candlePatterns";
import { volumeAnalysis } from "@/lib/indicators/volumeAnalysis";
import { gapAnalysis } from "@/lib/indicators/gapAnalysis";
import {
  computeSectorRanks,
  getSectorRSForTicker,
} from "@/lib/indicators/sectorRelativeStrength";
import { classifySetups } from "@/lib/scoring/tradeSetupClassifier";
import { detectMarketRegime } from "@/lib/utils/marketRegime";
import { getRecommendations, getPriceTarget, getCompanyNews, getEarningsCalendar } from "@/lib/utils/finnhub";
import { analyzeNewsSentiment } from "@/lib/utils/newsSentiment";
import { computeBreadthDataPoint, type BreadthDataPoint } from "@/lib/utils/marketBreadth";
import { getShortInterest } from "@/lib/utils/shortInterest";
import { computeRSAnalysis } from "@/lib/indicators/relativeStrength";
import { getPreMarketContext } from "@/lib/utils/marketHours";
import { currentATR, atrPercent } from "@/lib/indicators/atr";
import type { ATRData, EarningsData } from "@/types";
import { FEATURES } from "@/config/features";

function toOHLCV(bars: OHLCVBar[]): OHLCVBar[] {
  return bars;
}

async function computeWallStreetConsensus(
  ticker: string,
  currentPrice: number,
  internalRating: AnalystRating
): Promise<WallStreetConsensus | undefined> {
  try {
    const recs = await getRecommendations(ticker);
    if (!recs || recs.length === 0) return undefined;

    const latest = recs[0];
    const total =
      latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;
    if (total === 0) return undefined;

    const bullishPct = (latest.strongBuy + latest.buy) / total;

    let consensusLabel: WallStreetConsensus["consensusLabel"];
    if (bullishPct >= 0.7) consensusLabel = "Strong Buy";
    else if (bullishPct >= 0.55) consensusLabel = "Buy";
    else if (bullishPct >= 0.4) consensusLabel = "Hold";
    else if (bullishPct >= 0.25) consensusLabel = "Sell";
    else consensusLabel = "Strong Sell";

    const internalBullish = ["Strong Buy", "Buy", "Speculative Buy"].includes(internalRating);
    const wsBullish = ["Strong Buy", "Buy"].includes(consensusLabel);
    const wsNeutral = consensusLabel === "Hold";
    const edgeScreenAgreement: WallStreetConsensus["edgeScreenAgreement"] =
      (internalBullish && wsBullish) || (!internalBullish && !wsBullish && !wsNeutral)
        ? "agrees"
        : wsNeutral
        ? "neutral"
        : "disagrees";

    const targets = await getPriceTarget(ticker);
    const meanTarget = targets?.targetMean;
    const upsideToMean =
      meanTarget && currentPrice > 0
        ? ((meanTarget - currentPrice) / currentPrice) * 100
        : undefined;

    return {
      strongBuy: latest.strongBuy,
      buy: latest.buy,
      hold: latest.hold,
      sell: latest.sell,
      strongSell: latest.strongSell,
      totalAnalysts: total,
      consensusLabel,
      meanPriceTarget: meanTarget,
      highPriceTarget: targets?.targetHigh,
      lowPriceTarget: targets?.targetLow,
      upsideToMean,
      edgeScreenAgreement,
    };
  } catch {
    return undefined;
  }
}

export interface ScreenTickerResult {
  result: ScreenerResult | null;
  breadthData: BreadthDataPoint | null;
}

/**
 * Run full screening for a single ticker
 */
export async function screenTicker(
  ticker: string,
  filters: ScreenerFilters,
  useMock: boolean = false,
  sectorRanks?: SectorRSResult[],
  breadth?: import("@/lib/utils/marketBreadth").MarketBreadth | null,
  spyBars?: OHLCVBar[]
): Promise<ScreenTickerResult> {
  const stock = UNIVERSE.find((s) => s.ticker === ticker) ?? {
    ticker,
    companyName: ticker,
    sector: "Unknown",
    marketCapTier: "large",
  };

  const [daily, fourHour, fifteenMin] = await Promise.all([
    fetchOHLCV(ticker, "1D", useMock),
    fetchOHLCV(ticker, "4H", useMock),
    fetchOHLCV(ticker, "15M", useMock),
  ]);

  const breadthData = computeBreadthDataPoint(ticker, daily);
  const rsAnalysis = spyBars && spyBars.length >= 61 ? computeRSAnalysis(daily, spyBars) : null;

  if (daily.length < 50) return { result: null, breadthData };

  const price = daily[daily.length - 1]?.close ?? 0;
  const prevClose = daily[daily.length - 2]?.close ?? price;
  const priceChangePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

  const avgVolume20 =
    daily.slice(-20).reduce((s, b) => s + b.volume, 0) / Math.min(20, daily.length);
  const marketCap = price * 1e9;

  if (price < filters.minPrice) return { result: null, breadthData };
  if (avgVolume20 < filters.minVolume) return { result: null, breadthData };
  if (marketCap < filters.minMarketCap) return { result: null, breadthData };

  const sma50Daily = sma50(daily);
  const sma200Daily = sma200(daily);
  const ema9Daily = ema9(daily);
  const ema9_4H = ema9(fourHour);
  const ema9_15M = ema9(fifteenMin);
  const sma50_4H = sma50(fourHour.length >= 50 ? fourHour : daily);
  const gapResult = gapAnalysis(daily);

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
    vwap4H: vwap(fourHour),
    vwap15M: vwap(fifteenMin),
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
    accountSize: filters.accountSize,
    riskPerTrade: filters.riskPerTrade,
    sizingMethod: filters.sizingMethod,
    kellyParams: filters.kellyParams,
    gapAnalysis: gapResult,
    sectorRS,
    breadth,
  });

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

  if (filtered.length === 0) return { result: null, breadthData };

  const primary = filtered[0];
  const volAnalysis = volumeAnalysis(daily);

  // Compute ATR data
  const atrData: ATRData = {
    current: currentATR(daily),
    atrPercent: atrPercent(daily),
  };

  // Compute earnings data
  let earningsData: EarningsData = { daysToEarnings: 999, riskLevel: "UNKNOWN" };
  try {
    const earningsCalendar = await getEarningsCalendar(ticker);
    if (earningsCalendar && earningsCalendar.length > 0) {
      const today = new Date();
      const upcoming = earningsCalendar
        .map((e) => ({ ...e, date: new Date(e.period) }))
        .filter((e) => e.date >= today)
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      if (upcoming.length > 0) {
        const next = upcoming[0];
        const daysAway = Math.ceil((next.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        earningsData = {
          daysToEarnings: daysAway,
          nextEarningsDate: next.period,
          riskLevel: daysAway <= 3 ? "HIGH" : daysAway <= 21 ? "MODERATE" : "LOW",
        };
      } else {
        earningsData = { daysToEarnings: 999, riskLevel: "LOW" };
      }
    }
  } catch { /* earnings data is best-effort */ }

  // Server-side RS filter
  if (filters.minRSRating && filters.minRSRating > 0 && rsAnalysis) {
    if (rsAnalysis.rating < filters.minRSRating) return { result: null, breadthData };
  }

  // Server-side earnings exclusion
  if (filters.excludeEarningsRisk && earningsData.riskLevel === "HIGH") {
    return { result: null, breadthData };
  }

  const shortInterestPromise = FEATURES.SHORT_INTEREST ? getShortInterest(ticker) : Promise.resolve(undefined);
  const preMarketPromise = FEATURES.PREMARKET_CONTEXT ? getPreMarketContext(ticker) : Promise.resolve(null);
  const wsPromise = FEATURES.WALL_STREET_CONSENSUS
    ? computeWallStreetConsensus(ticker, price, primary.tradeParams.analystRating)
    : Promise.resolve(undefined);
  const newsPromise = FEATURES.NEWS_SENTIMENT
    ? getCompanyNews(ticker, 2)
    : Promise.resolve(null);
  const [wsResult, newsResult, shortResult, preMarketResult] = await Promise.allSettled([
    wsPromise,
    newsPromise,
    shortInterestPromise,
    preMarketPromise,
  ]);
  const wallStreetConsensus =
    wsResult.status === "fulfilled" ? wsResult.value : undefined;
  const news = newsResult.status === "fulfilled" ? newsResult.value : null;
  const newsSentiment = news ? analyzeNewsSentiment(news) : undefined;
  const shortInterest = shortResult.status === "fulfilled" ? shortResult.value : undefined;
  const preMarketContext = preMarketResult.status === "fulfilled" ? preMarketResult.value : null;

  const riskFactors = [...primary.riskFactors];
  if (
    wallStreetConsensus?.edgeScreenAgreement === "disagrees" &&
    wallStreetConsensus.consensusLabel
  ) {
    const internalBullish = ["Strong Buy", "Buy", "Speculative Buy"].includes(
      primary.tradeParams.analystRating
    );
    riskFactors.push(
      internalBullish
        ? `EdgeScreen bullish — Wall Street consensus is ${wallStreetConsensus.consensusLabel}`
        : `EdgeScreen bearish — Wall Street consensus is ${wallStreetConsensus.consensusLabel}`
    );
  }
  if (newsSentiment?.riskFlag) {
    riskFactors.push(
      newsSentiment.hasHighImpactNews
        ? "High-impact negative news in last 48h"
        : "Negative news in last 48h"
    );
  }

  const confirmingFactors = [...primary.confirmingFactors];
  if (
    shortInterest?.squeezeCandidate &&
    primary.bias === "LONG" &&
    (primary.name.toLowerCase().includes("breakout") ||
      primary.name.toLowerCase().includes("breakout continuation"))
  ) {
    confirmingFactors.push(
      `Short squeeze candidate (${shortInterest.shortPercentOfFloat.toFixed(1)}% short float)`
    );
  }

  const gradeOrder = { "A+": 4, A: 3, B: 2, C: 1 };
  const grades: Array<"A+" | "A" | "B" | "C"> = ["C", "B", "A", "A+"];
  const downgradeGrade = (g: "A+" | "A" | "B" | "C") =>
    grades[Math.max(0, (gradeOrder[g] ?? 2) - 1)];
  const upgradeGrade = (g: "A+" | "A" | "B" | "C") =>
    grades[Math.min(4, (gradeOrder[g] ?? 2) + 1)];
  let primaryGrade = primary.grade;
  if (newsSentiment?.hasHighImpactNews) primaryGrade = downgradeGrade(primaryGrade);
  if (
    shortInterest?.squeezeCandidate &&
    primary.bias === "LONG" &&
    primaryGrade !== "A+" &&
    (primary.name.toLowerCase().includes("breakout") ||
      primary.name.toLowerCase().includes("breakout continuation"))
  ) {
    primaryGrade = upgradeGrade(primaryGrade);
  }
  const primaryWithGrade = { ...primary, grade: primaryGrade, riskFactors, confirmingFactors };

  return {
    result: {
      ticker,
      companyName: stock.companyName,
      sector: stock.sector,
      price,
      priceChangePercent,
      marketCap,
      setups: filtered.map((s) =>
        s === primary ? { ...s, riskFactors, grade: primaryWithGrade.grade } : s
      ),
      primarySetup: primaryWithGrade,
      volumeVsAvg: volAnalysis.currentVsAvg,
      volumeClassification: volAnalysis.classification,
      keyConfirmingFactors: primaryWithGrade.confirmingFactors.slice(0, 5),
      analystRating: primary.tradeParams.analystRating,
      wallStreetConsensus,
      gapAnalysis: gapResult.gap ? gapResult : undefined,
      sectorRS,
      newsSentiment,
      shortInterest,
      rsAnalysis,
      atr: atrData,
      earnings: earningsData,
      preMarketContext: preMarketContext ?? undefined,
      timestamp: new Date().toISOString(),
    },
    breadthData,
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
  const sectorRanks = await computeSectorRanks(useMock);
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((t) => screenTicker(t, filters, useMock, sectorRanks))
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.result) {
        yield r.value.result;
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

export interface AnalyzeTickerOptions {
  useMock?: boolean;
  accountSize?: number;
  riskPerTrade?: number;
  sizingMethod?: ScreenerFilters["sizingMethod"];
  kellyParams?: ScreenerFilters["kellyParams"];
}

/**
 * Deep analysis for single ticker
 */
export async function analyzeTicker(
  ticker: string,
  useMockOrOptions: boolean | AnalyzeTickerOptions = false
): Promise<DeepAnalysisResult | null> {
  const opts: AnalyzeTickerOptions =
    typeof useMockOrOptions === "boolean"
      ? { useMock: useMockOrOptions }
      : { useMock: false, ...useMockOrOptions };
  const useMock = opts.useMock ?? false;
  const [daily, fourHour, fifteenMin] = await Promise.all([
    fetchOHLCV(ticker, "1D", useMock),
    fetchOHLCV(ticker, "4H", useMock),
    fetchOHLCV(ticker, "15M", useMock),
  ]);

  if (daily.length < 50) return null;

  const stock = UNIVERSE.find((s) => s.ticker === ticker) ?? {
    ticker,
    companyName: ticker,
    sector: "Unknown",
    marketCapTier: "large",
  };

  const price = daily[daily.length - 1]?.close ?? 0;
  const prevClose = daily[daily.length - 2]?.close ?? price;
  const priceChangePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
  const marketCap = price * 1e9;

  const sma50Daily = sma50(daily);
  const sma200Daily = sma200(daily);
  const ema9Daily = ema9(daily);
  const ema9_4H = ema9(fourHour);
  const ema9_15M = ema9(fifteenMin);
  const sma50_4H = sma50(fourHour.length >= 50 ? fourHour : daily);
  const gapResult = gapAnalysis(daily);
  const sectorRanks = await computeSectorRanks(useMock);
  const sectorRS = getSectorRSForTicker(stock.sector, sectorRanks);

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
    vwap4H: vwap(fourHour),
    vwap15M: vwap(fifteenMin),
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
    accountSize: opts.accountSize ?? 25000,
    riskPerTrade: opts.riskPerTrade ?? 0.01,
    sizingMethod: opts.sizingMethod,
    kellyParams: opts.kellyParams,
    gapAnalysis: gapResult,
    sectorRS,
  });

  const primary = setups[0];
  const volAnalysis = volumeAnalysis(daily);

  const preMarketPromise = FEATURES.PREMARKET_CONTEXT ? getPreMarketContext(ticker) : Promise.resolve(null);
  const wsPromise2 = FEATURES.WALL_STREET_CONSENSUS && primary
    ? computeWallStreetConsensus(ticker, price, primary.tradeParams.analystRating)
    : Promise.resolve(undefined);
  const newsPromise2 = FEATURES.NEWS_SENTIMENT
    ? getCompanyNews(ticker, 2)
    : Promise.resolve(null);
  const [regimeResult, wsResult, newsResult, preMarketResult] = await Promise.allSettled([
    getMarketRegime(useMock),
    wsPromise2,
    newsPromise2,
    preMarketPromise,
  ]);
  const regime = regimeResult.status === "fulfilled" ? regimeResult.value : null;
  const wallStreetConsensus =
    wsResult.status === "fulfilled" ? wsResult.value : undefined;
  const news = newsResult.status === "fulfilled" ? newsResult.value : null;
  const newsSentiment = news ? analyzeNewsSentiment(news) : undefined;
  const preMarketContext = preMarketResult.status === "fulfilled" ? preMarketResult.value : null;

  const momentum = 60;
  const trend = 65;
  const volume = 55;

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
      },
      fourHour: {
        sma50: sma50_4H,
        ema9: ema9_4H,
        rsi: rsiFull(fourHour),
        macd: macdFull(fourHour),
        bollingerBands: bollingerBands(fourHour),
        vwap: vwap(fourHour),
      },
      fifteenMin: {
        ema9: ema9_15M,
        rsi: rsiFull(fifteenMin),
        vwap: vwap(fifteenMin),
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
    primarySetup: primary!,
    analystRating: primary?.tradeParams.analystRating ?? "Watch",
    analystRatingBreakdown: { momentum, trend, volume },
    marketRegime: regime ?? {
      regime: "Choppy/Sideways",
      spyAbove50SMA: false,
      spyAbove200SMA: false,
      spyRSIAbove50: false,
      spyConfirmedDowntrend: false,
      timestamp: new Date().toISOString(),
    },
    wallStreetConsensus,
    gapAnalysis: gapResult.gap ? gapResult : undefined,
    sectorRS: sectorRS ?? undefined,
    newsSentiment,
    preMarketContext: preMarketContext ?? undefined,
    timestamp: new Date().toISOString(),
  };
}
