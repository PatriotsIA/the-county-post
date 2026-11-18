import { getCountiesForState, getCounty } from "../data/counties";

const supportedOrigins = new Set([
  "https://classifieds.thecountypost.com",
  "https://staging-classifieds.thecountypost.com",
]);

// Public launch authorized November 9. Local preview may explicitly target staging.
export function classifiedsOrigin(): string | null {
  const configured = import.meta.env.VITE_CLASSIFIEDS_ORIGIN?.trim() ?? "https://classifieds.thecountypost.com";
  if (!configured) return null;
  try {
    const url = new URL(configured);
    return supportedOrigins.has(url.origin) && url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password
      ? url.origin : null;
  } catch {
    return null;
  }
}

export function countyClassifiedsUrl(fips: string, action: "browse" | "post" = "browse"): string | null {
  const origin = classifiedsOrigin();
  if (!origin || !/^\d{5}$/.test(fips)) return null;
  return `${origin}/from-county-post/county/${fips}/${action === "post" ? "?action=post" : ""}`;
}

export function stateClassifiedsUrl(fips: string): string | null {
  const origin = classifiedsOrigin();
  return origin && /^\d{2}$/.test(fips) ? `${origin}/from-county-post/state/${fips}/` : null;
}

/** Where on The County Post a reader followed a link into the marketplace from. */
export type ClassifiedsPlacement = "nav" | "banner-ad" | "inline-ad" | "feed-ad" | "feed-sponsor" | "carousel" | "link";

/**
 * Tags a marketplace link with the County Post page it was followed from:
 * utm_source=thecountypost, utm_medium the kind of link, utm_campaign
 * classifieds and utm_content the page's path, e.g. /texas/potter/weather.
 */
export function withCountyPostUtm(url: string, placement: ClassifiedsPlacement, pagePath: string) {
  const target = new URL(url);
  target.searchParams.set("utm_source", "thecountypost");
  target.searchParams.set("utm_medium", placement);
  target.searchParams.set("utm_campaign", "classifieds");
  target.searchParams.set("utm_content", pagePath.replace(/\/+$/, "") || "/");
  return target.toString();
}

/**
 * The marketplace at the edition's level: a county's listings, a state's, or
 * the whole marketplace on national pages. An edition key is a state slug or
 * a state/county pair, as the ads use; undefined is national.
 */
export function editionClassifiedsUrl(editionKey?: string, action: "browse" | "post" = "browse"): string | null {
  const origin = classifiedsOrigin();
  if (!origin) return null;
  const [stateSlug, countySlug] = editionKey?.split("/") ?? [];
  if (countySlug) {
    const county = getCounty(stateSlug, countySlug);
    if (county) return countyClassifiedsUrl(county.fips, action);
  }
  const stateFips = stateSlug ? getCountiesForState(stateSlug)[0]?.fips.slice(0, 2) : undefined;
  return (stateFips && stateClassifiedsUrl(stateFips)) || `${origin}/`;
}
