export type NewsFeedItem = {
  id: string;
  title: string;
  link: string;
  source?: string;
  publishedAt?: string;
  description?: string;
  imageUrl?: string;
  categories?: string[];
  mediaType?: "article" | "video" | "podcast";
};

export type Topic =
  | "general"
  | "weather"
  | "sports"
  | "politics"
  | "economy"
  | "crime"
  | "obituaries"
  | "opinion"
  | "monetary-policy"
  | "markets-investing"
  | "jobs-business"
  | "property-taxes"
  | "municipal-bonds"
  | "budgets-levies"
  | "voting-systems"
  | "election-administration"
  | "audits-recounts"
  | "open-records";

export type FeedResponse = {
  scope?: Record<string, string>;
  topic?: Topic;
  items?: NewsFeedItem[];
  meta?: {
    count: number;
    sourcesUsed?: string[];
    fetchedAt: string;
    cacheTtlSeconds: number;
  };
};

export type PageResponse = {
  scope?: Record<string, string>;
  sections?: Record<string, FeedResponse>;
  meta?: {
    count: number;
    fetchedAt: string;
    cacheTtlSeconds: number;
  };
};

const CLIENT_CACHE_MS = 60_000;
const API_FAILURE_BACKOFF_MS = 5 * 60_000;
const responseCache = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();
let apiDisabledUntil = 0;

export function isNewsApiConfigured() {
  return Boolean(newsApiBaseUrl()) && Date.now() >= apiDisabledUntil;
}

/**
 * Returns the feed's items along with the towns the API scoped it to, so the
 * browser can apply the same locality rule the server did instead of falling
 * back to "the text must contain the county's name".
 */
export async function fetchNewsApiFeed(path: string, limit: number) {
  const url = newsApiUrl(path);
  url.searchParams.set("limit", String(limit));

  const json = await fetchNewsApiJson<FeedResponse>(url);
  return {
    items: json.items || [],
    places: scopePlaces(json.scope),
    datelinePlaces: scopeDatelinePlaces(json.scope),
    trustedHosts: scopeTrustedHosts(json.scope),
    countyNameDistinctive: scopeCountyNameDistinctive(json.scope),
    hasMore: Boolean((json.meta as { hasMore?: unknown } | undefined)?.hasMore),
  };
}

/** Towns distinctive enough to identify the county on their own. */
export function scopePlaces(scope: unknown): string[] {
  return stringList(scope, "places");
}

/**
 * Towns whose names are shared across states — Palestine, Hudson, Miami — which
 * only count when written as a dateline. The API classifies them because the
 * browser has no copy of the national place corpus the split comes from.
 */
export function scopeDatelinePlaces(scope: unknown): string[] {
  return stringList(scope, "datelinePlaces");
}

/**
 * Outlets the API treats as county-local in their own right. The browser cannot
 * derive this — the registry lives on the server — and re-checking their stories
 * against place names threw most of a county's coverage away.
 */
export function scopeTrustedHosts(scope: unknown): string[] {
  return stringList(scope, "trustedHosts");
}

/** Whether the county's own name identifies it without the state alongside. */
export function scopeCountyNameDistinctive(scope: unknown): boolean {
  return (scope as { countyNameDistinctive?: unknown } | undefined)?.countyNameDistinctive === "true";
}

function stringList(scope: unknown, key: string): string[] {
  const value = (scope as Record<string, unknown> | undefined)?.[key];
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export async function fetchNewsApiPage(path: string, sections: string[], limit: number) {
  const url = newsApiUrl(path);
  url.searchParams.set("sections", sections.join(","));
  url.searchParams.set("limit", String(limit));

  return fetchNewsApiJson<PageResponse>(url);
}

export type ReviewedCountySource = {
  name: string;
  websiteUrl: string;
  outletTypes: Array<"newspaper" | "radio" | "television" | "digital">;
  aliases?: string[];
};

/**
 * The reviewed outlets for a county, straight from the API's source registry.
 * The Local Sources directory renders this rather than a frontend copy of the
 * registry — the copy drifted once and showed "no sources" on counties the
 * API already trusted outlets for.
 */
export async function fetchCountySources(stateSlug: string, countySlug: string) {
  // Deliberately not routed through fetchNewsApiJson: a failure here (say, a
  // frontend deployed ahead of the API) must not trip the global API backoff
  // and take the news feeds down with it.
  const url = newsApiUrl(`v1/sources/counties/${stateSlug}/${countySlug}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`County sources request failed ${response.status}`);
  const body = (await response.json()) as { sources: ReviewedCountySource[] };
  return body.sources;
}

function newsApiUrl(path: string) {
  const baseUrl = newsApiBaseUrl();
  if (!baseUrl) throw new Error("News API is not configured. Set VITE_NEWS_API_URL.");
  return new URL(path.replace(/^\/+/, ""), ensureTrailingSlash(baseUrl));
}

async function fetchNewsApiJson<T>(url: URL) {
  if (Date.now() < apiDisabledUntil) {
    throw new Error("News API is temporarily unavailable; using fallback RSS.");
  }

  const cacheKey = url.toString();
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.promise as Promise<T>;

  const promise = fetch(url).then(async (response) => {
    if (!response.ok) throw new Error(`News API failed ${response.status}`);
    return (await response.json()) as T;
  });
  responseCache.set(cacheKey, { expiresAt: Date.now() + CLIENT_CACHE_MS, promise });

  try {
    return await promise;
  } catch (error) {
    responseCache.delete(cacheKey);
    apiDisabledUntil = Date.now() + API_FAILURE_BACKOFF_MS;
    throw error;
  }
}

function newsApiBaseUrl() {
  return import.meta.env.VITE_NEWS_API_URL || "";
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
