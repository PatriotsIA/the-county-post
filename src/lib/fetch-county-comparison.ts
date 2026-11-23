import { asksForLowerFigure, comparisonRank, placeCorrection, removalName } from "./fetch-comparison-followup";
import { stateData, populationSource } from "./fetch-state-data";
import { stateMeasures, type Comparison } from "./fetch-state-comparison";
import { countyCrimeMeasures, countyCrimeMeasure } from "./county-crime-measures";
import type { AnswerRequest } from "./fetch-content";
import { findCityReference, isOregonQualifier, type CityArea } from "./fetch-city";
import { countyJurisdictionNames } from "../data/county-geography";
import { counties, getCountiesForState, type CountySite } from "../data/counties";
import { getExactSearchState } from "../data/place-search";
import { states, type StateSite } from "../data/states";
import { fetchGuideAtlasDomain } from "./fetch-atlas";
import type { CountyAtlasDomain } from "./county-atlas-api";
import { atlasMetricVintage, formatAtlasValue } from "./county-atlas-format";
import {
  economicObservation,
  fetchCountyEconomicData,
  type CountyEconomicMetric,
} from "./county-economy-api";

type Measure = {
  key: string;
  label: string;
  pattern: RegExp;
} & ({ domain: CountyAtlasDomain } | { series: CountyEconomicMetric["key"] });

export const countyMeasures: Measure[] = [
  ...countyCrimeMeasures,
  {
    key: "gdp",
    label: "GDP in current dollars",
    pattern: /\bgdp\b|gross domestic product/i,
    series: "gross-domestic-product",
  },
  {
    key: "real-gdp",
    label: "Real GDP in chained 2017 dollars",
    pattern: /\breal (?:gdp|gross domestic product)|inflation.adjusted (?:gdp|gross domestic product)/i,
    series: "real-gross-domestic-product",
  },
  {
    key: "unemployment",
    label: "Unemployment rate",
    pattern: /\bunemployment(?: rates?)?\b/i,
    series: "unemployment-rate",
  },
  {
    key: "income",
    label: "Median household income",
    pattern: /\b(?:median )?household incomes?\b/i,
    series: "median-household-income",
  },
  {
    key: "population",
    label: "Population",
    pattern: /\bpopulations?|\b(?:more|fewer) (?:people|residents)\b/i,
    domain: "demographics",
  },
  {
    key: "median-gross-rent",
    label: "Median monthly gross rent",
    pattern: /\b(?:median (?:monthly )?(?:gross )?)?rents?\b/i,
    domain: "housing",
  },
  {
    key: "median-home-value",
    label: "Median home value",
    pattern: /\b(?:median )?(?:home|house) values?\b/i,
    domain: "housing",
  },
];

export type ComparisonPlace = CountySite | StateSite;
export type CountySlot = {
  county?: CountySite;
  state?: StateSite;
  statewide?: StateSite;
  candidates?: CountySite[];
  name?: string;
};
export const placeKey = (place: ComparisonPlace) => ("fips" in place ? place.fips : place.slug);
export const placeLabel = (place: ComparisonPlace) =>
  "fips" in place ? place.displayName + ", " + place.state.abbr : place.name;
export type CountyComparison = {
  slots: CountySlot[];
  criteria?: { measure: Measure; direction?: "lower" | "higher" }[];
  measure?: Measure;
  year?: string;
  trend?: { from?: string; to?: string };
  rank?: "low" | "high";
  guidance?: string;
};

const normalize = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const aliases = new Map<string, CountySite[]>();
for (const c of counties) {
  for (const name of new Set([...countyJurisdictionNames(c), c.name].map(normalize))) {
    const entries = aliases.get(name) || [];
    entries.push(c);
    aliases.set(name, entries);
  }
}
const stateSuffix = new RegExp(
  "^(?:\\s*,\\s*|\\s+(?:in\\s+)?)(" +
    states
      .flatMap((s) => [s.name, s.abbr])
      .sort((a, b) => b.length - a.length)
      .join("|") +
    ")\\b",
  "i",
);

