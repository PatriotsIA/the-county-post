import { articleTimestamp } from "./fetch-articles";
import { fetchGuideAtlasDomain, fetchGuideAtlasOverview } from "./fetch-atlas";
import { countyPostOpEds } from "../data/county-post-op-eds";
import { PANHANDLE_LEGENDS_PATH, panhandleLegendsEpisodes } from "../data/panhandle-legends";
import { subjectGroups, subjectPages, topicSections } from "../data/subjects";
import { getPartnerCreatives, getPartnersForCounty } from "../data/partners";
import { countyAdKey, isAdVisibleInCounty } from "../data/ads";
import type { CountySite } from "../data/counties";
import type { StateSite } from "../data/states";
import { type CountyAtlasMetric, type CountyAtlasDomain } from "./county-atlas-api";
import { atlasMetricVintage, atlasMetricYear, formatAtlasMetricValue, formatAtlasValue } from "./county-atlas-format";
import { fetchCountyPublicNotices, type PublicNotice, type PublicNoticesResponse } from "./public-notices";
import { fetchCountySources } from "./news-api";
import { fetchFeaturedVideos } from "./videos-api";
import { atlasDomainLinks } from "./atlas-domain-labels";
import { searchField, termWeight, wordStem, searchWords } from "./fetch-text-match";
import { atlasTopic, publishedMeasureQuestion } from "./fetch-atlas-topics";
import { getCountyTurnoutHistoryByFips } from "./turnout";
import { marketAnswer } from "./fetch-market";

export type ContentLink = {
  targetId?: string;
  title: string;
  url: string;
  credit?: string;
  publisher?: string;
  publicationDate?: string;
  excerpt?: string;
};
export type FetchOutcome = "answer" | "clarification" | "empty" | "unavailable" | "partial" | "navigation";
export type AtlasChoice = { label: string; domain: CountyAtlasDomain; metric?: string };
export type EarlierCoverage = { shownUrls: string[]; before?: number };
export type ContentResult = {
  targetId?: string;
  quoteSymbols?: string[];
  cached?: boolean;
  choices?: AtlasChoice[];
  sections?: { label: string; links: ContentLink[]; lines?: string[]; ordered?: boolean }[];
  outcome?: FetchOutcome;
  earlierCoverage?: EarlierCoverage;
  heading?: string;
  lines: string[];
  links?: ContentLink[];
  path?: string;
};
export const answerLabels = {
  changes: "Since your last visit",
  briefing: "County briefing",
  search: "Search this edition",
  weather: "County weather",
  gdp: "County economic data",
  articles: "Articles from the feeds",
  data: "County Data Atlas",
  sources: "Local sources",
  notices: "Public notices",
  videos: "Featured videos",
  catalog: "Around The County Post",
  quotes: "Market prices",
  turnout: "Show Up Meter",
};
export type AnswerRequest = {
  kind: keyof typeof answerLabels;
  cityName?: string;
  relatedUrl?: string;
  atlasChoice?: AtlasChoice;
  question: string;
  county?: CountySite;
  state?: StateSite;
};

export function storiesFor(lookup: AnswerRequest, data?: ContentResult) {
  if (lookup.kind === "briefing" || lookup.kind === "changes") return data?.sections?.find((section) => section.ordered)?.links || [];
  return lookup.kind === "articles" || lookup.kind === "search" ? data?.links || [] : [];
}

const tokens = (text: string) =>
  searchWords(text)
    .filter((w) => w.length > 1)
    .map(wordStem);
