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
  return { items: json.items || [], places: scopePlaces(json.scope) };
}

export function scopePlaces(scope: unknown): string[] {
  const places = (scope as { places?: unknown } | undefined)?.places;
  return Array.isArray(places) ? places.filter((place): place is string => typeof place === "string") : [];
}

export async function fetchNewsApiPage(path: string, sections: string[], limit: number) {
  const url = newsApiUrl(path);
  url.searchParams.set("sections", sections.join(","));
  url.searchParams.set("limit", String(limit));

  return fetchNewsApiJson<PageResponse>(url);
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