function countyReference(part: string, side: "left" | "right" | "either", home?: CountySite) {
  const current = /\b(?:my|our|this) county\b/i.exec(part);
  if (home && current) return { matches: [home], state: home.state, start: current.index };
  let best:
    { matches: CountySite[]; state?: StateSite; start: number; end: number; explicit: boolean } | undefined;
  const words = [...part.matchAll(/[\p{L}\d'’.-]+/gu)];
  for (let start = 0; start < words.length; start++) {
    for (let size = Math.min(7, words.length - start); size > 0; size--) {
      const last = words[start + size - 1];
      const end = last.index + last[0].length;
      const phrase = part.slice(words[start].index, end);
      const matches = aliases.get(normalize(phrase.replace(/counties$/i, "County")));
      if (!matches) continue;
      const rest = part.slice(end);
      // A lowercase preposition after a name is not Indiana or Oregon.
      const suffix = rest.match(stateSuffix);
      const state =
        suffix && !/^\s+(in|or|me|hi|ok|id)$/.test(suffix[0]) ? getExactSearchState(suffix[1]) : undefined;
      const explicit = /\b(?:county|counties|parish|city|borough|municipality|census area)\b/i.test(phrase);
      const adjacent =
        (side !== "left" && start === 0) ||
        (side !== "right" && !rest.slice(state ? suffix![0].length : 0).trim());
      if (!explicit && !adjacent) continue;
      if (
        !best ||
        (explicit && !best.explicit) ||
        (side === "left" && explicit === best.explicit && words[start].index >= best.end)
      )
        best = {
          matches,
          state,
          start: words[start].index,
          end: end + (state ? suffix![0].length : 0),
          explicit,
        };
      break;
    }
  }
  return best;
}

function resolveSlot(ref: { matches: CountySite[]; state?: StateSite }, shared?: StateSite): CountySlot {
  const state = ref.state || shared;
  const matches = state ? ref.matches.filter((c) => c.state.slug === state.slug) : ref.matches;
  if (matches.length === 1) return { county: matches[0], state: matches[0].state };
  return { state, candidates: matches.length ? matches : undefined };
}

const countyWord =
  /\b(?:county|counties|parish(?:es)?|boroughs?|municipalit(?:y|ies)|census areas?|city and borough)\b/i;
// A conjunction inside a published jurisdiction name belongs to that name.
const compoundNames = new RegExp(
  "\\b(?:" +
    [...aliases.keys()]
      .filter((name) => /\band\b/.test(name))
      .sort((a, b) => b.length - a.length)
      .join("|") +
    ")\\b",
  "gi",
);
const cityJurisdictions = new RegExp(
  "\\b(?:" +
    [...aliases.keys()].filter((name) => name.startsWith("city of ") || name.endsWith(" city")).join("|") +
    ")\\b",
  "gi",
);
const asksComparison = /\b(?:compar(?:e|ing|ison)|versus|vs|difference between)\b/i;
const changeQuestion =
  /\b(?:growth|change(?:d)? (?:since|from|over|faster)|going (?:up|down)|ris(?:ing|en)|grew|grown|growing|increas(?:ed|ing)|declin(?:ed|ing)|falling|fell|dropp(?:ed|ing))\b/i;
const asksRelative =
  /\b(?:higher|lower|more|fewer|larger|smaller|cheaper|greater|faster|fastest|slower|highest|lowest|most|fewest|largest|smallest|cheapest)\b/i;
const separator = /,|[;&]|\b(?:and|or|vs\.?|versus|with|than|to|against|plus)(?=\s)/gi;
const stateName = new RegExp(
  "\\b(" +
    states
      .flatMap((s) => [s.name, s.abbr])
      .sort((a, b) => b.length - a.length)
      .join("|") +
    ")\\b",
  "gi",
);

function standaloneState(part: string) {
  if (countyWord.test(part) || /\bcity\b/i.test(part)) return;
  const match = [...part.matchAll(stateName)].find(
    (m) =>
      (m[0].length > 2 || m[0] === m[0].toUpperCase()) &&
      (m.index === 0 || m.index + m[0].length === part.length),
  );
  return match && getExactSearchState(match[0]);
}

const countyGroup = /\b(?:all (?:the )?counties|every county) (?:in|of)\s+/i;

function listSlots(text: string, home?: CountySite, region?: StateSite): CountySlot[] {
  const parts: string[] = [];
  const compounds = [...text.matchAll(compoundNames)];
  let start = 0;
  for (const split of text.matchAll(separator)) {
    if (compounds.some((m) => m.index <= split.index && split.index < m.index + m[0].length)) continue;
    if (split[0] === "OR" && isOregonQualifier(text, split.index)) continue;
    const part = text.slice(start, split.index).trim();
    if (split[0] === ",") {
      const suffix = text.slice(split.index).match(stateSuffix);
      const county = suffix && countyReference(part, "left", home);
      // Keep the comma in "Washington County, OR", but split "Potter County, Texas County".
      if (
        suffix &&
        (county || /\b(?:county|counties|parish|borough)$/i.test(part)) &&
        !county?.state &&
        !countyGroup.test(part) &&
        (!standaloneState(part) || (/District of Columbia$/i.test(part) && /^,\s*DC$/i.test(suffix[0]))) &&
        !/^\s+(?:county|counties|parish|borough)\b/i.test(text.slice(split.index + suffix[0].length))
      )
        continue;
    }
    if (part) parts.push(part);
    start = split.index + split[0].length;
  }
  const last = text.slice(start).trim();
  if (last) parts.push(last);
  const parsed = parts.map((raw) => {
    const part = raw.replace(/[?!.]+$/, "").trim();
    const group = countyGroup.exec(part);
    if (group) {
      const rest = part.slice(group.index + group[0].length);
      const name = [...rest.matchAll(stateName)].find((m) => m.index === 0);
      if (name) return { countyGroup: getExactSearchState(name[0]) };
    }
    const ref = countyReference(part, "either", home);
    // An unknown county followed by its state still needs its own correction slot.
    const jurisdiction = /\b(?:county|parish|borough|municipality|census area)\b/i.exec(part);
    if (jurisdiction && (!ref || ref.start > jurisdiction.index) && jurisdiction.index > 0) {
      const end = jurisdiction.index + jurisdiction[0].length;
      const name = part
        .slice(0, end)
        .split(/\b(?:compare|between|in|of|for)\s+|:\s*/i)
        .at(-1)!
        .trim();
      if (name && !/^(?:which|what|my|our|this|a|the|these)\b/i.test(name)) {
        const suffix = part.slice(end).match(stateSuffix);
        return { name, state: suffix ? getExactSearchState(suffix[1]) : undefined };
      }
    }
    const statewide = !ref?.state && standaloneState(part);
    if (statewide) return { statewide };
    if (ref) return { ref, name: part.slice(ref.start, "end" in ref ? ref.end : undefined) };
    // Keep a named but unmatched list member available for correction.
    if (
      (countyWord.test(part) && !/^(?:compare|which|between|what|is|where|who)\b/i.test(part)) ||
      (parts.length > 1 &&
        /^[\p{L}'’-]+(?:\s+[\p{L}'’-]+){0,3}$/u.test(part) &&
        !/\b(?:compar\w*|counties|rent|income|population|gdp|latest|which|higher|lower|year|growth|figure|add)\b/i.test(
          part,
        ))
    )
      return { name: part };
    return {};
  });
  const prefix = text.match(/\bcounties (?:in|of) ([\p{L} ]+?)\s*:/iu);
  const prefixState = prefix ? getExactSearchState(prefix[1]) : undefined;
  const qualifiers = new Set(parsed.flatMap((p) => p.ref?.state || []));
  const shared = qualifiers.size === 1 ? [...qualifiers][0] : undefined;
  // A trailing “counties in Texas” qualifies the preceding names in that group.
  const groupRegions: (StateSite | undefined)[] = [];
  let group: StateSite | undefined;
  for (let i = parsed.length - 1; i >= 0; i--) {
    const p = parsed[i];
    if (p.ref?.state || p.statewide)
      group = /\b(?:counties|parishes|boroughs)\b/i.test(parts[i]) ? p.ref?.state : undefined;
    groupRegions[i] = group;
  }
  let expandingStates = false;
  return parsed.flatMap((p, i): CountySlot[] => {
    const groupState = p.countyGroup || (expandingStates && p.statewide);
    expandingStates = !!groupState;
    if (groupState)
      return getCountiesForState(groupState.slug).map((county) => ({ county, state: groupState }));
    if (p.statewide) return [{ state: p.statewide, statewide: p.statewide }];
    if (!p.ref) return p.name ? [{ name: p.name, state: p.state || groupRegions[i] || region }] : [];
    const hint = [prefixState, shared, region].find((s) => s && p.ref!.matches.some((c) => c.state === s));
    return [{ ...resolveSlot(p.ref, groupRegions[i] || hint), name: p.name }];
  });
}

function uniqueSlots(slots: CountySlot[]) {
  const seen = new Set<string>();
  return slots.filter((slot) => {
    const place = slot.county || slot.statewide;
    if (!place) return true;
    const key = placeKey(place);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function countyComparisonQuestion(
  text: string,
  prior?: CountyComparison,
  home?: CountySite,
  edition?: StateSite,
  areaContext?: { area: CityArea; question: string },
  answer?: AnswerRequest,
): CountyComparison | undefined {
  if (
    /\b(?:find|show|search|read|open)\b.*\b(?:articles?|stories|headlines?|coverage|feeds?)\b|\b(?:articles?|stories|headlines?|coverage) (?:about|on|comparing)\b/i.test(
      text,
    )
  )
    return;
  const region = home?.state || edition;
  const correction = placeCorrection(text);
  if (prior && correction) {
    const target = correction.to.replace(/\s+in\s+/i, ", ");
    const slots = listSlots(target);
    const replacement = slots.length === 1 ? slots[0] : undefined;
    const name = correction.from?.replace(/\s+in\s+/i, " ");
    const indices = prior.slots.flatMap((slot, i) => {
      const place = slot.county || slot.statewide;
      const same = name
        ? place &&
          [
            place.name,
            placeLabel(place),
            slot.county?.displayName,
            slot.county && slot.county.displayName + " " + slot.county.state.name,
          ].some((n) => n && normalize(n) === normalize(name))
        : slot.county && slot.county.name === replacement?.county?.name;
      return same ? [i] : [];
    });
    if (indices.length !== 1 || !replacement || (!replacement.county && !replacement.statewide))
      return { ...prior, guidance: "Choose Change place beside the selection you want to correct." };
    const revised = prior.slots.map((slot, i) => (i === indices[0] ? replacement : slot));
    if (uniqueSlots(revised).length !== revised.length)
      return { ...prior, guidance: "That place is already in this comparison." };
    return { ...prior, slots: revised, guidance: undefined };
  }
  const remove = prior && removalName(text);
  if (prior && remove) {
    const name = normalize(remove).replace(/ in /g, " ");
    const matches = prior.slots.filter((slot) => {
      const c = slot.county;
      const names = c
        ? [
            c.fips,
            ...[c.name, c.displayName].flatMap((n) => [n, n + " " + c.state.abbr, n + " " + c.state.name]),
          ]
        : slot.statewide
          ? [slot.statewide.name, slot.statewide.abbr]
          : [slot.name || ""];
      return names.some((n) => normalize(n) === name);
    });
    if (matches.length !== 1)
      return {
        ...prior,
        guidance: matches.length
          ? "That name matches more than one selection. Include the state when you remove a county."
          : "Choose a selected place to remove, or type its full name and state after “remove”.",
      };
    const slots = prior.slots.filter((s) => s !== matches[0]);
    if (slots.length < 2) slots.push({ state: region });
    return { ...prior, slots, guidance: undefined };
  }
  const rank = prior && comparisonRank(text, countyMeasures);
  const sameArea =
    !!areaContext &&
    !/\b(?:in|than|and|or|versus|vs)\b/i.test(text) &&
    /^(?:compare (?:these|both|the) counties|which (?:county|one) (?:is|has) (?:higher|lower|more|fewer) [\w ]+)[.?!]*$/i.test(
      text.trim(),
    );
  const fromAnswer =
    answer?.county && (answer.kind === "gdp" || answer.kind === "data")
      ? text.match(/^compare(?: (?:that|this|it))? (?:with|to) (.+?)[.?!]*$/i)
      : undefined;
  const carried = fromAnswer && answer?.county;
  const subject = carried
    ? (answer?.atlasChoice?.label || "") + " " + answer!.question
    : sameArea && /^compare /i.test(text)
      ? areaContext.question
      : text;
  const realGDP = countyMeasures.find((m) => m.key === "real-gdp")!.pattern.test(subject);
  const crime = countyCrimeMeasure(subject);
  const requested = countyMeasures.filter((m) =>
    "domain" in m && m.domain === "public-safety"
      ? m.key === crime?.key
      : m.pattern.test(subject) && !(m.key === "gdp" && realGDP),
  );
  const than = text.match(/\bthan (.+?)(?=\s+(?:among|across|using|in (?:19|20)\d{2})\b|[?!]|$)/i);
  if (than && requested.length > 1) {
    const baseline = listSlots(than[1], home, region);
    const clauses = text.slice(0, than.index).split(/\band\b/i);
    const criteria = requested.map((measure) => {
      const clause = clauses.find((part) => measure.pattern.test(part)) || "";
      const direction = /\b(lower|less|cheaper|smaller|fewer)\b/i.test(clause)
        ? ("lower" as const)
        : /\b(higher|more|greater|larger)\b/i.test(clause)
          ? ("higher" as const)
          : undefined;
      return { measure, direction };
    });
    if (baseline.length === 1 && criteria.every((c) => c.direction)) {
      const among = text.match(/\b(?:among|across|using) (.+?)(?:[?!]|$)/i);
      const candidates = among ? listSlots(among[1], home, baseline[0].state || region) : prior?.slots || [];
      return {
        slots: uniqueSlots([...baseline, ...candidates]),
        measure: requested[0],
        criteria,
        year: text.match(/\b(?:19|20)\d{2}\b/)?.[0] || prior?.year,
      };
    }
  }
  const questionYears = text.match(/\b(?:19|20)\d{2}\b/g);
  const years = [...new Set(questionYears || subject.match(/\b(?:19|20)\d{2}\b/g) || [])];
  const trend = changeQuestion.test(text);
  const add = prior && text.match(/^(?:please )?(?:add|include|also compare|and)\s+(.+?)[?!.]*$/i);
  let added: CountySlot[] | undefined;
  if (add) {
    const regions = new Set(prior.slots.map((s) => s.state).filter(Boolean));
    const extra = listSlots(add[1], home, regions.size === 1 ? [...regions][0] : region);
    if (
      extra.some(
        (s) => s.county || s.statewide || s.candidates?.length || (s.name && countyWord.test(s.name)),
      )
    )
      added = uniqueSlots([...prior.slots, ...extra]);
  }
  const hasCounty = countyWord.test(text) || (text.match(cityJurisdictions)?.length || 0) >= 2;
  const potentialList =
    (hasCounty || asksComparison.test(text)) &&
    (asksComparison.test(text) || requested.length || asksRelative.test(text))
      ? listSlots(text, home, region)
      : [];
  const namedList =
    potentialList.length >= 2 && potentialList.every((s) => s.county || s.statewide || s.candidates?.length);
  const isNew =
    !!carried ||
    sameArea ||
    (namedList &&
      (asksComparison.test(text) ||
        countyGroup.test(text) ||
        /\b(?:and|or|than|between|against)\b|[,;].*[,;]/i.test(text)) &&
      !/\baccording to\b/i.test(text) &&
      (hasCounty ||
        (potentialList.length >= 3 && potentialList.every((s) => s.county || s.candidates?.length))) &&
      !/(?:how many|number of|more|fewer) counties|county counts?/i.test(text)) ||
    (hasCounty &&
      (asksComparison.test(text) ||
        (trend && /\b(?:and|or|than)\b/i.test(text)) ||
        (asksRelative.test(text) &&
          (/\bthan\b/i.test(text) ||
            (/^(?:which|where|who|does|is|between)\b/i.test(text) && /\b(?:or|and)\b|,/i.test(text))))) &&
      !/county counts?|(?:how many|number of|more|fewer) counties/i.test(text));
  if (!isNew && !added && !rank) {
    if (!prior) return;
    const stateReply = getExactSearchState(text.replace(/[?!.]+$/, ""));
    if (stateReply) {
      const unresolved = prior.slots.filter(
        (s) => !s.county && s.candidates?.some((c) => c.state.slug === stateReply.slug),
      );
      if (unresolved.length === 1)
        return {
          ...prior,
          slots: prior.slots.map((s) =>
            s === unresolved[0] ? resolveSlot({ matches: s.candidates!, state: stateReply }) : s,
          ),
        };
      if (unresolved.length > 1)
        return {
          ...prior,
          guidance:
            "Several places could be in " +
            stateReply.name +
            ". Choose the matching county for each name below.",
        };
    }
    let remainder = text.replace(
      /^(?:which (?:one|county) (?:has|is) (?:the )?(?:higher|lower|larger|smaller) )/i,
      "",
    );
    for (const measure of requested) remainder = remainder.replace(measure.pattern, " ");
    remainder = remainder.replace(/\b(?:mean|average|growth)\b/gi, " ");
    remainder = remainder
      .replace(/\b(?:19|20)\d{2}\b/g, " ")
      .replace(/\b(?:and|what|how|about|in|for|the|year|instead|latest|figure|please)\b|[?.!,]/gi, " ")
      .trim();
    if (remainder || (!requested.length && !years.length && !/\blatest\b/i.test(text))) return;
  }
  const base: CountyComparison =
    isNew && !added
      ? { slots: [{ state: home?.state || edition }, { state: home?.state || edition }] }
      : { ...prior! };
  base.guidance = undefined;
  base.rank = rank || (asksForLowerFigure(text) ? "low" : undefined);
  if (added) base.slots = added;
  else if (carried && fromAnswer) {
    const targets = listSlots(fromAnswer[1], home, carried.state);
    base.slots = uniqueSlots([{ county: carried, state: carried.state }, ...targets]);
    if (base.slots.length < 2) base.slots.push({ state: carried.state });
  } else if (isNew) {
    const slots = sameArea ? [] : potentialList;
    const city = slots.length < 2 && /\bcounties\b/i.test(text) ? findCityReference(text, region) : undefined;
    const area = sameArea ? areaContext.area : city?.places.length === 1 ? city.places[0] : undefined;
    if (area && area.counties.length >= 2) {
      base.slots = area.counties.map((county) => ({ county, state: county.state }));
    } else if (slots.length) {
      base.slots = uniqueSlots(slots);
      if (base.slots.length < 2) base.slots.push({ state: region });
    } else if (home && /^compare (?:two )?counties[.!?]*$/i.test(text.trim())) {
      base.slots[0] = { county: home, state: home.state };
    }
  }
  if (
    /\b(?:mean|averag(?:e|es)|per capita gdp|gdp per (?:person|capita))\b/i.test(text)
  ) {
    base.measure = undefined;
    base.guidance = "Choose one of the listed measures to compare these places.";
  } else if (requested.length) {
    base.criteria = requested.length > 1 ? requested.map(measure => ({measure})) : undefined;
    base.measure = requested[0];
  }
  if (trend || (prior?.trend && !isNew && years.length)) {
    const sorted = years.sort();
    base.trend = { from: sorted[0], to: sorted.at(1) };
    base.year = undefined;
    if (sorted.length > 2) {
      base.trend = undefined;
      base.measure = undefined;
      base.guidance = "Choose a start year and an end year for a change comparison.";
    }
  } else if (years.length > 1) {
    base.year = undefined;
    base.measure = undefined;
    base.guidance = "Compare one year at a time. Choose a measure, then enter the year you want.";
  } else if (years.length || /\blatest\b/i.test(text)) {
    base.year = years[0];
    base.trend = undefined;
  }
  if (base.criteria && (base.trend || !base.measure)) {
    base.criteria = undefined;
    base.measure = undefined;
    base.guidance ||= "Choose one measure for a comparison across years.";
  }
  return base;
}

export type CountyFigure = {
  text: string;
  period?: string;
  value?: number;
  basis?: string;
  note?: string;
  source?: string;
  url?: string;
  kind?: "currency" | "number" | "percent";
  unit?: string;
  margin?: number;
  coverage?: number;
};

export type CountySeries = { years: string[]; figure: (year?: string) => CountyFigure };
const missing = (year?: string): CountyFigure => ({
  text: year ? `No published figure for ${year}.` : "No published figure.",
});
function availableYears(dates: (string | undefined)[]) {
  return [...new Set(dates.flatMap((d) => d?.match(/^(?:19|20)\d{2}\b/)?.[0] || []))];
}

export async function countySeries(
  county: CountySite,
  measure: Measure,
  signal: AbortSignal,
): Promise<CountySeries> {
  if ("series" in measure) {
    const data = await fetchCountyEconomicData(county.state.slug, county.slug, signal);
    if (data.county?.fips !== county.fips) throw new Error("County mismatch");
    const metric = data.metrics.find((m) => m.key === measure.series);
    if (!metric) return { years: [], figure: missing };
    const credit = { source: metric.source + " via FRED", url: metric.seriesUrl };
    return {
      years: availableYears([
        metric.latest?.date,
        metric.previous?.date,
        ...(metric.observations || []).map((o) => o.date),
      ]),
      figure(year) {
        const point = economicObservation(metric, year);
        if (!point) return { ...missing(year), ...credit };
        const kind = metric.valueKind === "percent" ? "percent" : "currency";
        const value = point.value * (metric.valueKind === "currency-thousands" ? 1000 : 1);
        return {
          text: formatAtlasValue(value, kind),
          value,
          kind,
          period: point.date.slice(0, 4),
          basis:
            metric.source &&
            metric.units &&
            [metric.key, metric.source, metric.units, metric.frequency, point.date].join("|"),
          ...credit,
        };
      },
    };
  }
  const doc = await fetchGuideAtlasDomain(county, measure.domain, signal);
  if (doc.county?.fips !== county.fips || doc.domain?.slug !== measure.domain)
    throw new Error("County desk mismatch");
  const m = doc.metrics.find((m) => m.key === measure.key);
  if (!m) return { years: [], figure: missing };
  const credit = { source: m.source.name, url: m.source.url };
  const latestYear = m.date?.slice(0, 4) || m.vintage?.match(/^(\d{4})(?:$| ACS\b)/i)?.[1];
  return {
    years: availableYears([latestYear, ...(m.suppressed ? [] : m.observations || []).map((o) => o.date)]),
    figure(year) {
      if (m.suppressed && (!year || latestYear === year))
        return { text: "Suppressed", period: atlasMetricVintage(m), note: m.suppressionReason, ...credit };
      if (m.suppressed) return { ...missing(year), ...credit };
      const latest = !year || latestYear === year;
      const observations = m.observations?.filter((o) => o.date.startsWith(year || "")) || [];
      const point = observations.length === 1 ? observations[0] : undefined;
      const value = latest ? m.value : point?.value;
      if (value === undefined || !Number.isFinite(value)) return { ...missing(year), ...credit };
      const period = latest ? atlasMetricVintage(m) : point!.date;
      const note = [
        latest &&
          m.marginOfError !== undefined &&
          `Margin of error ±${formatAtlasValue(m.marginOfError, m.valueKind, m.unit)}`,
        measure.domain === "public-safety" && m.description,
        m.modeledEstimate && "Modeled estimate",
        m.preliminary && "Preliminary",
      ]
        .filter(Boolean)
        .join(" · ");
      const kind =
        m.valueKind === "currency" || m.valueKind === "number" || m.valueKind === "percent"
          ? m.valueKind
          : undefined;
      return {
        text: formatAtlasValue(value, m.valueKind, m.unit),
        period,
        value,
        kind,
        unit: m.unit,
        margin: latest ? m.marginOfError : undefined,
        coverage: measure.domain === "public-safety" ? m.coveragePercent : undefined,
        basis:
          kind &&
          (latest ? m.vintage || m.date : point?.date) &&
          m.source.id &&
          m.unit &&
          [m.key, m.source.id, m.valueKind, m.unit, period, latest ? m.date : point?.date].join("|"),
        note,
        ...credit,
      };
    },
  };
}

const statewideMeasures: Partial<Record<string, "population" | "income" | "rent" | "homeValue">> = {
  population: "population",
  income: "income",
  "median-gross-rent": "rent",
  "median-home-value": "homeValue",
};

export function addCountiesToStateComparison(
  question: string,
  prior: Comparison,
): CountyComparison | undefined {
  if (!/^(?:please )?(?:add|and|include|also compare)\b/i.test(question) || !countyWord.test(question))
    return;
  const measure =
    prior.metrics.length === 1
      ? countyMeasures.find((m) => statewideMeasures[m.key] === prior.metrics[0])
      : undefined;
  return {
    slots: prior.places.map((state) => ({ state, statewide: state })),
    measure,
    year: prior.years.length === 1 ? String(prior.years[0]) : undefined,
  };
}

// Mixed selections use the same statewide snapshot as the state comparison desk.
export function comparisonSeries(
  place: ComparisonPlace,
  measure: Measure,
  signal: AbortSignal,
): Promise<CountySeries> {
  if ("fips" in place) return countySeries(place, measure, signal);
  const metric = statewideMeasures[measure.key];
  const row = stateData[place.name];
  if (!row || !metric)
    return Promise.resolve({
      years: [],
      figure: () => ({ text: "No statewide figure for this measure in Fetch." }),
    });
  const years = metric === "population" ? Object.keys(row.population).sort() : ["2024"];
  return Promise.resolve({
    years,
    figure(year = years.at(-1)) {
      if (!year || !years.includes(year)) return missing(year);
      if (metric === "population") {
        const value = row.population[year];
        return {
          text: formatAtlasValue(value, "number"),
          value,
          kind: "number",
          period: "July 1, " + year,
          basis: "Census statewide population estimates Vintage 2025|" + year,
          source: "Census population estimates · Vintage 2025",
          url: populationSource,
        };
      }
      const [value, margin] = row[metric];
      const descriptor = stateMeasures.find((m) => m.key === metric)!;
      const table = "table" in descriptor ? descriptor.table : "";
      return {
        text: formatAtlasValue(value, "currency"),
        value,
        margin,
        kind: "currency",
        note: "Margin of error ±" + formatAtlasValue(margin, "currency"),
        period: "2020–2024 survey estimate",
        basis: [measure.key, "census-acs", "currency", "Dollars", "2024 ACS 5-year", "2024-12-31"].join("|"),
        source: "Census survey table " + table,
        url: "https://data.census.gov/table/ACSDT5Y2024." + table,
      };
    },
  });
}
