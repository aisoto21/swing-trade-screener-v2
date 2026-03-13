/**
 * Black-Scholes Greeks — computed locally, not from data source
 */

const SQRT_365 = Math.sqrt(365);

function normCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function d1(S: number, K: number, T: number, r: number, sigma: number): number {
  const sqrtT = Math.sqrt(T);
  return (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
}

function d2(S: number, K: number, T: number, r: number, sigma: number): number {
  const sqrtT = Math.sqrt(T);
  return (Math.log(S / K) + (r - 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
}

export function getDelta(
  strike: number,
  price: number,
  dte: number,
  iv: number,
  type: "call" | "put"
): number {
  if (dte <= 0 || iv <= 0) return type === "call" ? 0.5 : -0.5;
  const T = dte / 365;
  const r = 0.05;
  const sigma = iv;
  const d1Val = d1(price, strike, T, r, sigma);

  if (type === "call") {
    return normCDF(d1Val);
  } else {
    return normCDF(d1Val) - 1;
  }
}

export function getTheta(
  strike: number,
  price: number,
  dte: number,
  iv: number,
  type: "call" | "put"
): number {
  if (dte <= 0 || iv <= 0) return 0;
  const T = dte / 365;
  const r = 0.05;
  const sigma = iv;
  const sqrtT = Math.sqrt(T);
  const d1Val = d1(price, strike, T, r, sigma);
  const d2Val = d2(price, strike, T, r, sigma);

  const term1 = (-price * normPDF(d1Val) * sigma) / (2 * sqrtT * SQRT_365);
  const term2 = r * price * normCDF(d1Val) - r * strike * Math.exp(-r * T) * normCDF(d2Val);

  if (type === "call") {
    return (term1 - term2) / 365;
  } else {
    return (term1 + term2) / 365;
  }
}

export function getVega(
  strike: number,
  price: number,
  dte: number,
  iv: number,
  _type: "call" | "put"
): number {
  if (dte <= 0 || iv <= 0) return 0;
  const T = dte / 365;
  const d1Val = d1(price, strike, T, 0.05, iv);
  return (price * normPDF(d1Val) * Math.sqrt(T)) / 100;
}

export function getGamma(
  strike: number,
  price: number,
  dte: number,
  iv: number,
  _type: "call" | "put"
): number {
  if (dte <= 0 || iv <= 0) return 0;
  const T = dte / 365;
  const d1Val = d1(price, strike, T, 0.05, iv);
  return normPDF(d1Val) / (price * iv * Math.sqrt(T));
}

export function computeThetaCliff(expiration: string): boolean {
  const exp = new Date(expiration).getTime();
  const now = Date.now();
  const dte = Math.ceil((exp - now) / 86400000);
  return dte < 21;
}

export function computeProbabilityOfProfit(delta: number, type: "call" | "put"): number {
  if (type === "call") {
    return Math.max(0, Math.min(100, delta * 100));
  } else {
    return Math.max(0, Math.min(100, (1 - delta) * 100));
  }
}
