export type FredObservation = {
  date: string;
  value: number;
};

export type CountyEconomicMetric = {
  key:
    | "unemployment-rate"
    | "median-household-income"
    | "per-capita-personal-income"
    | "gross-domestic-product"
    | "real-gross-domestic-product";
  label: string;
  description: string;
  seriesId: string;
  seriesUrl: string;
  units: string;
  frequency: "Annual";
  valueKind: "percent" | "currency" | "currency-thousands";
  source: string;
  latest: FredObservation;
  previous?: FredObservation;
  change?: {
    absolute: number;
    percent?: number;
  };
  observations: FredObservation[];
};

export type CountyEconomicData = {
  county: {
    name: string;
    displayName: string;
    slug: string;
    fips: string;
    stateName: string;
    stateSlug: string;
    stateAbbr: string;
  };
  metrics: CountyEconomicMetric[];
  meta: {
    source: "FRED";
    sourceName: string;
    sourceUrl: string;
    fetchedAt: string;
    latestObservationDate?: string;
    cacheTtlSeconds: number;
  };
};

export async function fetchCountyEconomicData(stateSlug: string, countySlug: string, signal?: AbortSignal) {
  const baseUrl = import.meta.env.VITE_NEWS_API_URL;
  if (!baseUrl) throw new Error("County economic data is not configured.");

  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(`v1/counties/${stateSlug}/${countySlug}/economic-data`, base);
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal,
  });
  const body = (await response.json().catch(() => ({}))) as CountyEconomicData & { error?: string };
  if (!response.ok) throw new Error(body.error || "County economic data is unavailable.");
  return body;
}
