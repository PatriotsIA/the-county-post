import { getOtherStatesWithCountyName, isAmbiguousCountyName } from "../data/county-name-index";
import { site } from "../data/site";
import type { StateSite } from "../data/states";

export type CountyFeedKind = "localNews" | "localSports" | "localVideo" | "obituaries";

function googleNewsRssUrl(query: string) {
  const url = new URL(site.links.googleNewsRssSearch);
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");
  return url.toString();
}

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

export function buildCountyFeedUrl(kind: CountyFeedKind, countyName: string, state: StateSite) {
  const scoped = countyScopedTerms(countyName, state);

  switch (kind) {
    case "localNews":
      return googleNewsRssUrl(`${scoped} local news OR ${scoped} community news`);
    case "localSports":
      return googleNewsRssUrl(
        `${scoped} high school sports OR ${scoped} college sports OR ${scoped} football OR ${scoped} basketball OR ${scoped} baseball OR ${scoped} softball`,
      );
    case "localVideo":
      return googleNewsRssUrl(`${scoped} local news video OR ${scoped} news video`);
    case "obituaries":
      return googleNewsRssUrl(`${scoped} obituaries OR ${scoped} obituary OR ${scoped} funeral home OR ${scoped} death notice`);
  }
}

export function buildMarketFeedUrl(kind: CountyFeedKind, placeName: string, state: StateSite) {
  const scopedPlace = `"${placeName} ${state.name}" OR "${placeName} ${state.abbr}"`;

  switch (kind) {
    case "localNews":
      return googleNewsRssUrl(`${scopedPlace} local news`);
    case "localSports":
      return googleNewsRssUrl(`${scopedPlace} sports OR ${scopedPlace} high school sports OR ${scopedPlace} college sports`);
    case "localVideo":
      return googleNewsRssUrl(`${scopedPlace} news video`);
    case "obituaries":
      return googleNewsRssUrl(`${scopedPlace} obituaries OR ${scopedPlace} funeral home`);
  }
}
