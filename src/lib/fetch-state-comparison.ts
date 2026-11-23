import { asksForLowerFigure, comparisonRank, placeCorrection, removalName } from "./fetch-comparison-followup";
import { getExactSearchState } from "../data/place-search";
import { states, type StateSite } from "../data/states";

import { explicitCounty, requestedPlace } from "./fetch-guide";

const incomePerPerson = /per (capita|person) income|income per (capita|person)/i;
export const stateMeasures = [
  {
    key: "population",
    label: "Population",
    pattern:
      /\b(population|populations|populous|residents|more people|fewer people|(?:people|folks) (?:live|reside)|pop growth)\b/i,
  },
  {
    key: "counties",
    label: "Counties in the directory",
    pattern: /(?:how many|more|number of|count of|fewer) counties|county counts?/i,
  },
  {
    key: "rent",
    label: "Median monthly gross rent",
    table: "B25064",
    pattern: /\b(rent|rents|renting|rental)\b/i,
  },
  { key: "perCapita", label: "Per capita income", table: "B19301", pattern: incomePerPerson },
  {
    key: "income",
    label: "Median household income",
    table: "B19013",
    pattern: /household income|famil(?:y|ies) (?:earn|income)|how much .*earn|\bincomes?\b/i,
  },
  {
    key: "homeValue",
    label: "Median owner-occupied home value",
    table: "B25077",
    pattern: /(?:home|house|housing|property) (?:values?|prices?|costs?)|cost of (?:a )?(?:home|house)/i,
  },
  {
    key: "age",
    label: "Median age",
    table: "B01002",
    pattern: /\b(age|ages|older|younger|oldest|youngest)\b/i,
  },
  { key: "households", label: "Households", table: "B11001", pattern: /\bhouseholds\b|household count/i },
] as const;
export type StateMeasure = (typeof stateMeasures)[number]["key"];
export type Comparison = {
  places: StateSite[];
  metrics: StateMeasure[];
  years: number[];
  guidance?: string;
  surveyPeriod?: boolean;
  rank?: "low" | "high";
};
const names = states.flatMap((s) => [s.name, s.abbr]).sort((a, b) => b.length - a.length);
const ambiguous = new Set([
  "in",
  "or",
  "me",
  "hi",
  "ok",
  "id",
  "ar",
  "la",
  "ma",
  "oh",
  "de",
  "ne",
  "al",
  "pa",
  "ms",
  "md",
  "co",
]);
export function namedStates(text: string) {
  const found = new Set<StateSite>();
  for (const match of text.matchAll(new RegExp("\\b(" + names.join("|") + ")\\b", "gi"))) {
    const name = match[0];
    if (name.length === 2 && name !== name.toUpperCase() && ambiguous.has(name.toLowerCase())) continue;
    const state = states.find(
      (s) => s.name.toLowerCase() === name.toLowerCase() || s.abbr === name.toUpperCase(),
    );
    if (state) found.add(state);
  }
  return [...found];
}

const stateList = new RegExp(
  "\\b(?:" +
    names.join("|") +
    ")(?:\\s*(?:,\\s*(?:(?:and|or)\\s+)?|;|&|\\b(?:and|or|versus|vs\\.?|with|than|against)\\s+)(?:" +
    names.join("|") +
    ")\\b)+",
  "gi",
);
const everyState = /\b(?:all (?:the |50 )?states|every state)\b/i;

export function explicitStateList(text: string) {
  if (everyState.test(text)) return true;
  const total = namedStates(text).length;
  return (
    total > 1 &&
    [...text.matchAll(stateList)].some(
      (m) =>
        namedStates(m[0]).length === total &&
        !/,\s*$/.test(text.slice(0, m.index)) &&
        !/^\s+(?:city|county|parish|borough)\b/i.test(text.slice(m.index + m[0].length)),
    )
  );
}

