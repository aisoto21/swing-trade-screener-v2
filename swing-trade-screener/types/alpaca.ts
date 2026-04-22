// =============================================================================
// ALPACA PAPER TRADING TYPES
// =============================================================================

export interface AlpacaTrade {
  tradeId: string;
  ticker: string;
  direction: "long" | "short";
  setupType: string;
  grade: string;
  entryPrice: number;
  stopPrice: number;
  t1Price: number;
  t2Price: number;
  totalShares: number;
  t1Qty: number;
  phase2Qty: number;
  primaryOrderId: string;  // bracket entry order ID
  t1OrderId: string;       // bracket order ID (take_profit internal) or standalone T1 order
  phase2OrderId?: string;  // OCO order ID for phase 2 (T2 limit + 2% trailing stop)
  phase: 1 | 2 | "closed";
  // "queued" = submitted while market was closed; "active" = order live on Alpaca; "expired" = stale cleanup
  status?: "queued" | "active" | "expired";
  // "alpaca_only" = position exists on Alpaca but no matching Redis record
  source?: "alpaca_only";
  marketRegime?: "bull" | "bear" | "neutral" | null;
  submittedAt: string;     // ISO timestamp
  t1FilledAt: string | null;
  closedAt: string | null;
  outcome: "win" | "loss" | "open" | null;
  exitPrice?: number;
  exitReason?: "stop_loss" | "t1" | "t2" | "trailing_stop" | null;
  // Partial fill tracking
  filledQty?: number;
  filledEntryPrice?: number;
  // Slippage (filled entry vs intended entry)
  slippage?: number;       // dollars: filledEntryPrice - entryPrice (long), entryPrice - filledEntryPrice (short)
  slippageBps?: number;    // basis points
}

// Daily portfolio snapshot for performance history
export interface DailySnapshot {
  date: string;            // YYYY-MM-DD
  equity: number;
  openTrades: number;
  closedTrades: number;
  winRate: number | null;  // null if no closed trades
  pnl: number;             // cumulative closed P&L
}

// Alpaca REST API response shapes (paper-api.alpaca.markets)

export interface AlpacaOrderLeg {
  id: string;
  client_order_id: string;
  status: AlpacaOrderStatus;
  symbol: string;
  qty: string;
  filled_qty: string;
  type: string;
  side: string;
  time_in_force: string;
  limit_price: string | null;
  stop_price: string | null;
  trail_percent: string | null;
  filled_avg_price: string | null;
}

export type AlpacaOrderStatus =
  | "new"
  | "partially_filled"
  | "filled"
  | "done_for_day"
  | "canceled"
  | "expired"
  | "replaced"
  | "pending_cancel"
  | "pending_replace"
  | "pending_new"
  | "accepted"
  | "stopped"
  | "rejected"
  | "suspended"
  | "calculated"
  | "held"
  | "accepted_for_bidding";

export interface AlpacaOrderResponse {
  id: string;
  client_order_id: string;
  status: AlpacaOrderStatus;
  symbol: string;
  qty: string;
  filled_qty: string;
  type: string;
  side: string;
  time_in_force: string;
  limit_price: string | null;
  stop_price: string | null;
  trail_percent: string | null;
  filled_avg_price: string | null;
  legs: AlpacaOrderLeg[] | null;
  order_class: string;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  filled_at: string | null;
  expired_at: string | null;
  canceled_at: string | null;
}

export interface AlpacaPosition {
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  unrealized_intraday_pl: string;
  unrealized_intraday_plpc: string;
  side: "long" | "short";
  market_value: string;
  cost_basis: string;
}

export interface AlpacaAccount {
  equity: string;
  buying_power: string;
  cash: string;
  portfolio_value: string;
}

export interface AlpacaClock {
  timestamp: string;
  is_open: boolean;
  next_open: string;
  next_close: string;
}
