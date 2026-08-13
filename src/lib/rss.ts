import type { NewsFeedItem } from "./news-api";

const DEFAULT_PROVIDER_URL = "https://api.rss2json.com/v1/api.json";
const DEFAULT_MAX_ITEMS = 200;
const PROVIDER_MAX_ITEMS = 50;
const RSS_CACHE_MS = 5 * 60_000;

const feedCache = new Map<string, { expiresAt: number; promise: Promise<NewsFeedItem[]> }>();

export async function fetchNewsFeed(feedUrl: string, maxItems = DEFAULT_MAX_ITEMS): Promise<NewsFeedItem[]> {
  const cached = feedCache.get(feedUrl);
  if (cached && cached.expiresAt > Date.now()) return newest(await cached.promise, maxItems);

  const promise = fetchNewsFeedUncached(feedUrl);
  feedCache.set(feedUrl, { expiresAt: Date.now() + RSS_CACHE_MS, promise });

  try {
    return newest(await promise, maxItems);
  } catch (error) {
    feedCache.delete(feedUrl);
    throw error;
  }
}

async function fetchNewsFeedUncached(feedUrl: string): Promise<NewsFeedItem[]> {
  const localItems = await tryLocalProxy(feedUrl);
  if (localItems.length) return newest(localItems, DEFAULT_MAX_ITEMS);

  const items = await tryProvider(feedUrl);
  if (items.length) return newest(items, DEFAULT_MAX_ITEMS);

  const rawItems = await tryRawProxy(feedUrl);
  return newest(rawItems, DEFAULT_MAX_ITEMS);
}

export async function fetchNewsFeeds(feedUrls: string[], maxItems = DEFAULT_MAX_ITEMS): Promise<NewsFeedItem[]> {
  const uniqueUrls = Array.from(new Set(feedUrls.filter(Boolean)));
  const results = await Promise.all(uniqueUrls.map((feedUrl) => fetchNewsFeed(feedUrl, maxItems)));
  return newest(dedupeItems(results.flat()), maxItems);
}

async function tryLocalProxy(feedUrl: string) {
  try {
    const proxyUrl = import.meta.env.VITE_RSS_LOCAL_PROXY_URL || "";
    if (!proxyUrl) return [];

    const url = new URL(proxyUrl, window.location.origin);
    url.searchParams.set("url", feedUrl);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Local proxy failed ${response.status}`);
    return parseRssXml(await response.text());
  } catch {
    return [];
  }
}

async function tryProvider(feedUrl: string) {
  try {
    const url = new URL(import.meta.env.VITE_RSS_PROVIDER_URL || DEFAULT_PROVIDER_URL);
    const apiKey = import.meta.env.RSS_2_API || import.meta.env.VITE_RSS2JSON_API_KEY;
    url.searchParams.set("rss_url", feedUrl);
    if (apiKey) {
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("count", String(PROVIDER_MAX_ITEMS));
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Provider failed ${response.status}`);
    const json = (await response.json()) as {
      items?: {
        guid?: string;
        link?: string;
        title?: string;
        author?: string;
        pubDate?: string;
        description?: string;
        thumbnail?: string;
        content?: string;
        enclosure?: { link?: string; type?: string };
      }[];
      feed?: { title?: string };
      status?: string;
    };

    if (json.status && json.status !== "ok") throw new Error("Provider returned error");

    return (json.items || []).map((item, index) => {
      const title = decodeEntities(stripHtml(item.title || "Untitled update"));
      return {
        id: item.guid || item.link || `${item.title || "item"}-${index}`,
        title,
        link: item.link || "#",
        source: publicationSource(item.author || json.feed?.title, title),
        publishedAt: item.pubDate,
        description: decodeEntities(stripHtml(item.description || "")).slice(0, 200),
        imageUrl: imageFromItem(item),
      };
    });
  } catch {
    return [];
  }
}

