import { countyJurisdictionNames } from "../data/county-geography";
import type { CountySite } from "../data/counties";
import type { StateSite } from "../data/states";
import { featuredCountyPostOpEds } from "../data/county-post-op-eds";
import { subjectPages, topicSections } from "../data/subjects";
import {
  fetchNewsApiPage,
  scopeCountyNameDistinctive,
  scopeDatelinePlaces,
  scopePlaces,
  scopeTrustedHosts,
  type NewsFeedItem,
  type PageResponse,
} from "./news-api";
import { filterApiItemsByLocality } from "./feed-locality";
import { visibleFeedEditions, visibleFeedItems } from "./fetch-visible-feeds";
import type { EarlierCoverage } from "./fetch-content";
import { plainFeedText, sharesEventContext } from "./rss";

import {
  newsQueryWords,
  recalledStory,
  searchField,
  searchWords as words,
  wordStem as stem,
  termWeight,
} from "./fetch-text-match";

const filler = new Set(
  "a about across according an and any anything are around article articles at be been briefing by can could county coverage did do does edition feed feeds find for from get give has have happening happened headline headlines here how i in into is lately latest local locally look me mention mentioning mentions my national nationwide near news of on or our paper please post remember recall heard read something saw theyre recent recently reported reports roundup rundown search show some site specific state stories story tell that the their there this to today todays top topic up update updates was were what whats when where which who why with would written you".split(
    " ",
  ),
);
const safeArticle = (item: NewsFeedItem) =>
  typeof item?.title === "string" &&
  /^https?:\/\//i.test(item.link) &&
  (!item.mediaType || item.mediaType === "article");

// When a reader points to a headline, use the desk it actually appeared on.
// Only cross edition boundaries for an exact headline or an explicit page reference.
export function editionOfVisibleHeadline(question: string, current: string) {
  const onPage = /\b(?:on (?:this|the) page|on (?:my|the) screen|I (?:can )?see)\b/i.test(question);
  const query = words(question.replace(/on (?:this|the) page|on (?:my|the) screen|I (?:can )?see/gi, ""));
  const terms = [...new Set(query.filter((w) => !filler.has(w)).map(stem))];
  if (terms.length < 2) return;
  let best: { edition: string; score: number } | undefined;
  for (const edition of visibleFeedEditions()) {
    for (const item of visibleFeedItems(edition).filter(safeArticle)) {
      const title = words(item.title);
      const exact = title.length >= 3 && (" " + query.join(" ") + " ").includes(" " + title.join(" ") + " ");
      if (!exact && !onPage) continue;
      const tokens = new Set(title.map(stem));
      const hits = terms.filter((t) => tokens.has(t)).length;
      if (!exact && (hits < 2 || hits < terms.length / 2)) continue;
      const score = (exact ? 1000 : 0) + hits + (edition === current ? 0.5 : 0);
      if (!best || score > best.score) best = { edition, score };
    }
  }
  return best?.edition;
}

export function feedExcerpt(item: NewsFeedItem, terms: string[] = []) {
  let text = plainFeedText(item.description || "");
  if (!text || words(text).join(" ") === words(item.title).join(" ")) return undefined;
  if (terms.length) {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const ranked = sentences
      .map((sentence) => {
        const field = searchField(sentence);
        return {
          sentence: sentence.trim(),
          weight: terms.reduce((n, term) => n + termWeight(term, field), 0),
        };
      })
      .sort((a, b) => b.weight - a.weight);
    if (ranked[0]?.weight) text = ranked[0].sentence;
  }
  if (text.length <= 260) return text;
  const excerpt = text.slice(0, 260).replace(/\s+\S*$/, "");
  const sentence = excerpt.match(/^.*[.!?](?=\s|$)/)?.[0];
  return sentence && sentence.length >= 55 ? sentence : excerpt + "…";
}

