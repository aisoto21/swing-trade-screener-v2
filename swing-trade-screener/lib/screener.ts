import type {
  OHLCVBar,
  ScreenerResult,
  ScreenerFilters,
  DeepAnalysisResult,
  MarketRegimeResult,
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
import { vwap } from "@/lib/indicators/vwap";
import { bollingerBands } from "@/lib/indicators/bollingerBands";
import { fibonacci } from "@/lib/indicators/fibonacci";
import { supportResistance } from "@/lib/indicators/supportResistance";
import { detectCandlePatterns } from "@/lib/indicators/candlePatterns";
import { volumeAnalysis } from "@/lib/indicators/volumeAnalysis";
import { classifySetups } from "@/lib/scoring/tradeSetupClassifier";
import { detectMarketRegime } from "@/lib/utils/marketRegime";

function toOHLCV(bars: OHLCVBar[]): OHLCVBar[] {
  return bars;
}

/**
 * Run full screening for a single ticker
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
    marketCapTier: "large",
  };

  const [daily, fourHour, fifteenMin] = await Promise.all([
    fetchOHLCV(ticker, "1D", useMock),
    fetchOHLCV(ticker, "4H", useMock),
    fetchOHLCV(ticker, "15M", useMock),
  ]);

  if (daily.length < 50) return null;

  const price = daily[daily.length - 1]?.close ?? 0;
  const prevClose = daily[daily.length - 2]?.close ?? price;
  const priceChangePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

  const avgVolume20 =
    daily.slice(-20).reduce((s, b) => s + b.volume, 0) / Math.min(20, daily.length);
  const marketCap = price * 1e9;

  if (price < filters.minPrice) return null;
  if (avgVolume20 < filters.minVolume) return null;
  if (marketCap < filters.minMarketCap) return null;

  const sma50Daily = sma50(daily);
  const sma200Daily = sma200(daily);
  const ema9Daily = ema9(daily);
  const ema9_4H = ema9(fourHour);
  const ema9_15M = ema9(fifteenMin);
  const sma50_4H = sma50(fourHour.length >= 50 ? fourHour : daily);

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

  if (filtered.length === 0) return null;

  const primary = filtered[0];
  const volAnalysis = volumeAnalysis(daily);

  return {
    ticker,
    companyName: stock.companyName,
    sector: stock.sector,
    price,
    priceChangePercent,
    marketCap,
    setups: filtered,
    primarySetup: primary,
    volumeVsAvg: volAnalysis.currentVsAvg,
    volumeClassification: volAnalysis.classification,
    keyConfirmingFactors: primary.confirmingFactors.slice(0, 5),
    analystRating: primary.tradeParams.analystRating,
    timestamp: new Date().toISOString(),
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
  useMock: boolean = false
): Promise<DeepAnalysisResult | null> {
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
    accountSize: 25000,
    riskPerTrade: 0.01,
  });

  const primary = setups[0];
  const volAnalysis = volumeAnalysis(daily);
  const regime = await getMarketRegime(useMock);

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
    marketRegime: regime,
    timestamp: new Date().toISOString(),
  };
}
