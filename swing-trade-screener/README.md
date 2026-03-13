# EdgeScreen — Swing Trade Stock Screener

Professional-grade swing trade stock screener for active traders. Identifies high-conviction long and short setups across multiple timeframes using momentum, trend, and volume analysis.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS + shadcn/ui
- **Data:** Yahoo Finance (yahoo-finance2) for OHLCV; Finnhub for analyst ratings, earnings, quotes
- **State:** Zustand
- **Data Fetching:** React Query (TanStack Query v5)
- **Charts:** Lightweight Charts (TradingView)
- **Deployment:** Vercel

## Setup

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local with your API keys
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FINNHUB_API_KEY` | Finnhub API key (free tier: 60 calls/min). Used for analyst ratings, earnings calendar, real-time quotes. |
| `NEXT_PUBLIC_APP_URL` | App URL for server-side use (default: `http://localhost:3000`) |
| `USE_MOCK_DATA` | Set to `true` to use mock OHLCV data (offline development) |

**Note:** Yahoo Finance data (yahoo-finance2) does not require an API key. All OHLCV and candlestick data comes from Yahoo Finance.

## Data Sources

- **OHLCV / Candlesticks:** Yahoo Finance via `yahoo-finance2` (sole source)
- **Analyst Ratings, Earnings, Quotes:** Finnhub (fallback when Yahoo unavailable)

## Indicator Methodology

### Trend
- 50/200 SMA (Daily), 9 EMA (all timeframes)
- Golden/Death cross detection
- MA stack alignment

### Momentum
- RSI (14) with overbought/oversold (70/30)
- MACD (12, 26, 9) with crossover and zero-line detection
- RSI divergence (bullish/bearish)

### Volatility
- Bollinger Bands (20, 2) with squeeze detection
- Band touch detection

### Volume
- 20-day average volume
- Volume vs avg: 1.5x–2.5x = Institutional, >2.5x = Climactic, <1x = Weak
- OBV slope, volume trend

### Support/Resistance
- Pivot highs/lows over 50 bars, 2+ touches
- Nearest support/resistance with distance %

### Fibonacci
- Retracement: 23.6%, 38.2%, 50%, 61.8%, 78.6%
- Extension: 127.2%, 161.8%, 200%, 261.8%
- Flag when price within 1% of key level

### Candlestick Patterns
- Bullish: Hammer, Engulfing, Morning Star, Piercing Line, Dragonfly Doji, Harami, Three White Soldiers, Inside Bar
- Bearish: Shooting Star, Engulfing, Evening Star, Dark Cloud Cover, Gravestone Doji, Harami, Three Black Crows, Inside Bar

## Setup Classification

Setups are graded A+ to C based on confluence. Examples:

- **Bullish:** Golden Cross, 9 EMA Bounce, VWAP Reclaim, BB Squeeze Breakout, MA Stack Pullback, MACD Bullish Cross + RSI < 60, Fib Confluence Buy, Oversold RSI Reversal
- **Bearish:** Death Cross, 9 EMA Rejection, VWAP Rejection, BB Squeeze Breakdown, MA Stack Short, MACD Bearish Cross + RSI > 40, Fib Confluence Short, Overbought RSI Reversal

## Vercel Deployment

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

Function timeout is set to 60s in `vercel.json` for the screening API.

## Project Structure

```
/app
  /api/screen      - POST screening engine (streaming)
  /api/quote/[ticker] - GET deep analysis
  /api/indicators - GET indicator computation
  /api/options    - Options analyze, iv-history, source (Phase 3)
  /screener       - Main screener UI
  /analysis/[ticker] - Deep-dive analysis
  /settings       - User preferences
/components
  /screener       - ResultsTable, FilterPanel, TickerCard, SetupBadge
  /options        - OptionsToggle, OptionsContractCard, IVHistoryMiniChart
  /charts         - CandlestickChart, IndicatorOverlay, MultiTimeframePanel
/lib
  /indicators     - SMA, EMA, RSI, MACD, VWAP, Bollinger, Fib, S/R, candle patterns, volume
  /scoring        - Momentum, trend, volume scores; composite; setup classifier
  /options        - Greeks, IV analysis, expected move, skew, UOA, contract selector
  /utils          - Position sizing, risk/reward, market regime, formatter, Finnhub client, optionsData, ivHistory
  /stores         - Regime, settings
/config           - Feature flags (Phase 3)
/types            - Shared TypeScript interfaces
/constants        - Indicator thresholds, stock universe
```

---

## Phase 3: Options Layer (Feature-Flagged)

The options layer is built in full but ships **inactive**. A single config flag controls all activation. No options code runs, no options UI renders, and no options API calls are made until the flag is flipped. The stock screener (Phases 1 and 2) is completely unaffected by the presence of this code.

### Activation Checklist

When ready to activate Phase 3:

1. Set `OPTIONS_LAYER: true` in `/config/features.ts`
2. Set `OPTIONS_CHAIN_DATA: true`
3. Set remaining flags to `true` as each sub-feature is validated:
   - `GREEKS_DISPLAY`, `IV_RANK_COLUMN`, `CONTRACT_RECOMMENDER`, `STRUCTURE_ENGINE`, `UNUSUAL_ACTIVITY_FLAG`, `IV_HISTORY_TRACKER`
4. Add KV env vars to Vercel dashboard (Vercel KV, free tier):
   - `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`
5. Deploy — IV history begins accumulating immediately
6. After 30 days: IV Percentile becomes meaningful, UOA detection activates fully
7. When upgrading to Tradier:
   - Add `TRADIER_API_KEY` to Vercel env vars
   - Set `TRADIER_SANDBOX=false` for live data
   - No other code changes required

### Options Methodology

- **IV Rank (IVR):** `(current IV - 52w low) / (52w high - 52w low) × 100`
- **IV Percentile (IVP):** `(days IV was below current) / total days × 100` — primary display metric
- **Greeks:** Black-Scholes approximation computed locally (yahoo-finance2 gaps don't break the UI)
- **Expected Move:** `Price × IV × √(DTE / 365)`
- **Skew:** IV of 25-delta put minus IV of 25-delta call; positive = normal for equities
- **Contract Selection:** IVP-driven structure (naked vs spread vs PMCC), DTE from hold duration, strike from grade and IVP

### Environment Variables (Options)

| Variable | Description |
|----------|-------------|
| `TRADIER_API_KEY` | Tradier API key for live options chain (optional; yahoo-finance2 used when absent) |
| `TRADIER_SANDBOX` | `true` for sandbox, `false` for live |
| `KV_URL` | Vercel KV connection URL (IV history) |
| `KV_REST_API_URL` | Vercel KV REST API URL |
| `KV_REST_API_TOKEN` | Vercel KV REST API token |
| `KV_REST_API_READ_ONLY_TOKEN` | Vercel KV read-only token |
| `OPTIONS_DATA_KEY` | Optional premium data source key |

---

## License

MIT
