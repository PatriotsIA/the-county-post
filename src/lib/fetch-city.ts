import cityData from "../data/fetch-city-counties.json?raw";
import { counties, type CountySite } from "../data/counties";
import { getExactSearchState } from "../data/place-search";
import { isForecastDateReply } from "./fetch-weather";
import { closeSpelling } from "./fetch-text-match";
import { states, type StateSite } from "../data/states";

export type CityArea = { name: string; counties: CountySite[] };
export type CityReference = { places: CityArea[]; subject: string };

const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\bsaint\b/g, "st")
    .replace(/\bmount\b/g, "mt");
const byFips = new Map(counties.map((c) => [c.fips, c]));
const countyNames = new Set(counties.map((c) => c.state.slug + "/" + normalize(c.name)));
const index = new Map<string, CityArea[]>();
const geography: Record<string, string[]> = JSON.parse(cityData);
for (const [name, groups] of Object.entries(geography)) {
  const key = normalize(name);
  const places = index.get(key) || [];
  for (const group of groups) {
    const members = group.split(" ").map((fips) => byFips.get(fips));
    // A city is eligible only if the site can identify every county in its record.
    if (members.every((c): c is CountySite => !!c))
      places.push({ name, counties: members.sort((a, b) => a.displayName.localeCompare(b.displayName)) });
  }
  index.set(key, places);
}
const statePattern = states
  .flatMap((s) => [s.name, s.abbr])
  .sort((a, b) => b.length - a.length)
  .join("|");
const stateAfter = new RegExp(`^(?:\\s*,\\s*|\\s+(?:in\\s+)?)(${statePattern})\\b`, "i");

const stateBefore = new RegExp(
  `(?:^|\\b(?:in|for)\\s+)(${statePattern})(?=\\s*[,;:]|\\s+(?:near|around)\\b)`,
  "i",
);

const qualifiedName = new RegExp(
  `^([\\p{L}.'’ -]+?)(?:\\s*,\\s*|\\s+)(${statePattern})(?=$|[?!.,]|\\s+(?:in|today|tomorrow|this|last|during)\\b)`,
  "iu",
);

// Keep an unrecognized city/state pair local, including for statewide-capable measures.
export function qualifiedLocality(question: string) {
  const parts = [...question.matchAll(/\b(?:in|near|around|of|for|from|to)\s+/gi)];
  const starts = [...parts.map((m) => m.index + m[0].length).reverse(), 0];
  for (const start of starts) {
    const match = question.slice(start).match(qualifiedName);
    if (!match || getExactSearchState(match[0]) || /\b(?:and|versus|vs|between|compare)\b/i.test(match[1]))
      continue;
    if (!match[0].includes(",") && /^(?:in|or|me|hi|ok|id)$/.test(match[2])) continue;
    const state = getExactSearchState(match[2]);
    if (state && !getExactSearchState(match[1]) && (start || !parts.length)) {
      return {
        name: match[1].trim(),
        state,
        text: match[0],
        subject: (question.slice(0, start) + question.slice(start + match[0].length)).trim(),
      };
    }
  }
}

export function similarCityNames(name: string, state: StateSite) {
  const key = normalize(name);
  const matches: CityArea[] = [];
  for (const [candidate, areas] of index) {
    if (closeSpelling(key, candidate))
      matches.push(...areas.filter((p) => p.counties[0].state.slug === state.slug));
  }
  return matches;
}

