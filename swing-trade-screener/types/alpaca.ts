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
  submittedAt: string;     // ISO timestamp
  t1FilledAt: string | null;
  closedAt: string | null;
  outcome: "win" | "loss" | "open" | null;
  exitPrice?: number;
  exitReason?: "stop_loss" | "t1" | "t2" | "trailing_stop" | null;
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
