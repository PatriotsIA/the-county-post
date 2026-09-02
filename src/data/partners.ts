import { ads, isAdVisibleInCounty, isCarouselOnlyAd, PARTNER_DIRECTORY_PATH, type AdCreative } from "./ads";
import { getCounty } from "./counties";

export function countyPartnersPath(stateSlug: string, countySlug: string) {
  return `/${stateSlug}/${countySlug}/partners`;
}

export function isPartnerDirectoryHref(href: string) {
  return href === PARTNER_DIRECTORY_PATH;
}

function preferPartnerCandidate(existing: AdCreative, candidate: AdCreative) {
  const existingIsPlaceholder = isPartnerDirectoryHref(existing.href);
  const candidateIsPlaceholder = isPartnerDirectoryHref(candidate.href);
  if (existingIsPlaceholder && !candidateIsPlaceholder) return candidate;
  if (!existingIsPlaceholder && candidateIsPlaceholder) return existing;
  if (existing.slot === "banner" && candidate.slot === "inline") return candidate;
  return existing;
}

/** Unique partner listings derived from ad creatives. County-scoped ads are included automatically. */
export function getPartnerCreatives(): AdCreative[] {
  const byName = new Map<string, AdCreative>();

  for (const ad of ads) {
    if (isCarouselOnlyAd(ad.id)) continue;
    const existing = byName.get(ad.name);
    byName.set(ad.name, existing ? preferPartnerCandidate(existing, ad) : ad);
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function getSitewidePartners(): AdCreative[] {
  return getPartnerCreatives().filter((partner) => !partner.countyKeys?.length);
}

export function getCountyScopedPartners(): AdCreative[] {
  return getPartnerCreatives().filter((partner) => partner.countyKeys?.length);
}

export function getPartnersForCounty(countyKey: string): AdCreative[] {
  return getPartnerCreatives().filter((partner) => isAdVisibleInCounty(partner, countyKey));
}

export function getLocalCountyPartners(countyKey: string): AdCreative[] {
  return getPartnerCreatives().filter((partner) => partner.countyKeys?.includes(countyKey));
}

export function getCountyPartnerPageKeys(): string[] {
  const keys = new Set<string>();

  for (const partner of getCountyScopedPartners()) {
    for (const key of partner.countyKeys ?? []) {
      keys.add(key);
    }
  }

  return Array.from(keys).sort((a, b) => formatPartnerCountyLabel(a).localeCompare(formatPartnerCountyLabel(b)));
}

export function formatPartnerCountyLabel(countyKey: string) {
  const [stateSlug, countySlug] = countyKey.split("/");
  const county = getCounty(stateSlug, countySlug);
  return county?.displayName ?? countyKey;
}

export function formatPartnerCountyLabels(countyKeys: string[]) {
  return countyKeys.map(formatPartnerCountyLabel).join(", ");
}
