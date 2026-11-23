import { marketRequest } from "../data/market-instruments";
import { getExactSearchState, searchCounties } from "../data/place-search";
import { states } from "../data/states";
import { countyJurisdictionNames } from "../data/county-geography";
import { counties, type CountySite } from "../data/counties";
import type { FetchDesk, FetchIntent } from "../data/fetch-guide";

import { subjectGroups, subjectPages, topicSections } from "../data/subjects";
import { recalledStory } from "./fetch-text-match";
import { atlasTopic } from "./fetch-atlas-topics";

const aliases: [FetchIntent, RegExp][] = [
  ["tour", /\b(tour|tutorial|walkthrough|show me around|how (?:do i|to) use)\b/i],
  [
    "articles",
    /\b(articles?|news stor(?:y|ies)|stories|headlines?|news (?:about|on)|coverage (?:of|about|on)|search (?:the )?feeds?|latest on|reported on)\b/i,
  ],
  [
    "turnout",
    /\b(turnout|turn out|show up meter|registered voters|ballots cast|how many (?:people |folks )?(?:voted|went to the polls))\b/i,
  ],
  [
    "catalog",
    /\b(op[ -]?eds?|panhandle legends|partners?|advertis(?:e|er|ing)|privacy|terms of service|sponsors?|itm trading)\b/i,
  ],
  ["videos", /\b(videos?|live streams?|watch live|channels?)\b/i],
  ["gdp", /\b(gdp|gross domestic product)\b/i],
  [
    "data",
    /\b(population|median age|households?|income|unemployment|poverty|housing|rent|homeownership|commute|house value|home values?|internet|broadband|uninsured|disability|disaster declarations?|school enrollment|how many (?:people|residents)|gini|commut(?:e|ers)|labor force|bachelor|work from home|vacancy|health data|housing data|veterans|traffic deaths|education data|agricultur(?:al|e) data)\b/i,
  ],
  ["notices", /\b(public notices?|meetings?|hearings?|procurement|bids)\b/i],
  [
    "weather",
    /\b(weather|wether|fore?casts?|umbrella|need (?:a |my )?coat|humid(?:ity)?|wind speed|rain(?:fall)?|temperature|snow|sunny|windy|hot|cold|radar|drought|storms?)\b/i,
  ],
  ["sources", /\b(local sources?|newspapers?|publishers?|news outlets?)\b/i],
  ["classifieds", /\b(classifieds?|listings?|marketplace|for sale|sell something|sell my)\b/i],
  [
    "newsletter",
    /\b(morning post|newsletters?|subscribe|daily email|paper (?:by|via) email|email (?:me )?the (?:paper|news))\b/i,
  ],
  ["submit", /\b(submit|story tip|news tip|post a tip|send (?:a |my )?story)\b/i],
  ["data", /\b(atlas|statistics|county data|population|demographics)\b/i],
  ["elections", /\b(elections?|voting)\b/i],
  ["markets", /\b(economy|markets|business news)\b/i],
  ["taxes", /\b(taxes|public finance|levies|bonds)\b/i],
  [
    "edition",
    /\b(county home|county front page|find my county|change (?:my )?county|switch (?:my )?county)\b/i,
  ],
  [
    "articles",
    /\b(news|briefing|roundup|rundown|catch me up|going on|what(?:['’]s| is| has)? (?:happened|happening|new)|anything (?:new|happened|happening))\b/i,
  ],
];

/** Match a request for a desk by its printed title or an everyday name. */
export function editorialDesk(question: string) {
  const name = question
    .toLowerCase()
    .split(/\s+(?:for|in)\s+/)[0]
    .replace(
      /^(?:please )?(?:open|take me to|go to|find|where (?:are|is)|where (?:can|do) i find|show me)\s+/,
      "",
    )
    .replace(/^(?:the |local )+/, "")
    .replace(/(?: desk| section| page)?[?!.]*$/, "")
    .trim();
  const alias = name.replace(/^obits?$/, "obituaries").replace(/^(?:sports scores|scores)$/, "sports");
  const topic = topicSections.find((t) => t.kind === alias || t.title.toLowerCase() === alias);
  if (topic) return { title: topic.title, path: "#desk-" + topic.kind };
  const subject = [...subjectGroups, ...subjectPages].find(
    (s) => s.slug === alias.replaceAll(" ", "-") || s.title.toLowerCase() === alias,
  );
  if (subject) return { title: subject.title, path: "/" + subject.slug };
}

export function localIntent(question: string) {
  if (/\b(?:since (?:my|the) last visit|(?:what(?:’s|'s| is| has)? (?:changed|new)|updates?) since)\b/i.test(question)) return "changes";
  if (/\bsearch (?:the |this )?(?:whole |entire )?(?:site|edition|paper) (?:for|about)\b/i.test(question))
    return "search";
  // Read the requested action before matching a subject like "story" or "rent".
  if (/\b(?:buy|gift|start|renew|sign up for) (?:a |my |an )?(?:subscription|newsletter)\b/i.test(question))
    return "newsletter";
  if (
    /\b(?:email|inbox|deliver(?:ed|y)?)\b/i.test(question) &&
    /\b(?:morning|daily|news|paper|headlines|subscription)\b/i.test(question) &&
    !/\b(?:newsroom|tip|editor)\b/i.test(question)
  )
    return "newsletter";
  if (
    /\b(?:submit|send|share|pitch|report) (?:in |you |the paper |the editor )?(?:my |a |an |this |our |the )?(?:story|article|tip|news tip|story idea)\b|\b(?:tell|contact) (?:the |your )?(?:newsroom|editor)\b/i.test(
      question,
    )
  )
    return "submit";
  if (
    /\b(?:who|what (?:outlets|papers)|which (?:outlets|papers))\b.{0,28}\b(?:writes?|covers?|publishes|reports?)\b.{0,45}\b(?:area|county|town|news|here|locally)\b|\b(?:papers?|journalists?|newsrooms?|reporters?|outlets) (?:near me|around here|in (?:my|this|our) (?:area|town|county))\b/i.test(
      question,
    )
  )
    return "sources";
  if (
    /^(?:please )?(?:open|take me to|go to|navigate to|bring me to) (?:the )?(?:local headlines|local news)\s*(?:[.!?]?$|(?:in|for)\b)/i.test(
      question,
    )
  )
    return "edition";
  if (recalledStory.test(question)) return "articles";
  if (
    /^\s*(?:please )?(?:catch me up|give me (?:a |my )?(?:county |local )?briefing)(?:[.!?]*$| (?:in|for|on)\b)/i.test(
      question,
    )
  )
    return "briefing";
  if (editorialDesk(question)) return "catalog";
  if (aliases.find(([intent]) => intent === "articles")?.[1].test(question)) return "articles";
  if (
    /\b(?:i (?:want|need|would like) to|can i|could i|do i|to) (?:buy|sell|list)\b|\b(?:someone|somebody|people|anyone) (?:else )?(?:to|can|could) buy\b|\b(?:place|post|put|run) (?:a |an |my )?(?:classified|want ad|listing)\b/i.test(
      question,
    )
  )
    return "classifieds";
  if (
    /\b(?:town hall|when (?:does|will) .{0,28}(?:board|council|commissioners?) meet|(?:official|public) agenda)\b/i.test(
      question,
    )
  )
    return "notices";
  if (marketRequest(question).matches) return "quotes";
  if (
    atlasTopic(question)?.metric &&
    /\b(how many|how much|rate|measure|median|percent|paid|statistics)\b/i.test(question)
  )
    return "data";
  if (
    /\b(per.capita personal income|personal income per (?:capita|person))\b/i.test(question) ||
    (/\b(unemployment|household income)\b/i.test(question) &&
      /\b(FRED|historical|history|(?:19|20)\d{2})\b/i.test(question))
  )
    return "gdp";
  return (
    aliases.find(([, pattern]) => pattern.test(question))?.[0] ??
    (atlasTopic(question) ||
    /\b(how many|how much|what percentage|what percent|statistics|median|attainment|graduat(?:e|ion) rate|employ(?:ed|ment)|fatal crashes|school enrollment|inequality index|housing units|labor.force participation)\b/i.test(
      question,
    )
      ? "data"
      : undefined)
  );
}

export type DeskOption = { desk: FetchDesk; label: string; query?: string };
export function replyOption(text: string, options: DeskOption[]) {
  const reply = text
    .toLowerCase()
    .trim()
    .replace(/^(?:the |just |show me )+/, "")
    .replace(/(?: one)?(?: please)?[.!?]*$/, "")
    .trim();
  const ordinal = ["first", "second", "third"].indexOf(reply);
  if (ordinal >= 0 || /^[1-3]$/.test(reply)) return options[ordinal >= 0 ? ordinal : Number(reply) - 1];
  const synonyms: Partial<Record<FetchDesk, RegExp>> = {
    data: /^(?:numbers|figures|statistics|data)$/,
    articles: /^(?:news|stories|reporting|articles)$/,
    notices: /^(?:official )?notices$/,
    classifieds: /^(?:(?:local )?listings|classifieds|sell something)$/,
    submit: /^(?:news |story )?tip$/,
    catalog: /^advertis(?:e|ing)$/,
  };
  return options.find((o) => o.label.toLowerCase() === reply || synonyms[o.desk]?.test(reply));
}

export function deskOptions(question: string): DeskOption[] {
  if (recalledStory.test(question)) return [];
  // These topics have both editorial coverage and a separate public-data or service desk.
  // Specific requests ("median rent", "articles about rent") keep their normal direct route.
  if (
    /\b(?:search|open|take me|go to|articles?|news|story|stories|headlines?|median|percent|how (?:much|many)|price|rate|notices?|hearings?|meetings?|statistics|for sale|forecast)\b/i.test(
      question,
    )
  )
    return [];
  if (
    /\b(?:put|get|place|publish|print) (?:something|an item|an announcement) in (?:the |your |this )?(?:paper|post|newspaper)\b/i.test(
      question,
    )
  )
    return [
      { desk: "submit", label: "Send a story or news tip" },
      { desk: "classifieds", label: "Sell or list an item" },
      { desk: "catalog", label: "Advertise a business", query: "Advertise with The County Post" },
    ];
  if (/\b(?:property taxes|real estate taxes)\b/i.test(question))
    return [
      { desk: "data", label: "See county tax figures" },
      { desk: "articles", label: "Find reporting about taxes" },
      { desk: "notices", label: "Check official notices" },
    ];
  if (
    /\b(?:housing|rent|rentals)\b/i.test(question) &&
    !/\b(?:buy|sell|list|post|income|average|apartment|home value|history|trend)\b/i.test(question)
  )
    return [
      { desk: "data", label: "See county housing figures" },
      { desk: "classifieds", label: "Browse local listings" },
      { desk: "articles", label: "Find housing stories" },
    ];
  return [];
}

const stateNames = states
  .flatMap((state) => [state.name, state.abbr])
  .sort((a, b) => b.length - a.length)
  .join("|");
const placeSuffix = new RegExp(`^\\s*,?\\s*(?:in\\s+)?(${stateNames})\\b`, "i");
const commaState = new RegExp(`^\\s*,\\s*(${stateNames})\\b`, "i");
const clean = (text: string) => text.replace(/^[\s,?!:.]+|[\s,?!:.]+$/g, "").trim();
export const destinationName = (text: string) =>
  clean(text).replace(
    /^(?:please\s+)?(?:take me to|open|go to|show me|switch to|find|visit)\s+(?:the\s+)?/i,
    "",
  );

const relativePlace =
  /^(?:(?:my|this|our|your|the|a|someone|somebody|anyone|people|me|us|next|last)\b|(?:sale|today|tomorrow|tonight|yesterday|now|here|nearby)\b)/i;
const normalizePlace = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function namesCounty(text: string, county: CountySite) {
  const place = normalizePlace(text);
  return [county.name, ...countyJurisdictionNames(county), county.slug, "FIPS " + county.fips].some((name) =>
    [
      name,
      ...[county.state.name, county.state.abbr].flatMap((state) => [name + " " + state, state + " " + name]),
    ].some((alias) => normalizePlace(alias) === place),
  );
}

// Keep an explicitly requested place, including an unknown one, separate from
// the route choice so it can never silently fall back to the current county.
export function requestedPlace(question: string): string {
  const exact = explicitCounty(question);
  if (exact) return exact;
  const text = clean(question).replace(/[’']s\b/gi, "");
  const county = /\b(county|parish|borough)\b/gi;
  for (const match of text.matchAll(county)) {
    const before =
      text
        .slice(0, match.index)
        .split(
          /\b(?:in|for|to|at|from|of|show|open|find|visit|browse|check|switch|around|near|me|the|how|is|see|about)\b/i,
        )
        .at(-1)
        ?.trim() || "";
    const name = before
      .replace(/^.*?\b(?:weather|forecast|notices|hearings|meetings|edition|news)\b\s*/i, "")
      .trim();
    if (
      !name ||
      /^(?:my|our|this|your|another|which|a|change|local|public|current|different|by)$/i.test(name)
    )
      continue;
    const state = text.slice(match.index + match[0].length).match(placeSuffix)?.[1];
    return clean([name, match[0], state].filter(Boolean).join(" "));
  }
  const trailing = text.match(/\b(in|near|for|of)\s+(.+)$/i);
  if (trailing && !relativePlace.test(trailing[2]) && !localIntent(trailing[2])) {
    const name = clean(trailing[2]);
    if (
      trailing[1].toLowerCase() === "of" &&
      !barePlaces.has(normalizePlace(name)) &&
      !getExactSearchState(name) &&
      !(
        /^\p{Lu}/u.test(name) &&
        /\b(?:gdp|population|median (?:rent|age|income))\s*$/i.test(text.slice(0, trailing.index))
      )
    )
      return "";
    if (/^(?:(?:19|20)\d{2}|the past|early|late|recent years|spring|summer|autumn|winter)\b/i.test(name))
      return "";
    if (
      (localIntent(text) === "articles" || localIntent(text) === "search") &&
      trailing[1].toLowerCase() === "for" &&
      !countyMatches(name).length
    )
      return "";
    if (
      trailing[1].toLowerCase() !== "for" ||
      countyMatches(name).length ||
      (localIntent(text) && /^\p{L}+(?:[ ,]+\p{Lu}\p{L}*)*$/u.test(name))
    )
      return name;
  }
  // “Randall weather” and “Open Amarillo classifieds” put the place before the desk.
  const command = destinationName(text);
  const desk = aliases.map(([, pattern]) => pattern.exec(command)).find(Boolean);
  if (desk?.index) {
    const prefix = clean(command.slice(0, desk.index));
    if (
      !relativePlace.test(prefix) &&
      !/\b(?:what|where|how|who|can|could|want|need)\b/i.test(prefix) &&
      countyMatches(prefix).some(
        (county) => namesCounty(prefix, county) || county.primaryCity?.toLowerCase() === prefix.toLowerCase(),
      )
    )
      return prefix;
  }
  return "";
}

export function countyMatches(place: string, candidates?: CountySite[]) {
  if (!place.trim()) return [];
  const exactState = getExactSearchState(place);
  if (exactState && candidates) return candidates.filter((c) => c.state.slug === exactState.slug);
  const exact = exactCountyNames.get(normalizePlace(place));
  if (exact) return candidates ? exact.filter((c) => candidates.includes(c)) : exact;
  if (/^(?:fips )?\d{5}\b/i.test(place)) return [];
  const explicitState = place.includes(",")
    ? getExactSearchState(place.split(",").at(-1)!.trim())
    : undefined;
  const matches = searchCounties(place, candidates).filter(
    (c) => !explicitState || c.state.slug === explicitState.slug,
  );
  const normalized = ` ${normalizePlace(place)} `;
  const formal = matches.filter((c) => normalized.includes(` ${normalizePlace(c.displayName)} `));
  return formal.length ? formal : matches;
}

// Match official geography before parsing conversational prepositions. A state
// can precede the county, follow it, or qualify a city elsewhere in the question.
const qualifiedCounties = new Map<string, string>();
const exactCountyNames = new Map<string, CountySite[]>();
const barePlaces = new Set<string>();
for (const county of counties) {
  const official = countyJurisdictionNames(county);
  for (const alias of official) qualifiedCounties.set(normalizePlace(alias), county.displayName);
  for (const alias of new Set([...official, county.name, county.slug, "FIPS " + county.fips])) {
    for (const qualified of [alias, alias + " " + county.state.name, alias + " " + county.state.abbr]) {
      const key = normalizePlace(qualified);
      const entries = exactCountyNames.get(key);
      if (!entries) exactCountyNames.set(key, [county]);
      else if (!entries.includes(county)) entries.push(county);
    }
  }
  for (const name of [county.name, county.primaryCity, ...(county.localCities || [])]) {
    if (name) barePlaces.add(normalizePlace(name));
  }
}
const orderedStates = [...states].sort((a, b) => b.name.length - a.name.length);
const stateOf = new RegExp(
  "\\b(?:the )?state of (?=(?:" + orderedStates.map((s) => s.name).join("|") + ")\\b)",
  "gi",
);
export function normalizeEditionQuestion(question: string) {
  return question
    .replace(/\b(?:Washington,?\s+)?D\.\s*C\.?(?=\W|$)|\bWashington,?\s+DC\b/gi, "District of Columbia")
    .replace(/\bthe District of Columbia\b/gi, "District of Columbia")
    .replace(stateOf, "");
}
export function mentionedState(text: string) {
  const phrase = ` ${normalizePlace(text)} `;
  return (
    orderedStates.find((s) => phrase.includes(` ${s.name.toLowerCase()} `)) ||
    states.find(
      (s) =>
        new RegExp(`\\b${s.abbr}\\b`).test(text) ||
        (!/^(IN|OR|ME|HI|OK|ID|AR|LA|DE|MA|OH|PA)$/i.test(s.abbr) &&
          phrase.includes(` ${s.abbr.toLowerCase()} `)),
    )
  );
}

export function formalCountyReference(question: string) {
  const code = question.match(/\b(?:county\s+)?FIPS(?:\s+code)?[\s:#-]*(\d{5})\b/i);
  if (code) {
    const subject = question.replace(code[0], " ");
    const state = mentionedState(subject);
    return { place: "FIPS " + code[1] + (state ? ", " + state.name : ""), subject };
  }
  const words = [...question.matchAll(/[\p{L}\p{M}\d]+/gu)];
  for (let length = Math.min(8, words.length); length >= 2; length--) {
    for (let i = 0; i + length <= words.length; i++) {
      const end = words[i + length - 1];
      const start = words[i].index;
      const stop = end.index + end[0].length;
      const raw = question.slice(start, stop);
      const name = qualifiedCounties.get(normalizePlace(raw));
      if (!name) continue;
      const subject = question.slice(0, start) + " " + question.slice(stop);
      const suffix = question.slice(stop).match(commaState);
      const state = (suffix && getExactSearchState(suffix[1])) || mentionedState(subject);
      // The District also has a statewide edition. An unqualified DC request
      // follows the selected desk; county-only desks have one possible county.
      if (
        name === "District of Columbia" &&
        !/county/i.test(raw) &&
        !/^\s*,\s*DC\b/i.test(question.slice(stop))
      )
        continue;
      // A city in another state can share the official label of an independent city.
      if (state && name.endsWith(" City") && !exactCountyNames.has(normalizePlace(name + " " + state.abbr)))
        continue;
      return { place: state ? name + ", " + state.name : name, subject };
    }
  }
}

export function explicitCounty(question: string): string {
  const formal = formalCountyReference(question);
  if (formal) return formal.place;
  // Unqualified "Potter, TX" or "Texas, Potter" can occur mid-sentence.
  const state = mentionedState(question);
  if (!state) return "";
  for (const alias of [state.name, state.abbr]) {
    const match = new RegExp(`\\b${alias}\\b`, "i").exec(question);
    if (!match) continue;
    const before = normalizePlace(question.slice(0, match.index)).split(" ");
    const after = normalizePlace(question.slice(match.index + match[0].length)).split(" ");
    for (let length = 5; length > 0; length--) {
      for (const name of [before.slice(-length).join(" "), after.slice(0, length).join(" ")]) {
        if (!getExactSearchState(name) && barePlaces.has(name)) return `${name}, ${state.name}`;
      }
    }
  }
  return "";
}
