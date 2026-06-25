export type NewsFeedItem = {
  id: string;
  title: string;
  link: string;
  source?: string;
  publishedAt?: string;
  description?: string;
  imageUrl?: string;
};

const DEFAULT_PROVIDER_URL = "https://api.rss2json.com/v1/api.json";
const DEFAULT_RAW_PROXY_URL = "https://api.allorigins.win/raw";
const MAX_ITEMS = 24;

export async function fetchNewsFeed(feedUrl: string): Promise<NewsFeedItem[]> {
  const items = await tryProvider(feedUrl);
  if (items.length) return newest(items);

  const rawItems = await tryRawProxy(feedUrl);
  return newest(rawItems);
}

async function tryProvider(feedUrl: string) {
  try {
    const url = new URL(import.meta.env.VITE_RSS_PROVIDER_URL || DEFAULT_PROVIDER_URL);
    url.searchParams.set("rss_url", feedUrl);
    if (import.meta.env.VITE_RSS2JSON_API_KEY) {
      url.searchParams.set("api_key", import.meta.env.VITE_RSS2JSON_API_KEY);
      url.searchParams.set("count", String(MAX_ITEMS));
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
        enclosure?: { link?: string; type?: string };
      }[];
      feed?: { title?: string };
      status?: string;
    };

    if (json.status && json.status !== "ok") throw new Error("Provider returned error");

    return (json.items || []).map((item, index) => ({
      id: item.guid || item.link || `${item.title || "item"}-${index}`,
      title: decodeEntities(stripHtml(item.title || "Untitled update")),
      link: item.link || "#",
      source: item.author || json.feed?.title,
      publishedAt: item.pubDate,
      description: decodeEntities(stripHtml(item.description || "")).slice(0, 200),
      imageUrl: imageFromItem(item),
    }));
  } catch {
    return [];
  }
}

async function tryRawProxy(feedUrl: string) {
  try {
    const url = new URL(import.meta.env.VITE_RSS_RAW_PROXY_URL || DEFAULT_RAW_PROXY_URL);
    url.searchParams.set("url", feedUrl);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Proxy failed ${response.status}`);
    const xml = await response.text();

    const document = new DOMParser().parseFromString(xml, "text/xml");
    if (document.querySelector("parsererror")) throw new Error("Could not parse RSS");

    return Array.from(document.querySelectorAll("item")).map((item, index) => {
      const description = text(item, "description");
      return {
        id: text(item, "guid") || text(item, "link") || `${text(item, "title") || "item"}-${index}`,
        title: stripHtml(text(item, "title") || "Untitled update"),
        link: text(item, "link") || "#",
        source: text(item, "source"),
        publishedAt: text(item, "pubDate"),
        description: stripHtml(description).slice(0, 200),
        imageUrl: imageFromRawItem(item, description),
      };
    });
  } catch {
    return [];
  }
}

function text(item: Element, tag: string) {
  return item.getElementsByTagName(tag)[0]?.textContent?.trim() || "";
}

function imageFromRawItem(item: Element, description: string) {
  const enclosure = item.getElementsByTagName("enclosure")[0];
  if (enclosure?.getAttribute("type")?.startsWith("image/")) {
    return enclosure.getAttribute("url") || "";
  }
  return description.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || "";
}

function imageFromItem(item: { thumbnail?: string; enclosure?: { link?: string; type?: string } }) {
  if (item.thumbnail) return item.thumbnail;
  if (item.enclosure?.type?.startsWith("image/")) return item.enclosure.link || "";
  return "";
}

function newest(items: NewsFeedItem[]) {
  return [...items]
    .sort((a, b) => (timestamp(b.publishedAt) ?? 0) - (timestamp(a.publishedAt) ?? 0))
    .slice(0, MAX_ITEMS);
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
