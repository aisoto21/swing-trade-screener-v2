import type { FinnhubNewsItem } from "@/lib/utils/finnhub";
import type { NewsSentiment as NewsSentimentType } from "@/types";

const BEARISH_KEYWORDS = [
  "downgrade",
  "miss",
  "missed",
  "lower guidance",
  "cuts forecast",
  "layoffs",
  "investigation",
  "fraud",
  "lawsuit",
  "recall",
  "bankruptcy",
  "default",
  "warning",
  "disappoints",
  "below expectations",
  "sell-off",
  "short seller",
  "DOJ",
  "SEC investigation",
  "accounting irregularities",
];

const BULLISH_KEYWORDS = [
  "upgrade",
  "beat",
  "beats",
  "raises guidance",
  "record revenue",
  "new contract",
  "partnership",
  "buyback",
  "acquisition target",
  "above expectations",
  "strong demand",
  "raised price target",
];

const HIGH_IMPACT_KEYWORDS = [
  "DOJ",
  "SEC",
  "fraud",
  "bankruptcy",
  "investigation",
  "accounting irregularities",
];


function scoreHeadline(text: string): { bearish: number; bullish: number; highImpact: boolean } {
  const lower = text.toLowerCase();
  let bearish = 0;
  let bullish = 0;
  let highImpact = false;

  for (const kw of BEARISH_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) bearish++;
  }
  for (const kw of BULLISH_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) bullish++;
  }
  for (const kw of HIGH_IMPACT_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) highImpact = true;
  }

  return { bearish, bullish, highImpact };
}

export function analyzeNewsSentiment(news: FinnhubNewsItem[]): NewsSentimentType {
  if (!news || news.length === 0) {
    return {
      sentiment: "neutral",
      headlineCount: 0,
      negativeHeadlines: [],
      positiveHeadlines: [],
      hasHighImpactNews: false,
      riskFlag: false,
    };
  }

  let totalBearish = 0;
  let totalBullish = 0;
  let hasHighImpact = false;
  const negativeHeadlines: string[] = [];
  const positiveHeadlines: string[] = [];

  for (const item of news) {
    const text = `${item.headline} ${item.summary ?? ""}`;
    const { bearish, bullish, highImpact } = scoreHeadline(text);
    totalBearish += bearish;
    totalBullish += bullish;
    if (highImpact) hasHighImpact = true;
    if (bearish > 0 && negativeHeadlines.length < 3) {
      negativeHeadlines.push(item.headline);
    }
    if (bullish > 0 && positiveHeadlines.length < 3) {
      positiveHeadlines.push(item.headline);
    }
  }

  let sentiment: NewsSentimentType["sentiment"] = "neutral";
  if (totalBearish > totalBullish) sentiment = "negative";
  else if (totalBullish > totalBearish) sentiment = "positive";

  const riskFlag = sentiment === "negative" || hasHighImpact;

  return {
    sentiment,
    headlineCount: news.length,
    negativeHeadlines,
    positiveHeadlines,
    hasHighImpactNews: hasHighImpact,
    riskFlag,
  };
}
