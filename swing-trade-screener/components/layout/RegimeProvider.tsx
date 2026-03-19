"use client";

import { useEffect, useCallback } from "react";
import { MarketRegimeBanner } from "./MarketRegimeBanner";
import { useRegimeStore } from "@/lib/stores/regimeStore";

export function RegimeProvider() {
  const { regime, breadth, lastUpdated, setRegime } = useRegimeStore();

  const fetchRegime = useCallback(() => {
    fetch("/api/regime")
      .then((r) => r.json())
      .then((data) => setRegime(data))
      .catch(() => setRegime(null));
  }, [setRegime]);

  useEffect(() => {
    // Fetch immediately on mount
    if (!regime) fetchRegime();

    // Poll every 5 minutes to keep regime fresh
    const interval = setInterval(fetchRegime, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchRegime, regime]);

  return <MarketRegimeBanner regime={regime} breadth={breadth} lastUpdated={lastUpdated} />;
}