function ranked(
  items: NewsFeedItem[],
  terms: string[],
  localReports: Set<NewsFeedItem>,
  minimumHits: number,
) {
  const sorted = items
    .filter(safeArticle)
    .map((item) => {
      const title = searchField(item.title);
      const description = searchField(
        [plainFeedText(item.description || ""), item.source, ...(item.categories || [])]
          .filter(Boolean)
          .join(" "),
      );
      let hits = 0;
      let score = !terms.length && localReports.has(item) ? 1 : 0;
      for (const term of terms) {
        const weight = Math.max(termWeight(term, title) * 2, termWeight(term, description));
        if (weight) hits++;
        score += weight;
      }
      return { item, score, hits };
    })
    .filter(({ hits }) => hits >= minimumHits)
    .sort(
      (a, b) =>
        b.hits - a.hits ||
        b.score - a.score ||
        (articleTimestamp(b.item.publishedAt) || 0) - (articleTimestamp(a.item.publishedAt) || 0),
    );
  const selected: NewsFeedItem[] = [];
  const titles = new Set<string>();
  for (const { item } of sorted) {
    const title = words(terms.length ? item.title : item.title.split(/\s[-–—]\s/)[0]).join(" ");
    if (titles.has(title) || selected.some((other) => other.link === item.link)) continue;
    if (!terms.length && [...titles].some((other) => sharesEventContext(other, title))) continue;
    titles.add(title);
    selected.push(item);
    if (selected.length === 5) break;
  }
  return selected;
}

// Publication dates in the panel use the reader's calendar, including DST boundaries.
export function articleTimestamp(value?: string) {
  // A date-only feed value is a calendar day with no publisher time zone.
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? Date.parse(value + "T00:00:00")
    : Date.parse(value || "");
}

