"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SetupBadge } from "./SetupBadge";
import type { ScreenerResult } from "@/types";
import { formatCurrency, formatPercent } from "@/lib/utils/formatter";
import Link from "next/link";

interface TickerCardProps {
  result: ScreenerResult;
}

export function TickerCard({ result }: TickerCardProps) {
  const { primarySetup } = result;
  const isLong = primarySetup.bias === "LONG";

  return (
    <Link href={`/analysis/${result.ticker}`}>
      <Card
        className={`cursor-pointer transition-colors hover:border-primary/50 ${
          isLong ? "border-l-4 border-l-emerald-500/50" : "border-l-4 border-l-red-500/50"
        }`}
      >
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{result.ticker}</h3>
              <p className="text-xs text-muted-foreground">{result.companyName}</p>
            </div>
            <div className="text-right">
              <p className="font-mono">{formatCurrency(result.price)}</p>
              <p
                className={`text-sm ${
                  result.priceChangePercent >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {formatPercent(result.priceChangePercent, true)}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-wrap gap-2">
            <SetupBadge setup={primarySetup} />
            <Badge variant="outline">{primarySetup.grade}</Badge>
            <Badge variant={isLong ? "bullish" : "bearish"}>{primarySetup.bias}</Badge>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <span className="text-muted-foreground">Entry:</span>
            <span>
              {formatCurrency(primarySetup.tradeParams.entry.zone[0])} -{" "}
              {formatCurrency(primarySetup.tradeParams.entry.zone[1])}
            </span>
            <span className="text-muted-foreground">Stop:</span>
            <span>
              {formatCurrency(primarySetup.tradeParams.stop.price)} (
              {formatPercent(primarySetup.tradeParams.stop.riskPercent)})
            </span>
            <span className="text-muted-foreground">R:R T1:</span>
            <span>{primarySetup.tradeParams.riskReward.toT1.toFixed(1)}:1</span>
            <span className="text-muted-foreground">Volume:</span>
            <span
              className={
                result.volumeVsAvg >= 1.5
                  ? "text-emerald-400"
                  : result.volumeVsAvg < 1
                  ? "text-red-400"
                  : ""
              }
            >
              {result.volumeVsAvg.toFixed(1)}x avg
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
