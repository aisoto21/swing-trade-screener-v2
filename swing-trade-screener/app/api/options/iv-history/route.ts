import { NextRequest } from "next/server";
import { FEATURES } from "@/config/features";
import { getIVHistory } from "@/lib/utils/ivHistory";

export async function GET(req: NextRequest) {
  if (!FEATURES.OPTIONS_LAYER) {
    return Response.json({ disabled: true }, { status: 200 });
  }

  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");
  if (!ticker) {
    return Response.json({ error: "ticker required" }, { status: 400 });
  }

  const values = await getIVHistory(ticker);

  return Response.json({ values }, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