function publicationWindow(question: string) {
  const period = question.match(
    /\b(today|yesterday|this week|this morning|this afternoon|this evening)(?:['’]s)?\b/i,
  )?.[0];
  if (!period) return;
  const label = period.toLowerCase().replace(/['’]s$/, "");
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  if (label === "this week") start.setDate(start.getDate() - start.getDay());
  if (label === "yesterday") {
    end.setTime(start.getTime());
    start.setDate(start.getDate() - 1);
  }
  if (label === "this morning") end.setTime(new Date(start).setHours(12));
  if (label === "this afternoon") {
    start.setHours(12);
    end.setTime(new Date(start).setHours(18));
  }
  if (label === "this evening") start.setHours(18);
  return { label, phrase: period, start: start.getTime(), end: Math.min(end.getTime(), now.getTime() + 1) };
}

export async function findFeedArticles(
  question: string,
  county: CountySite | undefined,
  state: StateSite | undefined,
  signal: AbortSignal,
  onLead: (items: NewsFeedItem[]) => void,
  relatedUrl?: string,
  options: { earlier?: EarlierCoverage; refresh?: boolean; since?: number } = {},
) {
  const period = relatedUrl ? undefined : publicationWindow(question);
  const geography = [
    ...(county
      ? [...countyJurisdictionNames(county), "FIPS code " + county.fips, "FIPS " + county.fips]
      : []),
    county?.name,
    county?.primaryCity,
    ...(county?.localCities || []),
    state?.name,
    state?.abbr,
  ];
  let subject = " " + words(period ? question.replace(period.phrase, " ") : question).join(" ") + " ";
  for (const place of geography) {
    if (place) subject = subject.replaceAll(" " + words(place).join(" ") + " ", " ");
  }
  subject = subject.replace(
    /\b(?:on (?:this|the) page|on (?:my|the) screen|i (?:can )?see|yesterday(?:s)?|going on|catch me up|bring me up to date|right now|this (?:week|morning|afternoon|evening)|what(?:s| is) new|anything new|(?:my|our|the) area)\b/g,
    " ",
  );
  const terms = [
    ...new Set(
      newsQueryWords(subject.replace(recalledStory, " "))
        .filter((word) => !filler.has(word))
        .map(stem),
    ),
  ];
  const minimumHits = relatedUrl ? 1 : Math.ceil(terms.length * (recalledStory.test(question) ? 0.75 : 0.5));
  const briefing = terms.length === 0;
  const edition = county
    ? `counties/${county.state.slug}/${county.slug}`
    : state
      ? `states/${state.slug}`
      : "national";
  const path = `/v1/pages/${edition}`;
  const locality = county && {
    countyName: county.name,
    countyDisplayName: county.displayName,
    stateName: county.state.name,
    stateAbbr: county.state.abbr,
    strict: true,
  };
  const previous = new Set(options.earlier?.shownUrls);
  const cutoff = options.earlier?.before;
  let lastUpdate: number | undefined;
  let partial = false;
  let stale = false;
  const localReports = new Set<NewsFeedItem>();
  function read(page: PageResponse) {
    if (!page.sections || !Object.keys(page.sections).length) throw new Error("Feed unavailable");
    return Object.values(page.sections).flatMap((section) => {
      if (!Array.isArray(section.items) || (section.meta?.retrieval?.failed || 0) > 0) partial = true;
      if (section.meta?.stale || page.clientStale) {
        stale = true;
        const at = Date.parse(section.meta?.fetchedAt || page.meta?.fetchedAt || "");
        if (Number.isFinite(at)) lastUpdate = Math.min(lastUpdate ?? at, at);
      }
      if (page.clientStale) partial = true;
      const scope = { ...page.scope, ...section.scope };
      const places = scopePlaces(scope);
      const items = filterApiItemsByLocality(
        (section.items || []).filter(safeArticle),
        locality,
        places,
        scopeDatelinePlaces(scope),
        scopeTrustedHosts(scope),
        scopeCountyNameDistinctive(scope),
      );
      if (briefing && county) {
        const names = [county.displayName, ...places].map((place) => " " + words(place).join(" ") + " ");
        for (const item of items) {
          const body = " " + words(item.title + " " + (item.description || "")).join(" ") + " ";
          if (names.some((name) => body.includes(name))) localReports.add(item);
        }
      }
      return items;
    });
  }
  const originals = briefing
    ? []
    : featuredCountyPostOpEds.map((item) => ({
        ...item,
        link: new URL(item.link, window.location.origin).href,
        source: "County Post opinion",
      }));
  function results(items: NewsFeedItem[], partial: boolean, final = false) {
    const date = (item: NewsFeedItem) => articleTimestamp(item.publishedAt);
    const candidates = items.filter(
      (item) =>
        (options.since === undefined || (date(item) >= options.since && date(item) <= Date.now())) &&
        !previous.has(item.link) &&
        (cutoff === undefined || date(item) < cutoff) &&
        item.link !== relatedUrl &&
        !(briefing && featuredCountyPostOpEds.some((opinion) => opinion.id === item.id)),
    );
    const within = period
      ? candidates.filter((i) => date(i) >= period.start && date(i) < period.end)
      : candidates;
    const articles = ranked(within, terms, localReports, minimumHits);
    let older = false;
    if (period && final && !articles.length) {
      // Pick the most recent matching earlier report, even on a sparse desk.
      const previous = candidates
        .filter((i) => date(i) < period.start && date(i) <= Date.now())
        .sort((a, b) => date(b) - date(a))
        .find((i) => ranked([i], terms, localReports, minimumHits).length);
      if (previous) {
        articles.push(previous);
        older = true;
      }
    }
    const dates = articles.map(date).filter(Number.isFinite);
    return {
      articles,
      partial,
      stale,
      lastUpdate,
      briefing,
      period: period?.label,
      older,
      terms,
      earlierCoverage:
        !briefing && !options.earlier
          ? { shownUrls: articles.map((a) => a.link), before: dates.length ? Math.min(...dates) : undefined }
          : undefined,
    };
  }

  const mounted = () => visibleFeedItems(edition, briefing);
  const visible = results(mounted(), false);
  if (visible.articles.length) onLead(visible.articles);
  let leadItems: NewsFeedItem[] = [];
  try {
    leadItems = read(
      await fetchNewsApiPage(
        path,
        [county ? "localNews" : "general"],
        options.earlier ? 150 : county ? 50 : 32,
        options.refresh,
      ),
    );
  } catch {
    partial = true;
  }
  signal.throwIfAborted();
  const lead = results([...leadItems, ...mounted(), ...originals], partial);
  if (options.since === undefined && !options.earlier && (lead.articles.length === 5 || (briefing && lead.articles.length))) return lead;
  if (lead.articles.length) onLead(lead.articles);
  let additional: NewsFeedItem[] = [];
  try {
    const desks = [...topicSections.map((s) => s.kind), "weather"];
    const relevant = subjectPages.filter((s) => words(s.title).some((w) => terms.includes(stem(w))));
    additional = read(
      await fetchNewsApiPage(
        path,
        [...new Set([...desks, ...relevant.map((s) => s.kind)])],
        options.earlier ? 150 : 32,
        options.refresh,
      ),
    );
  } catch {
    partial = true;
  }
  signal.throwIfAborted();
  return results([...leadItems, ...additional, ...visibleFeedItems(edition), ...originals], partial, true);
}
