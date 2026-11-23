import type { NewsFeedItem } from "./news-api";
import { isTrustedCountyNativeNewsItem } from "./local-news-sources";

export type LocalityScope = {
  countyName?: string;
  countyDisplayName?: string;
  stateName?: string;
  stateAbbr?: string;
  cities?: string[];
  /** Town names that only count in dateline form; see scopeDatelinePlaces. */
  datelineCities?: string[];
  /** Outlets the API accepts as county-local without them naming the county. */
  trustedHosts?: string[];
  /** Whether the county's name identifies it without the state alongside. */
  countyNameDistinctive?: boolean;
  strict?: boolean;
};

const stateNames = [
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "florida",
  "georgia",
  "hawaii",
  "idaho",
  "illinois",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "new hampshire",
  "new jersey",
  "new mexico",
  "new york",
  "north carolina",
  "north dakota",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "rhode island",
  "south carolina",
  "south dakota",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "virginia",
  "washington",
  "west virginia",
  "wisconsin",
  "wyoming",
];

/**
 * A second pass over items the News API already scoped.
 *
 * The API filters county feeds against the county's real towns, taken from the
 * Census subcounty file. The browser has no such list, so re-applying the old
 * rule here — the text must contain "briscoe county" — threw away precisely the
 * local stories the API had just found: a Silverton city council report rarely
 * names the county at all. The county-name requirement is therefore dropped for
 * API items, and the wrong-state guard, which needs no place data, is kept.
 */
export function filterApiItemsByLocality(
  items: NewsFeedItem[],
  locality?: LocalityScope,
  places: string[] = [],
  datelinePlaces: string[] = [],
  trustedHosts: string[] = [],
  countyNameDistinctive = false,
) {
  if (!locality?.countyName) return items;
  const scoped: LocalityScope = {
    ...locality,
    cities: places,
    datelineCities: datelinePlaces,
    trustedHosts,
    countyNameDistinctive,
  };
  return items.filter((item) => {
    const contentHaystack = `${item.title} ${item.description || ""} ${(item.categories || []).join(" ")}`.toLowerCase();
    const fullHaystack = `${contentHaystack} ${item.source || ""}`.toLowerCase();
    return matchesLocality(item, contentHaystack, fullHaystack, scoped);
  });
}

export function matchesLocality(
  item: NewsFeedItem,
  contentHaystack: string,
  fullHaystack: string,
  locality?: LocalityScope,
) {
  if (!locality?.strict) return true;

  const allowedStateName = locality.stateName?.toLowerCase();
  const mentionsOtherState = stateNames.some((stateName) => stateName !== allowedStateName && includesTerm(contentHaystack, stateName));
  if (mentionsOtherState) return false;

  if (locality.countyName) {
    if (isTrustedCountyNativeNewsItem(item, locality.stateName, locality.countyName)) return true;

    // Outlets the API already treats as this county's own. Most of a county's
    // coverage arrives this way — its local paper and regional stations rarely
    // repeat the county's name — and re-checking them here discarded it.
    if (matchesTrustedHost(item, locality.trustedHosts)) return true;

    const explicitlyInState = Boolean(allowedStateName && includesTerm(fullHaystack, allowedStateName));

    // The county's name, or one of its towns. Mirrors the API exactly, because
    // re-deciding this in the browser with a stricter rule threw away the very
    // stories the API had just found: a Lufkin school board report names
    // neither "Angelina County" nor "Texas", and whole desks came back empty.
    // "Angelina County" in a headline is the clearest county-local signal there
    // is, and most such headlines never repeat the state. Shared names — Polk,
    // Franklin, Washington — still need it, or corroboration below.
    const mentionsCountyName = includesTerm(fullHaystack, (locality.countyDisplayName || `${locality.countyName} County`).toLowerCase());
    if (mentionsCountyName && (explicitlyInState || locality.countyNameDistinctive)) return true;

    // A distinctive town name is its own state qualifier.
    if ((locality.cities || []).some((city) => includesTerm(fullHaystack, city.toLowerCase()))) return true;

    // Shared names need the dateline, which supplies the state itself — or,
    // failing that, they can corroborate one another. Hall County, Texas is the
    // motivating case: "Hall" is a county in three states and its towns are
    // Memphis, Turkey and Lakeview, so almost no genuine headline about it
    // passes on any single name. "Hall County set to receive data center near
    // Turkey" is unambiguous taken together. Mirrors the API exactly.
    const stateAbbr = locality.stateAbbr?.toLowerCase();
    let ambiguousMentions = 0;
    for (const city of locality.datelineCities || []) {
      const name = city.toLowerCase();
      if (
        (allowedStateName && includesTerm(fullHaystack, `${name}, ${allowedStateName}`)) ||
        (stateAbbr && includesTerm(fullHaystack, `${name}, ${stateAbbr}`))
      ) {
        return true;
      }
      if (includesTerm(fullHaystack, name)) ambiguousMentions += 1;
    }
    return (mentionsCountyName && ambiguousMentions >= 1) || ambiguousMentions >= 2;
  }

  const localityTerms = [locality.stateName, locality.stateAbbr, ...(locality.cities || [])];
  const normalizedLocalityTerms = localityTerms.filter(Boolean).map((term) => term!.toLowerCase());

  return normalizedLocalityTerms.length ? normalizedLocalityTerms.some((term) => includesTerm(fullHaystack, term)) : true;
}

function matchesTrustedHost(item: NewsFeedItem, trustedHosts?: string[]) {
  if (!trustedHosts?.length) return false;
  try {
    const host = new URL(item.link).hostname.replace(/^www\./, "").toLowerCase();
    return trustedHosts.some((trusted) => host === trusted || host.endsWith(`.${trusted}`));
  } catch {
    return false;
  }
}

function includesTerm(value: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(value);
}
