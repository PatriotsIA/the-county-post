export const countyAtlasDomains = [
  "demographics",
  "economy",
  "housing",
  "jobs-business",
  "education",
  "health",
  "civic-elections",
  "public-safety",
  "agriculture",
  "environment-disasters",
  "government-finance",
  "infrastructure",
] as const;

export type CountyAtlasDomain = (typeof countyAtlasDomains)[number];
export type CountyAtlasValueKind = "number" | "percent" | "currency" | "index" | "duration" | "text";
export type CountyAtlasChartKind = "trend" | "comparison" | "distribution" | "composition" | "none";

export type CountyAtlasSource = {
  id: string;
  name: string;
  agency: string;
  url: string;
  cadence: string;
  methodology?: string;
  licenseNote?: string;
};

export type CountyAtlasObservation = {
  date: string;
  value: number;
};

export type CountyAtlasBenchmark = {
  geography: "state" | "nation";
  label: string;
  value: number;
};

export type CountyAtlasDistributionItem = {
  key: string;
  label: string;
  value: number;
  unit?: string;
};

export type CountyAtlasMetric = {
  key: string;
  domain: CountyAtlasDomain;
  label: string;
  description: string;
  unit: string;
  valueKind: CountyAtlasValueKind;
  chart: CountyAtlasChartKind;
  value?: number;
  displayValue?: string;
  date?: string;
  vintage?: string;
  retrievedAt?: string;
  geographyVintage?: string;
  marginOfError?: number;
  suppressed?: boolean;
  suppressionReason?: string;
  modeledEstimate?: boolean;
  preliminary?: boolean;
  revisionStatus?: "preliminary" | "revised" | "final" | "not-applicable";
  coveragePercent?: number;
  coverageNumerator?: number;
  coverageDenominator?: number;
  source: CountyAtlasSource;
  observations?: CountyAtlasObservation[];
  benchmarks?: CountyAtlasBenchmark[];
  distribution?: CountyAtlasDistributionItem[];
};

export type CountyAtlasDomainInfo = {
  slug: CountyAtlasDomain;
  label: string;
  shortLabel: string;
  description: string;
  sourceIds: string[];
  metricKeys: string[];
};

export type CountyAtlasCounty = {
  name: string;
  displayName: string;
  slug: string;
  fips: string;
  stateName: string;
  stateSlug: string;
  stateAbbr: string;
};

export type CountyAtlasDomainDocument = {
  county: CountyAtlasCounty;
  domain: CountyAtlasDomainInfo;
  metrics: CountyAtlasMetric[];
  warnings: string[];
  meta: {
    version: string;
    generatedAt: string;
    retrievedAt: string;
    sources: CountyAtlasSource[];
    partial: boolean;
    cacheTtlSeconds: number;
  };
};

export type CountyAtlasOverview = {
  county: CountyAtlasCounty;
  domains: Array<{
    domain: CountyAtlasDomainInfo;
    featuredMetrics: CountyAtlasMetric[];
    available: boolean;
    warnings: string[];
  }>;
  meta: {
    version: string;
    generatedAt: string;
    retrievedAt: string;
    sources: CountyAtlasSource[];
    partial: boolean;
    cacheTtlSeconds: number;
  };
};

export type CountyAtlasApiErrorKind =
  | "not-configured"
  | "not-found"
  | "unavailable"
  | "invalid-response";

export class CountyAtlasApiError extends Error {
  readonly kind: CountyAtlasApiErrorKind;
  readonly status?: number;

  constructor(message: string, kind: CountyAtlasApiErrorKind, status?: number) {
    super(message);
    this.name = "CountyAtlasApiError";
    this.kind = kind;
    this.status = status;
  }
}

type AtlasResponse = CountyAtlasOverview | CountyAtlasDomainDocument;
type CacheEntry = { value: AtlasResponse; expiresAt: number };
type PendingRequest = {
  promise: Promise<AtlasResponse>;
  controller: AbortController;
  subscribers: number;
  settled: boolean;
};

const responseCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, PendingRequest>();
const DEFAULT_CACHE_TTL_SECONDS = 300;
const MAX_CACHE_TTL_SECONDS = 24 * 60 * 60;

export function fetchCountyAtlasOverview(stateSlug: string, countySlug: string, signal?: AbortSignal) {
  return requestAtlas<CountyAtlasOverview>(
    `v1/counties/${encodeURIComponent(stateSlug)}/${encodeURIComponent(countySlug)}/atlas`,
    isCountyAtlasOverview,
    signal,
  );
}