// Only County Post originals have article bodies in the site's own registry.
const opinionText = new Map(
  countyPostOpEds.map((column) => [
    column.path,
    column.paragraphs.map((text) => ({
      text,
      words: new Set(tokens(text)),
    })),
  ]),
);
function score(question: string, phrase: string) {
  const given = new Set(tokens(question));
  const needed = [...new Set(tokens(phrase))];
  const count = needed.filter((w) => given.has(w)).length;
  return count ? count + count / needed.length : 0;
}
function searchLinks(question: string, links: ContentLink[], limit = 6) {
  return links
    .map((link) => ({ link, rank: score(question, link.title) * 2 + score(question, link.credit || "") }))
    .filter((hit) => hit.rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map((hit) => hit.link);
}

// Use the same edition scope for navigation and matching. Place names alone
// should never make an unrelated page or statistical measure a search result.
function subjectTerms(question: string, county?: CountySite, state?: StateSite) {
  const stop = new Set(
    "the and can could would where what who in for of to is it this that did does do i me my our with how help find looking look search remember about on at something anything please tell show paper site county state town area here page there from get was were any else reports report articles article local an are nearby some around want know need".split(
      " ",
    ),
  );
  const geo = [
    county?.displayName,
    county?.name,
    county?.primaryCity,
    state?.name || county?.state.name,
    state?.abbr || county?.state.abbr,
  ];
  for (const name of geo) for (const word of tokens(name || "")) stop.add(word);
  return [...new Set(tokens(question).filter((w) => !stop.has(w)))];
}

function relevance(terms: string[], title: string, details = "") {
  const name = searchField(title),
    context = searchField(details);
  const scores = terms.map((term) => Math.max(2 * termWeight(term, name), termWeight(term, context)));
  return scores.filter(Boolean).length >= Math.ceil(terms.length / 2) ? scores.reduce((a, b) => a + b, 0) : 0;
}

export async function findAtlasMeasures(question: string, county: CountySite, signal: AbortSignal) {
  const terms = subjectTerms(question, county);
  const hits: { choice: AtlasChoice; rank: number }[] = [];
  let partial = false;
  if (terms.length) {
    const overview = await fetchGuideAtlasOverview(county, signal);
    if (overview.county.fips !== county.fips) throw new Error("County mismatch");
    const desks = overview.domains.filter((d) => d.available);
    // A named featured measure already has a published label, key and domain.
    // Selecting it still reads its full record, including the requested year.
    const phrase = terms.filter((word) => !/^(?:19|20)\d{2}$/.test(word)).join(" ");
    const metricName = phrase === tokens("gross rent").join(" ") ? "median " + phrase : phrase;
    if (metricName.includes(" ")) {
      const featured = desks.flatMap(({ domain, featuredMetrics }) =>
        featuredMetrics
          .filter((m) => [m.label, m.key].some((name) => tokens(name).join(" ") === metricName))
          .map((m) => ({ label: m.label, metric: m.key, domain: domain.slug })),
      );
      if (featured.length) return { choices: featured, partial: false };
    }
    // Domain documents are shared with the Atlas page cache. Read at most three
    // at once, and only for free-text discovery in an identified county.
    for (let i = 0; i < desks.length; i += 3) {
      signal.throwIfAborted();
      await Promise.all(
        desks.slice(i, i + 3).map(async ({ domain }) => {
          try {
            const doc = await fetchGuideAtlasDomain(county, domain.slug, signal);
            if (doc.county.fips !== county.fips || doc.domain.slug !== domain.slug)
              throw new Error("County mismatch");
            for (const m of doc.metrics) {
              const rank = relevance(terms, m.label, m.key + " " + (m.description || ""));
              if (rank) hits.push({ choice: { label: m.label, metric: m.key, domain: domain.slug }, rank });
            }
          } catch {
            signal.throwIfAborted();
            partial = true;
          }
        }),
      );
    }
  }
  hits.sort((a, b) => b.rank - a.rank || a.choice.label.localeCompare(b.choice.label));
  return { choices: hits.slice(0, 8).map((hit) => hit.choice), partial };
}

export function siteCatalog(question: string, county?: CountySite, state?: StateSite) {
  const base = county ? `/${county.state.slug}/${county.slug}` : state ? `/${state.slug}` : "";
  const partners = county
    ? getPartnersForCounty(countyAdKey(county.state.slug, county.slug))
    : getPartnerCreatives().filter((p) => !state || isAdVisibleInCounty(p, state.slug));
  const entries: ContentLink[] = [
    { title: "Partner and advertiser directory", url: county ? base + "/partners" : "/partners" },
    { title: "Advertise with The County Post", url: "https://www.advertise.thecountypost.com/" },
    { title: "White House News", url: "https://www.whitehouse.gov/live/" },
    { title: "About The County Post", url: "/about" },
    { title: "Privacy policy", url: "/privacy" },
    { title: "Terms of service", url: "/terms" },
    { title: "Submit a story or news tip", url: base + "/submit" },
    { title: "Find your state and county", url: "/states" },
    { title: "The Morning Post daily email newsletter", url: "/morning-post" },
    { title: "Give the gift of The Morning Post", url: "/morning-post#morning-post-gift" },
    { title: "ITM Trading and metal prices", url: "/itm-trading", credit: "Stan Roberts" },
    { title: "Panhandle Legends", url: PANHANDLE_LEGENDS_PATH },
    { title: "Opinion and op-eds", url: base + "/op-eds" },
    ...(county
      ? [
          ...atlasDomainLinks(county).map((d) => ({ title: d.label + " · County Data Atlas", url: d.to })),
          { title: "County forecast, radar and weather alerts", url: base + "/weather" },
          { title: "Public notices, meetings and hearings", url: base + "/public-notices" },
          { title: "Local newspapers and broadcasters", url: base + "/local-sources" },
          { title: "Classifieds and local listings", url: base + "/classifieds" },
          { title: "Economic data, county GDP and historical income", url: base + "/economic-data" },
        ]
      : []),
    ...panhandleLegendsEpisodes.map((e) => ({
      title: e.title,
      url: `https://vimeo.com/${e.vimeoId}`,
      credit: "Panhandle Legends video",
    })),
    ...countyPostOpEds.map((a) => ({ title: a.title, url: a.path, credit: a.byline + " · " + a.deck })),
    ...[...subjectGroups, ...subjectPages].map((s) => ({
      title: s.title,
      url: (base || "/topics") + "/" + s.slug,
      credit: s.description,
    })),
    ...topicSections.map((t) => ({
      title: t.title,
      url: (base || "/") + `#desk-${t.kind}`,
      credit: t.kicker,
    })),
    ...partners.map((p) => ({
      title: p.name,
      url: county ? base + "/partners" : "/partners",
      credit: "County Post partner",
    })),
  ];
  const terms = subjectTerms(question, county, state);
  return entries
    .map((link) => {
      const rank = relevance(terms, link.title, link.credit);
      const paragraph = terms.length
        ? opinionText.get(link.url)?.find((p) => terms.every((t) => p.words.has(t)))
        : undefined;
      if (!paragraph) return { link, rank };
      const text = paragraph.text.replaceAll("**", "");
      const index = text.toLowerCase().indexOf(terms[0]);
      const start = Math.max(0, index - 55);
      const excerpt =
        (start ? "…" : "") + text.slice(start, start + 205).trim() + (text.length > start + 205 ? "…" : "");
      return { link: { ...link, excerpt }, rank: rank + terms.length * 2 };
    })
    .filter((hit) => hit.rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 6)
    .map((hit) => hit.link);
}

export async function lookupContent(
  request: AnswerRequest,
  signal: AbortSignal,
  matchesOnly = false,
): Promise<ContentResult> {
  const { kind, question, county, state } = request;
  if (kind === "catalog") {
    const links = siteCatalog(question, county, state);
    return {
      outcome: links.length ? "answer" : "empty",
      lines: links.length ? [] : ["Try an author, headline, partner, subject, or page name."],
      links,
    };
  }
  if (kind === "videos") {
    const v = await fetchFeaturedVideos(signal);
    const named = (id: string) => v.channels.find((c) => c.id === id)?.name || "";
    const live = v.live.map((s) => ({
      title: s.title || named(s.channelId),
      url: s.watchUrl,
      credit: "Live · " + named(s.channelId),
    }));
    let links: ContentLink[] = /\blive\b/i.test(question)
      ? live
      : [...live, ...v.videos.map((s) => ({ title: s.title, url: s.watchUrl, credit: named(s.channelId) }))];
    const terms = subjectTerms(
      question.replace(
        /\b(videos?|live|streams?|featured|broadcasts?|channels?|watch|news|play|now)\b/gi,
        " ",
      ),
      county,
      state,
    );
    if (matchesOnly && !terms.length) return { lines: [] };
    links = terms.length
      ? links
          .map((link) => ({ link, rank: relevance(terms, link.title, link.credit) }))
          .filter((hit) => hit.rank > 0)
          .sort((a, b) => b.rank - a.rank)
          .slice(0, 6)
          .map((hit) => hit.link)
      : links.slice(0, 6);
    return {
      outcome: v.partial || v.stale ? "partial" : links.length ? "answer" : "empty",
      lines: [
        ...(!links.length ? ["No matching featured broadcast is listed."] : []),
        ...(v.partial || v.stale ? ["Some featured video listings may be incomplete or cached."] : []),
      ],
      links,
    };
  }
  if (kind === "quotes") return marketAnswer(request, signal);
  if (!county) throw new Error("County required");
  const base = `/${county.state.slug}/${county.slug}`;
  if (kind === "turnout") {
    const history = await getCountyTurnoutHistoryByFips(county.fips);
    const year = question.match(/\b(?:19|20)\d\d\b/)?.[0];
    const records = (year ? history.filter((e) => e.year === Number(year)) : history).slice(0, 4);
    return {
      outcome: records.length ? "answer" : "empty",
      lines: records.length
        ? records.map(
            (e) =>
              `${e.electionLabel} · ${e.turnoutPct.toFixed(1)}% turnout (${e.ballotsCast.toLocaleString()} ballots from ${e.registeredVoters.toLocaleString()} registered voters).`,
          )
        : ["No turnout record is available for this request."],
      targetId: "county-turnout",
      path: base + "/data/civic-elections",
    };
  }
  if (kind === "sources") {
    const sources = await fetchCountySources(county.state.slug, county.slug, signal);
    const terms = subjectTerms(question, county, state);
    if (matchesOnly) {
      const hits = sources
        .map((s) => ({
          s,
          rank: relevance(terms, s.name, [...(s.aliases || []), ...s.outletTypes].join(" ")),
        }))
        .filter((hit) => hit.rank > 0)
        .sort((a, b) => b.rank - a.rank);
      return {
        lines: [],
        links: hits
          .slice(0, 4)
          .map(({ s }) => ({ title: s.name, url: s.websiteUrl, credit: s.outletTypes.join(", ") })),
      };
    }
    const links = sources.map((s) => ({
      title: s.name,
      url: s.websiteUrl,
      credit: s.outletTypes.join(", "),
    }));
    const matches = searchLinks(question, links);
    return {
      outcome: links.length ? "answer" : "empty",
      lines: links.length ? [] : ["No reviewed local outlets are listed yet."],
      links: matches.length ? matches : links.slice(0, 6),
      path: base + "/local-sources",
    };
  }
  if (kind === "notices") {
    const categories = [
      { key: "meeting", words: /\b(?:meetings?|town hall|agendas?)\b/gi },
      { key: "hearing", words: /\bhearings?\b/gi },
      { key: "procurement", words: /\b(?:procurement|bids?|tenders?)\b/gi },
      { key: "tax", words: /\b(?:property tax(?:es)?|tax(?:es)?)\b/gi },
    ];
    let subject = question.replace(
      /\b(?:public|official|notices?|check|listed|published|available|please|show|when|about|next|upcoming|scheduled|are there)\b/gi,
      " ",
    );
    const wanted = categories.filter((c) => question.match(c.words));
    for (const c of wanted) subject = subject.replace(c.words, " ");
    const terms = subjectTerms(subject, county, state);
    if (matchesOnly && !wanted.length && !terms.length) return { lines: [] };
    const first = await fetchCountyPublicNotices(county);
    let page = first;
    let partial = page.meta.status === "partial" || page.meta.status === "unavailable";
    const hits: { link: ContentLink; rank: number }[] = [];
    let offset = 0;
    while (true) {
      signal.throwIfAborted();
      for (const n of page.items) {
        if (wanted.length && !wanted.some((c) => c.key === n.category || n.title.match(c.words))) continue;
        const rank = terms.length ? relevance(terms, n.title, n.sourceName) : 1;
        if (rank)
          hits.push({
            rank,
            link: {
              title: n.title,
              url: n.url,
              credit: [n.sourceName, n.category, n.geographyLabel, n.eventDate || n.publishedAt]
                .filter(Boolean)
                .join(" · "),
            },
          });
      }
      offset += page.items.length;
      if (
        (!terms.length && (!wanted.length || hits.length >= 6)) ||
        !page.items.length ||
        !page.meta.hasMore ||
        offset >= page.meta.totalAvailable
      )
        break;
      try {
        page = await fetchCountyPublicNotices(county, offset);
        if (page.meta.offset !== offset) {
          partial = true;
          break;
        }
        partial ||= page.meta.status === "unavailable" || page.meta.status === "partial";
      } catch {
        partial = true;
        break;
      }
    }
    const links = hits
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 6)
      .map((hit) => hit.link);
    const lines: string[] = [];
    if (!links.length)
      lines.push(
        first.meta.rollout === "not-yet-supported"
          ? "Notice coverage is pending for this county."
          : terms.length || wanted.length
            ? "I found no matching official notice in the records I could read."
            : "No notices are currently listed.",
      );
    if (partial) lines.push("Some notice sources were unavailable. Check the official desk for updates.");
    return {
      outcome: partial ? (links.length ? "partial" : "unavailable") : links.length ? "answer" : "empty",
      lines,
      links:
        links.length || matchesOnly
          ? links
          : first.sources.slice(0, 3).map((s) => ({ title: s.name, url: s.url, credit: s.status })),
      path: base + "/public-notices",
    };
  }
  const published = publishedMeasureQuestion(question);
  const explicit = request.atlasChoice || (published ? {domain:published.domain, metric:undefined} : atlasTopic(question));
  if (explicit?.domain === "public-safety" && explicit.metric?.includes("crime-")) {
    const release = (await import("./county-crime")).countyCrime(county);
    const metric = release.metrics.find(m => m.key === explicit.metric);
    const years = [...new Set(question.match(/\b(?:19|20)\d{2}\b/g) || [])];
    const shown = metric && (!years.length || years.includes(metric.date!.slice(0, 4)));
    const lines = shown ? [`${metric.label} · ${formatAtlasMetricValue(metric)} · ${metric.vintage}`] : [];
    if (metric) {
      for (const year of years.filter(y => !metric.date!.startsWith(y))) lines.push(`No observation for ${year} is included for this measure.`);
    } else if (release.metrics.length) {
      lines.push("This county’s release has no value for that measure.");
    }
    return {
      targetId: shown ? "atlas-" + metric.key : undefined,
      heading: "County crime statistics", lines: [...lines, ...release.warnings],
      outcome: shown ? "answer" : "empty",
      links: (metric ? [metric.source] : release.sources).map(s => ({ title: s.name, url: s.url })),
      choices: shown ? undefined : release.metrics.map(m => ({label:m.label,domain:m.domain,metric:m.key})),
      path: base + "/data/public-safety",
    };
  }
  const overview = await fetchGuideAtlasOverview(county, signal);
  if (overview.county.fips !== county.fips) throw new Error("County mismatch");
  const topic = explicit;
  const q =
    topic?.metric ||
    question
      .toLowerCase()
      .replaceAll(county.displayName.toLowerCase(), " ")
      .replaceAll(county.state.name.toLowerCase(), " ")
      .replace(
        /\b(county|state|data|how|what|in|the|of|to|people|many|is|for|here|are|statistics|rate)\b/g,
        " ",
      );
  const ranked = overview.domains
    .map(({ domain, featuredMetrics }) => ({
      domain,
      rank: Math.max(
        score(q, domain.label),
        ...domain.metricKeys.map((key) => score(q, key)),
        ...featuredMetrics.map((m) => score(q, m.label)),
      ),
    }))
    .sort((a, b) => b.rank - a.rank);
  const domain = topic?.domain || (ranked[0]?.rank ? ranked[0].domain.slug : undefined);
  if (!domain)
    return {
      outcome: "clarification",
      lines: ["Choose a data desk to see the measures published for this county."],
      choices: overview.domains.map((d) => ({ label: d.domain.label, domain: d.domain.slug })),
      path: base + "/data",
    };
  const doc = await fetchGuideAtlasDomain(county, domain, signal);
  if (doc.county.fips !== county.fips || doc.domain.slug !== domain) throw new Error("County data mismatch");
  const rankedMetrics = doc.metrics
    .map((m) => ({ m, rank: Math.max(score(q, m.key), score(q, m.label)) }))
    .sort((a, b) => b.rank - a.rank);
  const matches =
    published && !request.atlasChoice
      ? doc.metrics.filter(m => [m.label, m.key].some(label => label.toLowerCase() === published.label.toLowerCase()))
      : request.atlasChoice && !topic?.metric
      ? []
      : topic?.metric
        ? doc.metrics.filter((m) => m.key === topic.metric)
        : rankedMetrics
            .filter((hit) => hit.rank > 0 && hit.rank === rankedMetrics[0]?.rank)
            .map((hit) => hit.m);
  const path = base + "/data/" + domain;
  if (!doc.metrics.length) {
    const otherDesks = overview.domains.filter((d) => d.available && d.domain.slug !== domain);
    return {
      heading: doc.domain.label,
      outcome: "empty",
      lines: [
        `There are no published figures on this desk for ${county.displayName}.` +
          (otherDesks.length ? " You can choose another desk with figures for this county." : ""),
      ],
      choices: otherDesks.map(({ domain }) => ({ label: domain.label, domain: domain.slug })),
      path,
    };
  }
  const choices = doc.metrics.map((m) => ({ label: m.label, domain, metric: m.key }));
  if (!matches.length)
    return {
      heading: doc.domain.label,
      outcome: "clarification",
      lines: ["Choose one of the measures published on this desk."],
      path,
      choices,
    };
  const years = published ? [] : [...new Set(question.match(/\b(?:19|20)\d{2}\b/g) || [])];
  const describe = (m: CountyAtlasMetric) => {
    const latest = `${m.label} · ${formatAtlasMetricValue(m)} · ${atlasMetricVintage(m)}${!m.suppressed && m.marginOfError !== undefined ? ` (margin of error ±${formatAtlasValue(m.marginOfError, m.valueKind, m.unit)})` : ""}${m.modeledEstimate ? " · modeled estimate" : ""}${m.preliminary ? " · preliminary" : ""}`;
    if (m.suppressed) return [latest];
    const detail = (value: number) => formatAtlasValue(value, m.valueKind, m.unit);
    const lines = years.length
      ? years.flatMap((year) => {
          const points = m.observations?.filter((o) => o.date.startsWith(year)) || [];
          if (points.length) return points.map((o) => `${m.label} · ${detail(o.value)} · ${o.date}`);
          if (m.date?.startsWith(year) || m.vintage === year) return [latest];
          return [`${m.label} · No observation published for ${year}.`];
        })
      : [latest];
    if (!years.length && /trend|history|over time/i.test(question)) {
      for (const o of m.observations?.slice(-6) || []) lines.push(`${o.date} · ${detail(o.value)}`);
    }
    if (!years.length && /benchmark|compared? (?:with|to)|national average|state average/i.test(question))
      for (const b of m.benchmarks || []) lines.push(`${b.label} · ${detail(b.value)}`);
    if (!years.length && /breakdown|distribution|composition|by category/i.test(question)) {
      for (const item of m.distribution || [])
        lines.push(
          `${item.label} · ${item.value.toLocaleString("en-US")}${item.unit ? " " + item.unit : ""}`,
        );
    }
    return lines;
  };
  return {
    targetId: "atlas-" + matches[0].key,
    choices,
    lines: matches.flatMap(m => [...describe(m), ...(published ? ["Latest available · " + atlasMetricYear(m)] : []), ...(published && m.unit ? ["Unit · " + m.unit] : [])]),
    links: matches.map((m) => ({ title: m.source.name, url: m.source.url })),
    path,
  };
}

