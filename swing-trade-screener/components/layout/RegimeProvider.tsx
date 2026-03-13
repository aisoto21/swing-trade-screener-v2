"use client";

import { useEffect } from "react";
import { MarketRegimeBanner } from "./MarketRegimeBanner";
import { useRegimeStore } from "@/lib/stores/regimeStore";

export function RegimeProvider() {
  const { regime, lastUpdated, setRegime } = useRegimeStore();

  useEffect(() => {
    if (!regime) {
      fetch("/api/regime")
        .then((r) => r.json())
        .then((data) => {
          setRegime(data);
        })
        .catch(() => setRegime(null));
    }
  }, [regime, setRegime]);

  return <MarketRegimeBanner regime={regime} lastUpdated={lastUpdated} />;
}
