import { counties, type CountySite } from "./counties";
import { states, type StateSite } from "./states";

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
    .replace(/\bsaint\b/g, "st").replace(/\bmount\b/g, "mt");
}

function words(value: string) {
  return normalize(value).split(" ").filter(Boolean);
}

const stateIndex = states.map((state) => ({
  state,
  aliases: [words(state.name), words(state.abbr)],
  tokens: words(`${state.name} ${state.abbr}`),
}));
const countyIndex = counties.map((county) => ({
  county,
  stateTokens: words(`${county.state.name} ${county.state.abbr}`),
  tokens: [...new Set(words(`${county.name} ${county.displayName} ${county.slug} ${county.primaryCity || ""} ${county.fips}`))],
}));
const jurisdictionWords = new Set(["county", "counties", "parish", "city", "borough", "census", "area", "municipality"]);

// Only longer words get typo tolerance; short queries and state abbreviations
// stay precise. Exact/partial matches always take precedence over corrections.
function isCloseWord(query: string, word: string) {
  if (query.length < 4 || query[0] !== word[0]) return false;
  const allowance = query.length >= 6 ? 2 : 1;
  if (Math.abs(query.length - word.length) > allowance) return false;
  let previous = Array.from({ length: word.length + 1 }, (_, i) => i);
  for (let i = 1; i <= query.length; i++) {
    const current = [i];
    for (let j = 1; j <= word.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(query[i - 1] !== word[j - 1]));
    }
    previous = current;
  }
  return previous[word.length] <= allowance;
}

function matches(query: string[], tokens: string[], fuzzy = false) {
  return query.every((part) => tokens.some((token) =>
    token === part || (part.length >= 3 ? token.includes(part) : token.startsWith(part)) || (fuzzy && isCloseWord(part, token)),
  ));
}

export function getExactSearchState(query: string): StateSite | undefined {
  const normalized = normalize(query);
  return stateIndex.find((entry) => entry.aliases.some((alias) => alias.join(" ") === normalized))?.state;
}

export function searchStates(query: string) {
  const tokens = words(query);
  if (!tokens.length) return [];
  const exact = getExactSearchState(query);
  if (exact) return [exact];
  return stateIndex.filter((entry) => matches(tokens, entry.tokens)).map((entry) => entry.state);
}

export function searchCounties(query: string, source: CountySite[] = counties): CountySite[] {
  const tokens = words(query);
  if (!tokens.length) return source;
  const allowed = source === counties ? undefined : new Set(source.map((county) => county.fips));
  const entries = allowed ? countyIndex.filter((entry) => allowed.has(entry.county.fips)) : countyIndex;
  const exactState = getExactSearchState(query);
  if (exactState) return entries.filter((entry) => entry.county.state.slug === exactState.slug).map((entry) => entry.county);

  // Recognize complete state names/abbreviations anywhere in the query. Keep
  // both interpretations for ambiguous names such as "Washington, Oregon".
  const scopes = stateIndex.flatMap((entry) => entry.aliases.flatMap((alias) => {
    const offset = tokens.findIndex((_, index) => alias.every((part, i) => tokens[index + i] === part));
    if (offset < 0) return [];
    const remaining = [...tokens.slice(0, offset), ...tokens.slice(offset + alias.length)];
    if (!remaining.some((part) => !jurisdictionWords.has(part))) return [];
    return [{ state: entry.state, remaining, offset, length: alias.length }];
  })).filter((scope, _, candidates) => !candidates.some((other) =>
    other.length > scope.length && other.offset <= scope.offset && other.offset + other.length >= scope.offset + scope.length,
  ));

  function find(fuzzy: boolean) {
    return entries.filter((entry) => {
      if (scopes.length) {
        return scopes.some((scope) => scope.state.slug === entry.county.state.slug && matches(scope.remaining, entry.tokens, fuzzy));
      }
      return matches(tokens, [...entry.tokens, ...entry.stateTokens], fuzzy);
    }).map((entry) => entry.county);
  }

  const scopedMatches = scopes.length ? find(false) : [];
  if (scopedMatches.length) return scopedMatches;
  // Prefer a county's own name over incidental state tokens: Washington
  // County should not list every county in Washington, and De Soto is a name.
  const countyNameMatches = entries.filter((entry) => matches(tokens, entry.tokens)).map((entry) => entry.county);
  if (countyNameMatches.length) return countyNameMatches;
  const exact = find(false);
  return exact.length ? exact : find(true);
}
