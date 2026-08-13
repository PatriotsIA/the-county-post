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
    "monetary-policy": ["inflation", "interest rates", "Federal Reserve", "central bank", "currency policy"],
    "markets-investing": ["markets", "commodities", "stocks", "bonds", "investing"],
    "jobs-business": ["jobs", "employment", "small business", "industry", "economic development"],
    "property-taxes": ["property taxes", "property tax", "assessment", "appraisal", "tax levy", "homestead exemption"],
    "municipal-bonds": ["municipal bond", "school bond", "public debt", "bond election"],
    "budgets-levies": ["public budget", "county budget", "city budget", "school budget", "tax rate"],
    "voting-systems": ["voting systems", "ballot processing", "voting equipment", "ballot certification"],
    "election-administration": ["election administration", "election office", "polling place", "voter registration"],
    "audits-recounts": ["election audit", "recount", "canvass", "post-election review"],
    "open-records": ["public records", "open records", "FOIA", "government transparency"],
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
    "monetary-policy": ["inflation", "interest rates", "Federal Reserve", "central bank", "currency policy"],
    "markets-investing": ["markets", "commodities", "stocks", "bonds", "investing"],
    "jobs-business": ["jobs", "employment", "small business", "industry", "economic development"],
    "property-taxes": ["property taxes", "property tax", "assessment", "appraisal", "tax levy", "homestead exemption"],
    "municipal-bonds": ["municipal bond", "school bond", "public debt", "bond election"],
    "budgets-levies": ["public budget", "county budget", "city budget", "school budget", "tax rate"],
    "voting-systems": ["voting systems", "ballot processing", "voting equipment", "ballot certification"],
    "election-administration": ["election administration", "election office", "polling place", "voter registration"],
    "audits-recounts": ["election audit", "recount", "canvass", "post-election review"],
    "open-records": ["public records", "open records", "FOIA", "government transparency"],
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

type CountyFallbackKind =
  | "localNews"
  | "localSports"
  | "obituaries"
  | "politics"
  | "economy"
  | "crime"
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

function countyDisambiguationExclusions(countyName: string, stateAbbr: string) {
  return getOtherStatesWithCountyName(countyName, stateAbbr)
    .map((state) => `-"${countyName} County ${state.name}" -"${countyName} County ${state.abbr}"`)
    .join(" ");
}

function countyScopedTerms(countyName: string, state: StateSite) {
  const exclusions = isAmbiguousCountyName(countyName) ? countyDisambiguationExclusions(countyName, state.abbr) : "";
  return `("${countyName} County" "${state.name}" OR "${countyName} County" "${state.abbr}") ${exclusions}`.trim();
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
    case "monetary-policy":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["inflation", "interest rates", "Federal Reserve", "central bank", "currency policy"]));
    case "markets-investing":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["markets", "commodities", "stocks", "bonds", "investing"]));
    case "jobs-business":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["jobs", "employment", "small business", "industry", "economic development"]));
    case "property-taxes":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["property taxes", "property tax", "assessment", "appraisal", "tax levy", "homestead exemption"]));
    case "municipal-bonds":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["municipal bond", "school bond", "public debt", "bond election"]));
    case "budgets-levies":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["public budget", "county budget", "city budget", "school budget", "tax rate"]));
    case "voting-systems":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["voting systems", "ballot processing", "voting equipment", "ballot certification"]));
    case "election-administration":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["election administration", "election office", "polling place", "voter registration"]));
    case "audits-recounts":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["election audit", "recount", "canvass", "post-election review"]));
    case "open-records":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["public records", "open records", "FOIA", "government transparency"]));
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
    case "monetary-policy":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["inflation", "interest rates", "Federal Reserve", "currency policy"]));
    case "markets-investing":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["markets", "commodities", "stocks", "bonds", "investing"]));
    case "jobs-business":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["jobs", "employment", "business", "industry"]));
    case "property-taxes":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["property taxes", "property tax", "assessment", "appraisal", "tax levy"]));
    case "municipal-bonds":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["municipal bond", "school bond", "public debt", "bond election"]));
    case "budgets-levies":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["public budget", "county budget", "city budget", "school budget", "tax rate"]));
    case "voting-systems":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["voting systems", "ballot processing", "voting equipment"]));
    case "election-administration":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["election administration", "election office", "polling place", "voter registration"]));
    case "audits-recounts":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["election audit", "recount", "canvass"]));
    case "open-records":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["public records", "open records", "FOIA", "government transparency"]));
  }
}