export function fetchCountyAtlasDomain(
  stateSlug: string,
  countySlug: string,
  domain: CountyAtlasDomain,
  signal?: AbortSignal,
) {
  return requestAtlas<CountyAtlasDomainDocument>(
    `v1/counties/${encodeURIComponent(stateSlug)}/${encodeURIComponent(countySlug)}/atlas/${encodeURIComponent(domain)}`,
    isCountyAtlasDomainDocument,
    signal,
  );
}

async function requestAtlas<T extends AtlasResponse>(
  path: string,
  validate: (value: unknown) => value is T,
  signal?: AbortSignal,
): Promise<T> {
  const baseUrl = import.meta.env.VITE_NEWS_API_URL?.trim();
  if (!baseUrl) {
    throw new CountyAtlasApiError(
      "County data is not configured. Set VITE_NEWS_API_URL.",
      "not-configured",
    );
  }

  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(path, base).toString();
  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return withAbort(Promise.resolve(cached.value as T), signal);
  }
  if (cached) responseCache.delete(url);

  let pending = inFlightRequests.get(url);
  if (!pending) {
    const controller = new AbortController();
    const request = fetchAtlasResponse(url, validate, controller.signal);
    pending = { promise: request, controller, subscribers: 0, settled: false };
    inFlightRequests.set(url, pending);
    const current = pending;
    void request
      .finally(() => {
        current.settled = true;
        if (inFlightRequests.get(url) === current) inFlightRequests.delete(url);
      })
      .catch(() => undefined);
  }

  pending.subscribers += 1;
  const current = pending;
  return withAbort(current.promise as Promise<T>, signal).finally(() => {
    current.subscribers -= 1;
    if (!current.settled && current.subscribers === 0) current.controller.abort();
  });
}

async function fetchAtlasResponse<T extends AtlasResponse>(
  url: string,
  validate: (value: unknown) => value is T,
  signal: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { accept: "application/json" }, signal });
  } catch {
    if (signal.aborted) throw abortError();
    throw new CountyAtlasApiError(
      "County data could not be reached. Try again shortly.",
      "unavailable",
    );
  }

  const body = (await response.json().catch(() => undefined)) as unknown;
  if (!response.ok) {
    const apiMessage = getApiErrorMessage(body);
    if (response.status === 404) {
      throw new CountyAtlasApiError(
        apiMessage || "County data is not available for this county yet.",
        "not-found",
        response.status,
      );
    }
    throw new CountyAtlasApiError(
      apiMessage || "County data is temporarily unavailable.",
      "unavailable",
      response.status,
    );
  }

  if (!validate(body)) {
    throw new CountyAtlasApiError(
      "County data returned an unexpected response.",
      "invalid-response",
      response.status,
    );
  }

  const ttlSeconds = Math.min(
    Math.max(body.meta.cacheTtlSeconds || DEFAULT_CACHE_TTL_SECONDS, 0),
    MAX_CACHE_TTL_SECONDS,
  );
  responseCache.set(url, { value: body, expiresAt: Date.now() + ttlSeconds * 1_000 });
  return body;
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());

  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => {
      signal.removeEventListener("abort", handleAbort);
      reject(abortError());
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", handleAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", handleAbort);
        reject(error);
      },
    );
  });
}

function abortError() {
  return new DOMException("The county data request was aborted.", "AbortError");
}

function getApiErrorMessage(value: unknown) {
  if (!value || typeof value !== "object" || !("error" in value)) return "";
  return typeof value.error === "string" ? value.error : "";
}

function isCountyAtlasOverview(value: unknown): value is CountyAtlasOverview {
  if (!hasAtlasEnvelope(value) || !("domains" in value)) return false;
  return Array.isArray(value.domains);
}

function isCountyAtlasDomainDocument(value: unknown): value is CountyAtlasDomainDocument {
  if (!hasAtlasEnvelope(value) || !("domain" in value) || !("metrics" in value)) return false;
  return Boolean(value.domain) && Array.isArray(value.metrics);
}

function hasAtlasEnvelope(value: unknown): value is {
  county: CountyAtlasCounty;
  meta: AtlasResponse["meta"];
} {
  if (!value || typeof value !== "object" || !("county" in value) || !("meta" in value)) return false;
  const county = value.county;
  const meta = value.meta;
  return Boolean(
    county &&
      typeof county === "object" &&
      "fips" in county &&
      typeof county.fips === "string" &&
      meta &&
      typeof meta === "object" &&
      "cacheTtlSeconds" in meta &&
      typeof meta.cacheTtlSeconds === "number",
  );
}
