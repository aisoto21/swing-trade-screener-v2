import { getMarketRegime } from "@/lib/screener";

export async function GET() {
  const useMock = process.env.USE_MOCK_DATA === "true";
  const regime = await getMarketRegime(useMock);
  return Response.json(regime, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