export function comparisonQuestion(
  text: string,
  prior?: Comparison,
  edition?: StateSite,
): Comparison | undefined {
  const correction = placeCorrection(text);
  if (prior && correction) {
    const from = correction.from && getExactSearchState(correction.from);
    const to = getExactSearchState(correction.to);
    if (!from || !to || !prior.places.includes(from))
      return { ...prior, guidance: "Choose Change place beside the state you want to correct." };
    if (from !== to && prior.places.includes(to))
      return { ...prior, guidance: "That state is already in your comparison." };
    return { ...prior, places: prior.places.map(s => s === from ? to : s), guidance: undefined };
  }
  const remove = prior && removalName(text);
  if (remove && prior) {
    const state = getExactSearchState(remove);
    if (state && prior.places.includes(state))
      return { ...prior, places: prior.places.filter((p) => p !== state), guidance: undefined };
    return { ...prior, guidance: "Choose a selected state to remove, or type its full name after “remove”." };
  }
  const rank = prior && comparisonRank(text, stateMeasures);
  if (/^(?:please )?(?:open|go to|take me to|navigate to|find articles)\b/i.test(text)) return;
  if (/\b(county|parish|borough)\b/i.test(text) && !/county counts?/i.test(text)) return;
  const named = everyState.test(text)
    ? states.filter((s) => s.abbr !== "DC" || /\b(?:DC|District of Columbia)\b/i.test(text))
    : namedStates(text);
  const localReference = /\b(?:my state|our state|this state|here)\b/i.test(text);
  const places =
    edition && localReference && named.length && !named.includes(edition)
      ? [edition, ...named]
      : named.length || prior?.places.length || !edition
        ? named
        : [edition];
  const asksCompare = /\b(compar(?:e|ing|ison)|versus|vs\.?|side by side|difference between)\b/i.test(text);
  if (named.length === 1 && explicitCounty(text)) return;
  if (!named.length && (edition || prior) && requestedPlace(text)) return;
  const perCapita = incomePerPerson.test(text);
  const metrics = stateMeasures
    .filter(
      (m) => m.pattern.test(text) && !(m.key === "income" && perCapita && !/household income/i.test(text)),
    )
    .map((m) => m.key);
  let years = [...new Set((text.match(/\b(?:19|20)\d{2}\b/g) || []).map(Number))];
  const growth =
    /growth|grew|grown|change(?:d)? (?:in population|since|from)|population change/i.test(text) &&
    metrics.includes("population");
  const singleSurveyPeriod = /2020\s*[-–—]\s*2024|2020 (?:to|through) 2024 (?:ACS|survey|five.year)/i.test(
    text,
  );
  if (growth && years.length < 2) years = [...new Set([years[0] || 2020, 2025])];
  const followup =
    prior &&
    (!asksCompare || /^also compare\b/i.test(text)) &&
    !/\b(weather|forecast|news|open|take me|stories|tour|help)\b/i.test(text) &&
    (rank ||
      metrics.length ||
      years.length ||
      /^(?:add|include|also compare|and|what about|how about)\b/i.test(text) ||
      (places.length &&
        [places[0].name, places[0].abbr].some((n) => n.toLowerCase() === text.trim().toLowerCase())));
  const numeric = /\b(higher|lower|more|less|fewer|bigger|larger|smaller|highest|lowest)\b/i.test(text);
  const unsupported =
    /\b(gdp|unemployment|inflation|tax(?:es)?|voter turnout|crime|(?:average|mean) (?:\w+ ){0,2}(?:rent|income|age|prices?|value)|household size|cost of living|land area|density|weather)\b/i.test(
      text,
    );
  if (
    !asksCompare &&
    !(places.length && (metrics.length || (unsupported && named.length && !/weather/i.test(text)))) &&
    !(named.length > 1 && numeric) &&
    !followup
  )
    return;
  if (/\b(news|stories|articles|coverage|forecasts?|notices)\b/i.test(text)) return;
  if (!places.length && !prior && !/\bstates?\b/i.test(text)) return;
  const surveyTrend =
    metrics.some((m) => m !== "population" && m !== "counties") &&
    /\b(growth|grew|grown|changed|trend|history|gone up|risen|increased|decreased|over time)\b/i.test(text);
  return {
    rank: rank || (asksForLowerFigure(text) ? "low" : undefined),
    surveyPeriod: singleSurveyPeriod || (followup && !years.length && prior?.surveyPeriod) || false,
    places:
      followup &&
      places.length &&
      (prior.places.length === 1 || /^(?:add|include|and|also compare)\b/i.test(text))
        ? [...new Set([...prior.places, ...places])]
        : places.length
          ? places
          : prior?.places || [],
    metrics: unsupported ? [] : metrics.length ? metrics : followup ? prior.metrics : [],
    years: years.length ? years : followup ? prior.years : [],
    guidance: unsupported
      ? "The state measures available here are listed below. Pick one, or open a state edition for its coverage."
      : surveyTrend
        ? "For survey measures Fetch has one five-year estimate, covering 2020–2024. A change over time needs estimates from more than one period."
        : undefined,
  };
}
