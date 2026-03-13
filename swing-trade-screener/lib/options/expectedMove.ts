/**
 * Expected move computation and target vs expected move assessment
 */

export function computeExpectedMove(
  price: number,
  iv: number,
  dte: number
): { up: number; down: number; pct: number } {
  const ivDecimal = iv;
  const sqrtT = Math.sqrt(dte / 365);
  const movePct = ivDecimal * sqrtT;
  const moveDollar = price * movePct;

  return {
    up: moveDollar,
    down: moveDollar,
    pct: movePct * 100,
  };
}

export function assessTargetVsExpectedMove(
  target: number,
  entry: number,
  expectedMovePct: number
): "favorable" | "neutral" | "unfavorable" {
  const targetPct = Math.abs((target - entry) / entry) * 100;
  const halfExpected = expectedMovePct * 0.5;

  if (targetPct > expectedMovePct) return "favorable";
  if (targetPct < halfExpected) return "unfavorable";
  return "neutral";
}
