import { NextRequest } from "next/server";
import { FEATURES } from "@/config/features";
import { selectContract } from "@/lib/options/contractSelector";

export async function POST(req: NextRequest) {
  if (!FEATURES.OPTIONS_LAYER) {
    return Response.json({ disabled: true }, { status: 200 });
  }

  if (!process.env.OPTIONS_DATA_KEY && !process.env.TRADIER_API_KEY) {
    // Fall through to yahoo-finance2 — no key needed
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { ticker, setupResult, filters } = body;

    if (!ticker || !setupResult) {
      return Response.json({ error: "ticker and setupResult required" }, { status: 400 });
    }

    const accountSize = filters?.accountSize ?? 25000;
    const riskPerTrade = filters?.riskPerTrade ?? 0.01;
    const minIVP = filters?.optionsMinIVP ?? 60;
    const minOI = filters?.optionsMinOI ?? 500;
    const allowNaked = filters?.optionsAllowNaked ?? true;
    const allowSpreads = filters?.optionsAllowSpreads ?? true;
    const allowPMCC = filters?.optionsAllowPMCC ?? false;

    const recommendation = await selectContract({
      ticker,
      setup: setupResult,
      accountSize,
      riskPerTrade,
      minIVP,
      minOI,
      allowNaked,
      allowSpreads,
      allowPMCC,
      earningsDaysAway: undefined,
    });

    return Response.json(recommendation, {
      headers: { "Cache-Control": "private, max-age=600" },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
