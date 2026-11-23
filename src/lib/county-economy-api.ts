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

export function economicObservation(metric: CountyEconomicMetric, year?: string) {
  const point = !year || metric.latest?.date.startsWith(year)
    ? metric.latest
    : metric.observations?.find(o => o.date.startsWith(year)) ?? (metric.previous?.date.startsWith(year) ? metric.previous : undefined);
  return point && Number.isFinite(point.value) ? point : undefined;
}

export function formatMetricValue(metric: CountyEconomicMetric) {
  if (metric.valueKind === "percent") {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(metric.latest.value)}%`;
  }
  const value = metric.valueKind === "currency-thousands" ? metric.latest.value * 1_000 : metric.latest.value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: metric.valueKind === "currency-thousands" ? "compact" : "standard",
    maximumFractionDigits: metric.valueKind === "currency-thousands" ? 1 : 0,
  }).format(value);
}
