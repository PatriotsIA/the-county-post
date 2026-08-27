import type { CountySite } from "../data/counties";
import type { NewsFeedItem, Topic } from "./news-api";

export type CountyNativeNewsSource = {
  name: string;
  websiteUrl: string;
  feedUrl?: string;
  outletTypes: Array<"newspaper" | "radio" | "television" | "digital">;
  aliases?: string[];
  topics?: Topic[];
  counties: string[];
};

/**
 * This list mirrors the API's reviewed county-native source profiles. A source
 * without a feed still receives a site-targeted Google News search.
 */
const countyNativeNewsSources: CountyNativeNewsSource[] = [
  {
    name: "The Mena Star",
    websiteUrl: "https://www.menastar.com/",
    outletTypes: ["newspaper"],
    aliases: ["Mena Star", "MenaStar.com"],
    counties: ["arkansas/polk"],
  },
  {
    name: "My Pulse News / KENA",
    websiteUrl: "https://mypulsenews.com/",
    feedUrl: "https://mypulsenews.com/feed/",
    outletTypes: ["digital", "radio"],
    aliases: ["My Pulse News", "MyPulseNews.com", "KENA", "KENA Radio", "KENA 104.1 FM"],
    counties: ["arkansas/polk"],
  },
];

export function getCountyNativeNewsSources(county: CountySite, topic?: Topic) {
  const countyKey = `${county.state.slug}/${county.slug}`;
  return countyNativeNewsSources.filter(
    (source) => source.counties.includes(countyKey) && (!topic || !source.topics?.length || source.topics.includes(topic)),
  );
}

export function isTrustedCountyNativeNewsItem(
  item: NewsFeedItem,
  stateName: string | undefined,
  countyName: string | undefined,
) {
  if (!stateName || !countyName) return false;

  const countyKey = `${slugify(stateName)}/${slugify(countyName)}`;
  const sources = countyNativeNewsSources.filter((source) => source.counties.includes(countyKey));
  if (!sources.length) return false;

  const itemDomain = hostname(item.link);
  if (itemDomain && sources.some((source) => hostname(source.websiteUrl) === itemDomain)) return true;

  if (!isSearchAggregatorDomain(itemDomain)) return false;
  const sourceName = normalizePublisherName(item.source);
  return Boolean(
    sourceName &&
      sources.some((source) =>
        [source.name, ...(source.aliases || [])].some((alias) => normalizePublisherName(alias) === sourceName),
      ),
  );
}

function hostname(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isSearchAggregatorDomain(domain: string) {
  return domain === "news.google.com" || domain === "bing.com" || domain.endsWith(".bing.com");
}

function normalizePublisherName(value?: string) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/\bcounty\b/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