async function tryRawProxy(feedUrl: string) {
  try {
    if (!import.meta.env.VITE_RSS_RAW_PROXY_URL) return [];
    const url = new URL(import.meta.env.VITE_RSS_RAW_PROXY_URL);
    url.searchParams.set("url", feedUrl);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Proxy failed ${response.status}`);
    return parseRssXml(await response.text());
  } catch {
    return [];
  }
}

function parseRssXml(xml: string) {
  const document = new DOMParser().parseFromString(xml, "text/xml");
  if (document.querySelector("parsererror")) throw new Error("Could not parse RSS");

  const rssItems = Array.from(document.querySelectorAll("item")).map((item, index) => {
    const description = text(item, "description");
    const title = decodeEntities(stripHtml(text(item, "title") || "Untitled update"));
    return {
      id: text(item, "guid") || text(item, "link") || `${text(item, "title") || "item"}-${index}`,
      title,
      link: text(item, "link") || "#",
      source: publicationSource(text(item, "source"), title),
      publishedAt: text(item, "pubDate"),
      description: decodeEntities(stripHtml(description)).slice(0, 200),
      imageUrl: imageFromRawItem(item, description),
    };
  });

  if (rssItems.length) return rssItems;

  return Array.from(document.querySelectorAll("entry")).map((entry, index) => {
    const link = entry.querySelector("link[rel='alternate']")?.getAttribute("href") || entry.querySelector("link")?.getAttribute("href") || "";
    const description = text(entry, "summary") || text(entry, "content");
    return {
      id: text(entry, "id") || link || `${text(entry, "title") || "entry"}-${index}`,
      title: decodeEntities(stripHtml(text(entry, "title") || "Untitled update")),
      link: link || "#",
      source: text(entry, "source title") || text(entry, "author name"),
      publishedAt: text(entry, "published") || text(entry, "updated"),
      description: decodeEntities(stripHtml(description)).slice(0, 200),
      imageUrl: imageFromRawItem(entry, description),
    };
  });
}

function text(item: Element, selector: string) {
  const parts = selector.split(" ");
  if (parts.length > 1) {
    return parts.reduce<Element | undefined>((element, part) => element?.getElementsByTagName(part)[0], item)?.textContent?.trim() || "";
  }
  return item.getElementsByTagName(selector)[0]?.textContent?.trim() || "";
}

function imageFromRawItem(item: Element, description: string) {
  const mediaThumbnail = item.getElementsByTagName("media:thumbnail")[0]?.getAttribute("url");
  if (mediaThumbnail) return mediaThumbnail;

  const mediaContent = item.getElementsByTagName("media:content")[0];
  if (mediaContent?.getAttribute("type")?.startsWith("image/")) {
    return mediaContent.getAttribute("url") || "";
  }

  const enclosure = item.getElementsByTagName("enclosure")[0];
  if (enclosure?.getAttribute("type")?.startsWith("image/")) {
    return enclosure.getAttribute("url") || "";
  }
  return description.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || "";
}

function imageFromItem(item: { thumbnail?: string; content?: string; enclosure?: { link?: string; type?: string } }) {
  if (item.thumbnail) return item.thumbnail;
  if (item.enclosure?.type?.startsWith("image/")) return item.enclosure.link || "";
  return item.content?.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || "";
}

function publicationSource(source: string | undefined, title: string) {
  const normalizedSource = source?.trim() || "";
  if (normalizedSource && !isAggregatorSource(normalizedSource)) return normalizedSource;

  const titleParts = title.split(/\s[-–—]\s/).map((part) => part.trim()).filter(Boolean);
  return titleParts.length > 1 ? titleParts.at(-1) || normalizedSource : normalizedSource;
}

function isAggregatorSource(source: string) {
  const normalized = source.toLowerCase();
  return normalized.includes("google news") || normalized.includes("bing news") || normalized.includes("news.google.com");
}

function newest(items: NewsFeedItem[], maxItems: number) {
  return [...items]
    .sort((a, b) => (timestamp(b.publishedAt) ?? 0) - (timestamp(a.publishedAt) ?? 0))
    .slice(0, maxItems);
}

function dedupeItems(items: NewsFeedItem[]) {
  const accepted: Array<{ link: string; title: string; image: string; item: NewsFeedItem }> = [];
  return items.filter((item) => {
    const title = normalizeTitle(item.title, item.source);
    const link = normalizeDedupeKey(item.link);
    const image = normalizeImageKey(item.imageUrl);
    if (accepted.some((existing) => existing.link === link || (image && existing.image === image) || isNearDuplicate(item, title, existing.item, existing.title))) return false;
    accepted.push({ link, title, image, item });
    return true;
  });
}

function normalizeTitle(value: string, source?: string) {
  const sourceSuffix = source ? ` - ${source}`.toLowerCase() : "";
  const withoutSource = sourceSuffix && value.toLowerCase().endsWith(sourceSuffix) ? value.slice(0, -sourceSuffix.length) : value;
  const headline = withoutSource.split(/\s[-–—]\s/)[0] || withoutSource;
  return headline
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isNearDuplicate(item: NewsFeedItem, title: string, existingItem: NewsFeedItem, existingTitle: string) {
  if (!title || !existingTitle) return false;
  if (title === existingTitle || title.includes(existingTitle) || existingTitle.includes(title)) return true;

  const titleSimilarity = tokenSimilarity(title, existingTitle);
  if (titleSimilarity >= 0.82) return true;
  if (samePublisher(item, existingItem) && sharesEventContext(title, existingTitle)) return true;

  if (!isDvidsItem(item) || !isDvidsItem(existingItem)) return false;
  const description = normalizeTitle(item.description || "");
  const existingDescription = normalizeTitle(existingItem.description || "");
  return description.length >= 36 && existingDescription.length >= 36 && tokenSimilarity(description, existingDescription) >= 0.72;
}

function tokenSimilarity(left: string, right: string) {
  const leftTokens = new Set(left.split(" ").filter((token) => token.length > 2));
  const rightTokens = new Set(right.split(" ").filter((token) => token.length > 2));
  if (!leftTokens.size || !rightTokens.size) return 0;

  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return shared / (leftTokens.size + rightTokens.size - shared);
}

function sharesEventContext(left: string, right: string) {
  const leftTokens = new Set(left.split(" ").map(stemToken).filter((token) => token.length > 2));
  const rightTokens = new Set(right.split(" ").map(stemToken).filter((token) => token.length > 2));
  const shared = [...leftTokens].filter((token) => rightTokens.has(token));
  return shared.length >= 3 && shared.some((token) => !genericStoryTokens.has(token));
}

function stemToken(token: string) {
  if (token.startsWith("escape")) return "escape";
  return token.replace(/(ing|ed|es|s)$/u, "");
}

const genericStoryTokens = new Set(["county", "local", "news", "official", "officials", "report", "update", "today"]);

function samePublisher(left: NewsFeedItem, right: NewsFeedItem) {
  const leftPublisher = publisherKey(left.source);
  const rightPublisher = publisherKey(right.source);
  return Boolean(leftPublisher && leftPublisher === rightPublisher);
}

function publisherKey(value?: string) {
  return (value || "")
    .toLowerCase()
    .replace(/\b(the|north|south|east|west|northeast|northwest|southeast|southwest)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isDvidsItem(item: NewsFeedItem) {
  return Boolean(item.source?.toLowerCase().includes("dvids") || item.link.toLowerCase().includes("dvidshub.net"));
}

function normalizeImageKey(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.toLowerCase().replace(/\s+/g, "");
  }
}

function normalizeDedupeKey(value: string) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.toLowerCase().replace(/\s+/g, " ").trim();
  }
}

function timestamp(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? undefined : parsed;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
