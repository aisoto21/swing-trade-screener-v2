/**
 * Skew computation and interpretation
 */

import type { OptionsChain } from "@/types";

export function computeSkew(chain: OptionsChain): number {
  const targetDelta = 0.25;

  const sortedCalls = [...chain.calls].sort((a, b) => a.strike - b.strike);
  const sortedPuts = [...chain.puts].sort((a, b) => a.strike - b.strike);

  const call25Delta = sortedCalls.find((c) => (c.delta ?? 0.5) >= targetDelta - 0.1 && (c.delta ?? 0.5) <= targetDelta + 0.1);
  const put25Delta = sortedPuts.find((p) => (p.delta ?? -0.5) <= -targetDelta + 0.1 && (p.delta ?? -0.5) >= -targetDelta - 0.1);

  const putIV = put25Delta?.impliedVolatility ?? 0.3;
  const callIV = call25Delta?.impliedVolatility ?? 0.3;

  return (putIV - callIV) * 100;
}

export function getSkewInterpretation(
  skew: number,
  bias: "LONG" | "SHORT"
): "favorable" | "neutral" | "warning" {
  if (bias === "LONG") {
    if (skew > 5) return "warning";
    if (skew < -2) return "favorable";
  } else {
    if (skew < 2) return "warning";
    if (skew > 5) return "favorable";
  }
  return "neutral";
}
