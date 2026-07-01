import { getOtherStatesWithCountyName, isAmbiguousCountyName } from "../data/county-name-index";
import { getCountyMarketCities, type CountySite } from "../data/counties";
import { stateNewsHubs } from "../data/state-news-hubs";
import type { StateSite } from "../data/states";
import type { Topic } from "./news-api";

const GOOGLE_NEWS_RSS_SEARCH = "https://news.google.com/rss/search";

function googleNewsRssUrl(query: string) {
  const url = new URL(GOOGLE_NEWS_RSS_SEARCH);
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");
  return url.toString();
}

export function buildNationalFallbackFeedUrls(kind: Topic) {
  const topics: Record<Topic, string[]> = {
    general: ["United States news", "U.S. news", "national news", "breaking news"],
    sports: ["United States sports", "NFL", "NBA", "MLB", "college sports", "high school sports"],
    politics: ["United States politics", "Congress", "White House", "federal government", "elections"],
    economy: ["United States economy", "business", "jobs", "housing market", "markets", "Federal Reserve"],
    crime: ["United States crime", "courts", "justice department", "police", "public safety"],
    obituaries: ["United States obituaries", "obituary", "funeral", "death notice"],
    opinion: ["United States opinion", "editorial", "column", "commentary", "op-ed"],
  };

  return [
    googleNewsRssUrl(`(${topics[kind].join(" OR ")})`),
    googleNewsRssUrl(`"United States" (${topics[kind].join(" OR ")})`),
  ];
}

export function buildStateFallbackFeedUrls(state: StateSite, kind: Topic) {
  if (kind === "general") {
    const hubs = stateNewsHubs[state.slug] || [];
    return [
      googleNewsRssUrl(`"${state.name}" ("news" OR "politics" OR "legislature" OR "governor" OR "economy" OR "crime")`),
      googleNewsRssUrl(`"${state.name}" ("breaking news" OR "top stories" OR "local news")`),
      googleNewsRssUrl(`"${state.name}" ("state legislature" OR "governor" OR "attorney general" OR "supreme court")`),
      ...hubs.map((hub) => googleNewsRssUrl(`"${hub.city} ${state.name}" OR "${hub.city} ${state.abbr}"`)),
    ];
  }

  const topics: Record<Exclude<Topic, "general">, string[]> = {
    sports: ["sports", "high school sports", "college sports", "football", "basketball", "baseball"],
    politics: ["politics", "election", "legislature", "governor", "attorney general", "supreme court"],
    economy: ["economy", "business", "jobs", "housing market", "development", "industry"],
    crime: ["crime", "courts", "police", "sheriff", "arrests", "trial"],
    obituaries: ["obituaries", "obituary", "funeral home", "death notice"],
    opinion: ["opinion", "editorial", "column", "commentary", "op-ed"],
  };

  const topicQuery = topics[kind].join(" OR ");
  const hubs = stateNewsHubs[state.slug] || [];
  return [
    googleNewsRssUrl(`"${state.name}" (${topicQuery})`),
    googleNewsRssUrl(`"${state.abbr}" "${state.name}" (${topicQuery})`),
    ...hubs.map((hub) => googleNewsRssUrl(`"${hub.city} ${state.name}" (${topicQuery})`)),
  ];
}

export function buildCountyFallbackFeedUrls(county: CountySite, kind: Topic) {
  const marketCities = getCountyMarketCities(county, 3);
  const countyKind = topicToCountyKind(kind);
  return Array.from(
    new Set([
      buildCountyFeedUrl(countyKind, county.name, county.state),
      ...marketCities.map((city) => buildMarketFeedUrl(countyKind, city, county.state)),
    ]),
  );
}

function topicToCountyKind(kind: Topic) {
  if (kind === "general") return "localNews";
  if (kind === "sports") return "localSports";
  return kind;
}

type CountyFallbackKind = "localNews" | "localSports" | "obituaries" | "politics" | "economy" | "crime" | "opinion";

function countyDisambiguationExclusions(countyName: string, stateAbbr: string) {
  return getOtherStatesWithCountyName(countyName, stateAbbr)
    .map((state) => `-"${countyName} County ${state.name}" -"${countyName} County ${state.abbr}"`)
    .join(" ");
}

function countyScopedTerms(countyName: string, state: StateSite) {
  const exclusions = countyDisambiguationExclusions(countyName, state.abbr);
  if (isAmbiguousCountyName(countyName)) {
    return `"${countyName} County ${state.name}" OR "${countyName} County ${state.abbr}" OR "${countyName} ${state.abbr}" ${exclusions}`.trim();
  }
  return `${countyName} County ${state.name} OR ${countyName} ${state.abbr} ${exclusions}`.trim();
}

function scopedTopicQuery(scopedPlace: string, topics: string[]) {
  return `(${scopedPlace}) (${topics.join(" OR ")})`;
}

function buildCountyFeedUrl(kind: CountyFallbackKind, countyName: string, state: StateSite) {
  const scoped = countyScopedTerms(countyName, state);

  switch (kind) {
    case "localNews":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["local news", "community news"]));
    case "localSports":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["high school sports", "college sports", "football", "basketball", "baseball", "softball"]));
    case "obituaries":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["obituaries", "obituary", "funeral home", "death notice"]));
    case "politics":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["politics", "council", "commission", "elections", "ballot"]));
    case "economy":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["economy", "jobs", "unemployment", "housing market", "business"]));
    case "crime":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["crime", "courts", "sheriff", "police", "arrests"]));
    case "opinion":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["opinion", "editorial", "column"]));
  }
}

function buildMarketFeedUrl(kind: CountyFallbackKind, placeName: string, state: StateSite) {
  const scopedPlace = `"${placeName} ${state.name}" OR "${placeName} ${state.abbr}"`;

  switch (kind) {
    case "localNews":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["local news"]));
    case "localSports":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["sports", "high school sports", "college sports"]));
    case "obituaries":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["obituaries", "funeral home"]));
    case "politics":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["politics", "city council", "elections"]));
    case "economy":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["economy", "jobs", "business"]));
    case "crime":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["crime", "police", "sheriff", "courts"]));
    case "opinion":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["opinion", "editorial", "column"]));
  }
}
