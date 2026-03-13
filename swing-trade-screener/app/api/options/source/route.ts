import { NextResponse } from "next/server";

export async function GET() {
  const source = process.env.TRADIER_API_KEY ? "tradier" : "yahoo";
  return NextResponse.json({
    source,
    label: source === "tradier" ? "Tradier (live)" : "yahoo-finance2 (free)",
  });
}
