import { useEffect, useState } from "react";
import { fetchMetalsTicker, type MetalsTickerResponse } from "./markets-api";

export function useMetalsPrices(active = true) {
  const [ticker, setTicker] = useState<MetalsTickerResponse>();
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!active || document.visibilityState === "hidden") return;
    let mounted = true;
    setStatus("loading");
    fetchMetalsTicker()
      .then(data => { if (mounted) { setTicker(data); setStatus("loaded"); } })
      .catch(() => { if (mounted) setStatus("error"); });
    return () => { mounted = false; };
  }, [active, refresh]);

  useEffect(() => {
    if (!active) return;
    const check = () => {
      setNow(Date.now());
      if (document.visibilityState === "visible") setRefresh(value => value + 1);
    };
    const timer = window.setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, [active]);

  const expired = ticker?.items.some(item => now - Date.parse(item.quotedAt) > 4 * 86400_000);
  const data = expired ? undefined : ticker;
  const stale = Boolean(data && (status === "error" || data.stale ||
    now - Date.parse(data.fetchedAt) > 120_000 ||
    data.items.some(item => now - Date.parse(item.quotedAt) > 15 * 60_000)));
  return {
    ticker: data, status: expired ? "error" as const : status, stale, now,
    refresh: () => { setNow(Date.now()); setRefresh(value => value + 1); },
  };
}
