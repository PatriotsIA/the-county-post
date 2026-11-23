import type { FetchOutcome } from "./fetch-content";

// Only the enumerated outcome and elapsed time leave the guide. Local QA can
// listen to the same event that an explicitly instrumented preview sends to GA.
export function recordFetchOutcome(
  outcome: FetchOutcome,
  route: "local" | "unrecognized",
  started: number,
) {
  const detail = { outcome, route, duration_ms: Math.round(performance.now() - started) };
  window.dispatchEvent(new CustomEvent("fetch-pilot-outcome", { detail }));
  if (import.meta.env.VITE_FETCH_METRICS === "true")
    window.gtag?.("event", "fetch_pilot_outcome", {
      ...detail,
      page_location: window.location.origin,
      page_referrer: "",
      page_title: "Ask Fetch",
    });
}