export async function meetingsPublishedSince(
  county: CountySite,
  since: number,
  signal: AbortSignal,
): Promise<ContentResult> {
  const links = new Map<string, ContentLink>();
  let partial = false;
  let offset = 0;
  while (true) {
    signal.throwIfAborted();
    let page: PublicNoticesResponse;
    try {
      page = await fetchCountyPublicNotices(county, offset);
    } catch {
      signal.throwIfAborted();
      partial = true;
      break;
    }
    if (page.meta.rollout === "not-yet-supported")
      return { lines: ["Meeting notice coverage is pending for this county."], outcome: "unavailable" };
    partial ||= page.meta.status !== "current";
    if (page.meta.offset !== offset) {
      partial = true;
      break;
    }
    for (const item of page.items) {
      if (!item.publishedAt || !["meeting", "hearing"].includes(item.category)) continue;
      const at = articleTimestamp(item.publishedAt);
      if (!(at >= since && at <= Date.now())) continue;
      links.set(item.id || [item.url, item.title, item.publishedAt].join("|"), {
        title: item.title,
        url: item.url,
        credit: [
          item.sourceName,
          "Published " + item.publishedAt,
          item.eventDate && "Meeting " + item.eventDate,
          item.geographyLabel,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }
    offset += page.items.length;
    if (!page.meta.hasMore) break;
    if (!page.items.length || offset >= page.meta.totalAvailable) {
      partial = true;
      break;
    }
  }
  return {
    links: [...links.values()],
    lines: [
      ...(!links.size ? ["No newly published meetings found in the notices checked."] : []),
      ...(partial ? ["Some notice records were unavailable."] : []),
    ],
    outcome: partial ? "partial" : links.size ? "answer" : "empty",
  };
}

export async function nextPublishedMeeting(county: CountySite, signal: AbortSignal): Promise<ContentResult> {
  let offset = 0;
  let partial = false;
  let next: { notice: PublicNotice; day: string; at: number; displayDate: string } | undefined;
  const now = new Date();
  // Date-only notices are Texas calendar dates. Timed events carry an explicit offset.
  const zone =
    county.state.abbr === "TX"
      ? ["48141", "48229"].includes(county.fips)
        ? "America/Denver"
        : "America/Chicago"
      : undefined;
  const calendar = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = calendar.format(now);
  while (true) {
    signal.throwIfAborted();
    let page: PublicNoticesResponse;
    try {
      page = await fetchCountyPublicNotices(county, offset);
    } catch (error) {
      signal.throwIfAborted();
      if (!offset) throw error;
      partial = true;
      break;
    }
    if (page.meta.rollout === "not-yet-supported")
      return { lines: ["Meeting coverage is pending for this county."], outcome: "empty" };
    partial ||= page.meta.status !== "current";
    if (page.meta.offset !== offset) {
      partial = true;
      break;
    }
    for (const item of page.items) {
      if (!item.eventDate || !["meeting", "hearing"].includes(item.category)) continue;
      const at = Date.parse(item.eventDate);
      const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(item.eventDate);
      if (!Number.isFinite(at)) continue;
      const day = dateOnly ? item.eventDate : calendar.format(at);
      if (dateOnly ? day < today : at < now.getTime()) continue;
      if (next && (next.day < day || (next.day === day && next.at <= at))) continue;
      const displayDate = new Date(at).toLocaleString(
        "en-US",
        dateOnly
          ? { dateStyle: "medium", timeZone: "UTC" }
          : {
              timeZone: zone,
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZoneName: "short",
            },
      );
      next = { notice: item, day, at, displayDate };
    }
    offset += page.items.length;
    if (!page.meta.hasMore || !page.items.length || offset >= page.meta.totalAvailable) break;
  }
  const links = next
    ? [
        {
          title: next.notice.title,
          url: next.notice.url,
          credit: [next.displayDate, next.notice.sourceName, next.notice.geographyLabel]
            .filter(Boolean)
            .join(" · "),
        },
      ]
    : [];
  const lines = next ? [] : ["No upcoming meeting was found in the published notices checked."];
  if (partial) lines.push("Some notice sources were unavailable.");
  return { links, lines, outcome: partial ? "partial" : next ? "answer" : "empty" };
}
