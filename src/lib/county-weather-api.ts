export type WeatherMeasurement = {
  value: number | null;
  unit: "F" | "mph" | "percent" | "degrees" | "Pa";
  source: {
    value: number | null;
    unitCode?: string;
    rawValue?: number | string | null;
  };
};

export type WeatherForecastPeriod = {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: WeatherMeasurement;
  windSpeed: WeatherMeasurement;
  windDirection?: string;
  precipitationProbability?: WeatherMeasurement;
  shortForecast?: string;
  detailedForecast?: string;
  icon?: string;
};

export type WeatherObservation = {
  stationId: string;
  stationName?: string;
  observedAt?: string;
  textDescription?: string;
  icon?: string;
  temperature?: WeatherMeasurement;
  relativeHumidity?: WeatherMeasurement;
  windSpeed?: WeatherMeasurement;
  windGust?: WeatherMeasurement;
  windDirection?: WeatherMeasurement;
  barometricPressure?: WeatherMeasurement;
};

export type WeatherAlert = {
  id: string;
  event: string;
  headline?: string;
  description?: string;
  instruction?: string;
  severity?: string;
  urgency?: string;
  certainty?: string;
  effective?: string;
  expires?: string;
  link?: string;
};

export type WeatherZone = {
  id: string;
  link: string;
};

export type DroughtCategory = "D1" | "D2" | "D3" | "D4";

export type CountyDroughtCondition = {
  category: DroughtCategory;
  label: "Moderate Drought" | "Severe Drought" | "Extreme Drought" | "Exceptional Drought";
  areaPercent: number;
  totalDroughtPercent: number;
  categories: {
    d0: number;
    d1: number;
    d2: number;
    d3: number;
    d4: number;
  };
  mapDate: string;
  validStart?: string;
  validEnd?: string;
  source: {
    name: "U.S. Drought Monitor";
    agency: string;
    url: string;
    countyUrl: string;
  };
};

export type CountyWeatherResponse = {
  county: {
    name: string;
    displayName: string;
    slug: string;
    fips: string;
    stateName: string;
    stateSlug: string;
    stateAbbr: string;
  };
  location: {
    latitude: number;
    longitude: number;
    city?: string;
    state?: string;
    gridOffice?: string;
    gridX?: number;
    gridY?: number;
    timeZone?: string;
  };
  zones: {
    forecast?: WeatherZone;
    county?: WeatherZone;
  };
  currentObservation?: WeatherObservation;
  forecast: WeatherForecastPeriod[];
  hourly: WeatherForecastPeriod[];
  alerts: WeatherAlert[];
  droughtCondition?: CountyDroughtCondition;
  warnings: string[];
  meta: {
    fetchedAt: string;
    partial: boolean;
    cacheTtlSeconds: number;
    alertsCacheTtlSeconds: number;
    pointsCacheTtlSeconds: number;
    units: {
      temperature: "F";
      windSpeed: "mph";
      precipitationProbability: "percent";
    };
    source: {
      name: "National Weather Service";
      documentation: string;
      alertsDocumentation: string;
      links: {
        points: string;
        forecast?: string;
        hourly?: string;
        observationStations?: string;
        latestObservation?: string;
        alerts: string[];
      };
    };
  };
};

export type CountyWeatherApiErrorKind =
  | "not-configured"
  | "not-found"
  | "unavailable"
  | "invalid-response";

export class CountyWeatherApiError extends Error {
  readonly kind: CountyWeatherApiErrorKind;
  readonly status?: number;

  constructor(message: string, kind: CountyWeatherApiErrorKind, status?: number) {
    super(message);
    this.name = "CountyWeatherApiError";
    this.kind = kind;
    this.status = status;
  }
}

type CacheEntry = { value: CountyWeatherResponse; expiresAt: number };
type PendingRequest = {
  promise: Promise<CountyWeatherResponse>;
  controller: AbortController;
  subscribers: number;
  settled: boolean;
};

const responseCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, PendingRequest>();
const DEFAULT_CACHE_TTL_SECONDS = 180;
const MAX_CACHE_TTL_SECONDS = 60 * 60;

