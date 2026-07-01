export type NewsFeedItem = {
  id: string;
  title: string;
  link: string;
  source?: string;
  publishedAt?: string;
  description?: string;
  imageUrl?: string;
  mediaType?: "article" | "video" | "podcast";
};

export type Topic = "general" | "sports" | "politics" | "economy" | "crime" | "obituaries" | "opinion";

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
const responseCache = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();

export function isNewsApiConfigured() {
  return Boolean(newsApiBaseUrl());
}

export async function fetchNewsApiFeed(path: string, limit: number) {
  const url = newsApiUrl(path);
  url.searchParams.set("limit", String(limit));

  const json = await fetchNewsApiJson<FeedResponse>(url);
  return json.items || [];
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
    throw error;
  }
}

function newsApiBaseUrl() {
  return import.meta.env.VITE_NEWS_API_URL || "";
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