export function findCityReference(question: string, edition?: StateSite): CityReference | undefined {
  // “Columbia” inside the District of Columbia is not a separate city request.
  const district = /\bdistrict of columbia\b/i.exec(question);
  const words = [...question.matchAll(/[\p{L}\p{M}\d]+(?:['’][\p{L}]+)?/gu)];
  let best: { rank: number; reference: CityReference } | undefined;
  for (let start = 0; start < words.length; start++) {
    if (
      district &&
      words[start].index >= district.index &&
      words[start].index < district.index + district[0].length
    )
      continue;
    const before = question.slice(0, words[start].index);
    if (
      before.trim() &&
      !/\b(?:in|near|around|for|of|from|to|open|find|visit|show me|weather|forecast|news|headlines|population|gdp|covers?|serves?|includes?|will|does|is|make up|what about|how about|what['’]s)\s+(?:the\s+)?(?:(?:city|town|area) of\s+)?$/i.test(
        before,
      )
    )
      continue;
    for (let length = Math.min(words.length - start, 8); length > 0; length--) {
      const last = words[start + length - 1];
      const end = last.index + last[0].length;
      const raw = question.slice(words[start].index, end);
      if (/[,?!]/.test(raw)) continue;
      const possessiveFree = raw.replace(/['’]s$/i, "");
      const key = normalize(possessiveFree);
      const places = index.get(key === "new york city" || key === "nyc" ? "new york" : key);
      if (!places?.length) continue;
      const after = question.slice(end).replace(/^\s+area\b/i, "");
      if (/^(?:\s+(?:county|parish|borough)\b|[-–—]\p{L})/iu.test(after)) continue;
      const timeSuffix = isForecastDateReply(after.trim().replace(/^[, ]+|[?!., ]+$/g, ""));
      const candidate = after.match(stateAfter);
      // Lowercase "in" and "or" are common immediately after a city name.
      const suffix = candidate && !/^\s+(?:in|or|me)$/.test(candidate[0]) ? candidate : null;
      if (
        !suffix && !timeSuffix &&
        /^\s*,\s*\p{L}/u.test(after) &&
        !/^\s*,\s*(?:today|tomorrow|yesterday|this|last|please|according|in \d{4})\b/i.test(after)
      )
        continue;
      const qualifier = suffix?.[1] || before.match(stateBefore)?.[1];
      const state = qualifier ? getExactSearchState(qualifier) : undefined;
      if (!state && getExactSearchState(raw) && !/\b(?:town|city) of\s*$/i.test(before)) continue;
      const remainder = after.slice(suffix?.[0].length || 0);
      if (
        !suffix && !timeSuffix &&
        /^\s+[\p{L}]/u.test(remainder) &&
        !/^\s+(?:area|today|tonight|tomorrow|yesterday|this|last|in|for|during|according|weather|forecast|news|headlines|population|gdp|classifieds|public|local|housing|rent|data|sources|edition|get|have|has|like|right now)\b/i.test(
          remainder,
        )
      )
        continue;
      // Words such as Home, National, Page and Story also name Census places.
      // A desk title or a news search term alone does not establish geography.
      const locative = /\b(?:in|near|around|from|city of|town of)\s+(?:the\s+)?$/i.test(before);
      if (
        !state &&
        !locative &&
        (/^(?:national|home|page|story|normal|may|early|reading|price|mobile|local|center|parks|central|central time)$/i.test(
          key,
        ) ||
          /\b(?:search|look|looking)\b.*\bfor\s*$/i.test(before))
      )
        continue;
      const scoped = places.filter((p) => p.counties[0].state.slug === (state || edition)?.slug);
      if (!scoped.length && (state || (edition && countyNames.has(edition.slug + "/" + key)))) continue;
      const rank = state ? 3 : locative ? 2 : 1;
      if (!best || rank > best.rank)
        best = {
          rank,
          reference: {
            places: scoped.length ? scoped : places,
            subject: (before + " " + remainder.replace(/^\s+area\b/i, "")).trim(),
          },
        };
      break;
    }
  }
  return best?.reference;
}

export function cityLabel(place: CityArea) {
  return `${place.name}, ${place.counties[0].state.abbr}`;
}

export function narrowCounty(reply: string, area: CityArea) {
  const name = normalize(reply)
    .replace(
      /^(?:(?:just|only|please|what about|how about|lets|can (?:we|you)|look at|show me|focus on|narrow (?:it )?(?:down )?to|the) )+/,
      "",
    )
    .replace(/ (?:only|please)$/, "")
    .replace(/ in (?=\S)/, " ");
  return area.counties.find((c) =>
    [c.name, c.displayName, c.slug, c.fips].some((alias) =>
      [alias, alias + " " + c.state.abbr, alias + " " + c.state.name].some((s) => normalize(s) === name),
    ),
  );
}

// OR can be the state after a place or the word between two places.
export function isOregonQualifier(text: string, index: number) {
  if (text.slice(index, index + 2) !== "OR") return false;
  return (
    /,\s*$/.test(text.slice(0, index)) ||
    /^\s*(?:$|[,;&.?!]|(?:and|or|vs|versus|against|with|by|for|in)\b)/i.test(text.slice(index + 2))
  );
}

// In comparisons each side of the conjunction has its own state qualifier.
function comparisonCity(part: string, side: "left" | "right") {
  const text = part
    .trim()
    .replace(/[?.!,]+$/, "")
    .replace(/^(?:in|the city of)\s+/i, "");
  const words = [...text.matchAll(/[\p{L}\p{M}\d'’.-]+/gu)];
  for (let start = 0; start < words.length; start++) {
    if (side === "right" && start !== 0) break;
    for (let count = Math.min(8, words.length - start); count > 0; count--) {
      const last = words[start + count - 1];
      const end = last.index + last[0].length;
      const name = text.slice(words[start].index, end);
      if (name.includes(",")) continue;
      const key = normalize(name);
      const places = index.get(key === "nyc" || key === "new york city" ? "new york" : key);
      if (!places) continue;
      const tail = text.slice(end);
      const suffix = tail.match(stateAfter);
      const state =
        suffix && !/^\s+(?:in|or|me)$/.test(suffix[0]) ? getExactSearchState(suffix[1]) : undefined;
      const rest = tail.slice(state ? suffix![0].length : 0).trim();
      if (
        rest &&
        (side === "left" ||
          !/^(?:in\s+\d{4}|for|have|has|on|when|by|crime|population|rent|in terms of)\b/i.test(rest))
      )
        continue;
      if (!state && getExactSearchState(name)) continue;
      return { places: state ? places.filter((p) => p.counties[0].state === state) : places, state };
    }
  }
}

export function comparisonCities(question: string, edition?: StateSite) {
  if (
    !/\b(?:compar(?:e|ing|ison)|between|versus|vs\.?|higher|lower|more|less|greater|larger|smaller|fewer|faster|safer|or)\b/i.test(
      question,
    )
  )
    return;
  const parts: string[] = [];
  let start = 0;
  for (const match of question.matchAll(/[,;&]|\b(?:and|or|vs\.?|versus|with|than|to)(?=\s)/gi)) {
    const part = question.slice(start, match.index).trim();
    if (match[0] === ",") {
      if (/\d$/.test(part) && /^\d/.test(question.slice(match.index + 1))) continue;
      const suffix = question.slice(match.index).match(stateAfter);
      if (
        suffix &&
        !/^(?:in|or|me)$/.test(suffix[1]) &&
        part &&
        !comparisonCity(part, "left")?.state &&
        !/^\s+(?:city|county)\b/i.test(question.slice(match.index + suffix[0].length))
      )
        continue;
    }
    if (match[0] === "OR" && isOregonQualifier(question, match.index)) continue;
    // A year range is part of the measure, not another place.
    if (
      /\b(?:19|20)\d{2}$/.test(part) &&
      /^\s*(?:19|20)\d{2}\b/.test(question.slice(match.index + match[0].length))
    )
      continue;
    if (part) parts.push(part);
    start = match.index + match[0].length;
  }
  const tail = question.slice(start).trim();
  if (tail) parts.push(tail);
  if (parts.length < 2) return;
  if (
    /^(?:which|what|where|who)\b.*\b(?:statistic|rate|rates|higher|lower|crime|rent|population)\s*[?:]?$/i.test(
      parts[0],
    )
  )
    parts.shift();
  if (parts.length < 2) return;
  const entries = parts.map((part, i) => {
    if (i !== 0) return comparisonCity(part, "right");
    const predicate = part.match(
      /^\s*(?:does|is|has)?\s*(.+?)\s+(?:have|has|is|with)\s+(?:a |the )?(?:higher|lower|more|fewer|larger|smaller)\b/i,
    );
    return comparisonCity(predicate ? predicate[1] : part, "left");
  });
  if (!entries.some(Boolean)) return;
  const qualifiers = new Set(entries.flatMap((e) => e?.state || []));
  const shared = qualifiers.size === 1 ? [...qualifiers][0] : edition;
  const choices = entries.map((entry) => {
    if (!entry) return [];
    if (entry.state || !shared) return entry.places;
    const scoped = entry.places.filter((p) => p.counties[0].state === shared);
    return scoped.length ? scoped : entry.places;
  });
  return { choices, unmatched: parts.filter((_, i) => !choices[i].length) };
}