export function fetchCountyWeather(stateSlug: string, countySlug: string, signal?: AbortSignal) {
  const baseUrl = import.meta.env.VITE_NEWS_API_URL?.trim();
  if (!baseUrl) {
    return Promise.reject(
      new CountyWeatherApiError(
        "County weather is not configured. Set VITE_NEWS_API_URL.",
        "not-configured",
      ),
    );
  }

  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const path = `v1/counties/${encodeURIComponent(stateSlug)}/${encodeURIComponent(countySlug)}/weather`;
  const url = new URL(path, base).toString();
  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return withAbort(Promise.resolve(cached.value), signal);
  }
  if (cached) responseCache.delete(url);

  let pending = inFlightRequests.get(url);
  if (!pending) {
    const controller = new AbortController();
    const promise = fetchWeatherResponse(url, controller.signal);
    pending = { promise, controller, subscribers: 0, settled: false };
    inFlightRequests.set(url, pending);
    const current = pending;
    void promise
      .then((weather) => {
        const responseTtl = finiteTtl(weather.meta.cacheTtlSeconds, DEFAULT_CACHE_TTL_SECONDS);
        const alertsTtl = finiteTtl(weather.meta.alertsCacheTtlSeconds, responseTtl);
        const ttlSeconds = Math.min(responseTtl, alertsTtl, MAX_CACHE_TTL_SECONDS);
        if (ttlSeconds > 0) {
          responseCache.set(url, { value: weather, expiresAt: Date.now() + ttlSeconds * 1_000 });
        }
      })
      .finally(() => {
        current.settled = true;
        if (inFlightRequests.get(url) === current) inFlightRequests.delete(url);
      })
      .catch(() => undefined);
  }

  pending.subscribers += 1;
  const current = pending;
  return withAbort(current.promise, signal).finally(() => {
    current.subscribers -= 1;
    if (!current.settled && current.subscribers === 0) {
      queueMicrotask(() => {
        if (!current.settled && current.subscribers === 0) current.controller.abort();
      });
    }
  });
}

export function selectHighestSeverityAlert(alerts: WeatherAlert[]) {
  return [...alerts].sort((left, right) => {
    const severityDifference = severityRank(left.severity) - severityRank(right.severity);
    if (severityDifference) return severityDifference;
    return timestamp(left.effective) - timestamp(right.effective) || left.id.localeCompare(right.id);
  })[0];
}

export function weatherSeverityClass(severity?: string) {
  const normalized = (severity || "unknown").toLowerCase();
  return ["extreme", "severe", "moderate", "minor"].includes(normalized) ? normalized : "unknown";
}

async function fetchWeatherResponse(url: string, signal: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(url, { headers: { accept: "application/json" }, signal });
  } catch {
    if (signal.aborted) throw abortError();
    throw new CountyWeatherApiError(
      "County weather could not be reached. Try again shortly.",
      "unavailable",
    );
  }

  const body = (await response.json().catch(() => undefined)) as unknown;
  if (!response.ok) {
    const message = getApiErrorMessage(body);
    if (response.status === 404) {
      throw new CountyWeatherApiError(
        message || "County weather is not available for this county.",
        "not-found",
        response.status,
      );
    }
    throw new CountyWeatherApiError(
      message || "County weather is temporarily unavailable.",
      "unavailable",
      response.status,
    );
  }

  if (!isCountyWeatherResponse(body)) {
    throw new CountyWeatherApiError(
      "County weather returned an unexpected response.",
      "invalid-response",
      response.status,
    );
  }
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

function finiteTtl(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function severityRank(severity?: string) {
  return ({ extreme: 0, severe: 1, moderate: 2, minor: 3, unknown: 4 } as Record<string, number>)[
    (severity || "unknown").toLowerCase()
  ] ?? 5;
}

function timestamp(value?: string) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function abortError() {
  return new DOMException("The county weather request was aborted.", "AbortError");
}

function getApiErrorMessage(value: unknown) {
  if (!value || typeof value !== "object" || !("error" in value)) return "";
  return typeof value.error === "string" ? value.error : "";
}

function isCountyWeatherResponse(value: unknown): value is CountyWeatherResponse {
  if (!value || typeof value !== "object") return false;
  if (!("county" in value) || !("location" in value) || !("zones" in value) || !("meta" in value)) return false;
  if (!("forecast" in value) || !Array.isArray(value.forecast)) return false;
  if (!("hourly" in value) || !Array.isArray(value.hourly)) return false;
  if (!("alerts" in value) || !Array.isArray(value.alerts)) return false;
  if (!("warnings" in value) || !Array.isArray(value.warnings)) return false;

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
      typeof meta.cacheTtlSeconds === "number" &&
      "alertsCacheTtlSeconds" in meta &&
      typeof meta.alertsCacheTtlSeconds === "number",
  );
}
