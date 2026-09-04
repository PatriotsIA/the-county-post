import type { CountySite } from "../data/counties";
import type { StateSite } from "../data/states";
import { site } from "../data/site";
import { dataCentersOpEd } from "../data/county-post-op-eds";
import { getSubjectGroup, getSubjectPage } from "../data/subjects";
import { atlasDomainLabels } from "./atlas-domain-labels";

export const SITE_URL = site.url;

const TITLE_SUFFIX = ` | ${site.name}`;
const MAX_DESCRIPTION = 158;

/**
 * Absolute URL on the canonical host. Paths are normalised to the form the
 * router and the sitemap both use: leading slash, no trailing slash, no query
 * string. `/` stays `/` so the home canonical is the bare origin.
 */
export function canonicalUrl(path: string) {
  const [withoutHash] = path.split("#");
  const [pathname] = withoutHash.split("?");
  const normalized = `/${pathname.replace(/^\/+/, "").replace(/\/+$/, "")}`;
  return normalized === "/" ? `${SITE_URL}/` : `${SITE_URL}${normalized}`;
}

export function absoluteUrl(path: string) {
  return path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Appends the masthead to a page title unless the title already carries it. */
export function pageTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return site.name;
  // A title that already names the masthead does not get it a second time.
  if (trimmed.includes(site.name)) return trimmed;
  return `${trimmed}${TITLE_SUFFIX}`;
}

/** Trims a description to a whole word inside the snippet budget. */
export function clampDescription(text: string, max = MAX_DESCRIPTION) {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  const cut = collapsed.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, "")}…`;
}

/* -------------------------------------------------------------------------- */
/* Index policy                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The route table multiplies out to roughly 100,000 URLs. Every page gets full
 * metadata; only pages carrying genuinely distinct content get indexed and
 * submitted. Thin permutations over the same aggregated feeds are what Google's
 * scaled-content and doorway-page policies target, so they are kept out of the
 * sitemap or marked noindex outright.
 *
 * - `sitemap`  indexed, listed in sitemap.xml
 * - `index`    indexed, discovered through internal links only
 * - `noindex`  utility routes with no standalone value
 */
export type IndexTier = "sitemap" | "index" | "noindex";

export const indexPolicy = {
  home: "sitemap",
  topic: "sitemap",
  stateDirectory: "sitemap",
  state: "sitemap",
  county: "sitemap",
  countyData: "sitemap",
  countyWeather: "sitemap",
  countyEconomicData: "sitemap",
  countyLocalSources: "sitemap",
  editorial: "sitemap",
  legal: "sitemap",

  countyOpEds: "index",
  countyPartners: "index",
  countyAtlasDomain: "index",
  countySubject: "index",
  stateSubject: "index",

  countySubmit: "noindex",
  submit: "noindex",
  classifieds: "noindex",
  notFound: "noindex",
} as const satisfies Record<string, IndexTier>;

export type IndexPolicyKey = keyof typeof indexPolicy;

export function robotsContent(tier: IndexTier) {
  if (tier === "noindex") return "noindex, follow";
  // max-image-preview:large opts county and atlas pages into rich image results;
  // max-snippet:-1 lets Google use a full-length snippet from the page.
  return "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
}

/* -------------------------------------------------------------------------- */
/* Location phrasing                                                          */
/* -------------------------------------------------------------------------- */

/** "Potter County, Texas" */
export function countyLabel(county: CountySite) {
  return `${county.displayName}, ${county.state.name}`;
}

/** "Amarillo and Potter County, Texas" when a primary city is known. */
export function countyPlaceLabel(county: CountySite) {
  return county.primaryCity ? `${county.primaryCity} and ${countyLabel(county)}` : countyLabel(county);
}

/**
 * A short clause naming the towns a county page actually covers. Keeps county
 * descriptions from reading as 3,143 copies of one sentence.
 */
function countyCommunities(county: CountySite) {
  const cities = county.localCities?.filter(Boolean) ?? [];
  if (cities.length >= 2) return ` Covering ${cities.slice(0, 3).join(", ")}.`;
  if (county.primaryCity) return ` Covering ${county.primaryCity} and the surrounding communities.`;
  return "";
}

/* -------------------------------------------------------------------------- */
/* Per-page titles and descriptions                                           */
/* -------------------------------------------------------------------------- */

export type SeoCopy = { title: string; description: string };

export const homeSeo = (): SeoCopy => ({
  title: `${site.name} — Local News for Every U.S. County`,
  description: site.description,
});

export const countySeo = (county: CountySite): SeoCopy => ({
  title: `${countyLabel(county)} News`,
  description: clampDescription(
    `Local news for ${countyLabel(county)}: headlines, sports, obituaries, public notices, weather, and county data.${countyCommunities(county)}`,
  ),
});

export const countyWeatherSeo = (county: CountySite): SeoCopy => ({
  title: `${countyLabel(county)} Weather`,
  description: clampDescription(
    `Current conditions, National Weather Service alerts, seven-day and hourly forecasts, drought status, and 14-day rainfall for ${countyPlaceLabel(county)}.`,
  ),
});

export const countyDataSeo = (county: CountySite): SeoCopy => ({
  title: `${countyLabel(county)} Data Atlas`,
  description: clampDescription(
    `Official data for ${countyLabel(county)}: demographics, economy, housing, jobs, education, health, elections, public safety, agriculture, and infrastructure.`,
  ),
});

export const countyAtlasDomainSeo = (county: CountySite, domainLabel: string): SeoCopy => ({
  title: `${domainLabel} Data — ${countyLabel(county)}`,
  description: clampDescription(
    `${domainLabel} measures for ${countyLabel(county)} with trends, comparisons, source citations, and data vintages from official federal and state releases.`,
  ),
});

export const countyEconomicSeo = (county: CountySite): SeoCopy => ({
  title: `${countyLabel(county)} Economic Data`,
  description: clampDescription(
    `Unemployment rate, per-capita personal income, and GDP history for ${countyLabel(county)}, sourced from Federal Reserve Economic Data (FRED).`,
  ),
});

export const countyLocalSourcesSeo = (county: CountySite): SeoCopy => ({
  title: `Local News Sources in ${countyLabel(county)}`,
  description: clampDescription(
    `Reviewed newspapers, radio stations, and television outlets covering ${countyPlaceLabel(county)}, with links to each publisher.`,
  ),
});

export const countyOpEdsSeo = (county: CountySite): SeoCopy => ({
  title: `${countyLabel(county)} Opinion & Op-Eds`,
  description: clampDescription(
    `Opinion, columns, and op-eds from and about ${countyLabel(county)}, alongside commentary on the issues facing the county.`,
  ),
});

export const countyPartnersSeo = (county: CountySite): SeoCopy => ({
  title: `${countyLabel(county)} Partners & Local Business`,
  description: clampDescription(
    `Local businesses and organizations partnering with ${site.name} in ${countyPlaceLabel(county)}.`,
  ),
});

export const countyClassifiedsSeo = (county: CountySite): SeoCopy => ({
  title: `${countyLabel(county)} Classifieds`,
  description: clampDescription(`Submit and browse classified listings for ${countyLabel(county)}.`),
});

export const countySubjectSeo = (county: CountySite, subjectTitle: string, subjectDescription: string): SeoCopy => ({
  title: `${subjectTitle} — ${countyLabel(county)}`,
  description: clampDescription(`${subjectTitle} coverage for ${countyLabel(county)}. ${subjectDescription}`),
});

export const stateSeo = (state: StateSite, countyCount: number): SeoCopy => ({
  title: `${state.name} County News`,
  description: clampDescription(
    `News from across ${state.name}: county-by-county headlines, politics, economy, public notices, and obituaries from all ${countyCount} ${state.name} counties.`,
  ),
});

export const stateSubjectSeo = (state: StateSite, subjectTitle: string, subjectDescription: string): SeoCopy => ({
  title: `${subjectTitle} — ${state.name}`,
  description: clampDescription(`${subjectTitle} coverage across ${state.name}. ${subjectDescription}`),
});

export const topicSeo = (topicTitle: string, topicDescription: string): SeoCopy => ({
  title: topicTitle,
  description: clampDescription(topicDescription),
});

export const stateDirectorySeo = (): SeoCopy => ({
  title: "Find Your State & County News Desk",
  description: clampDescription(
    `Browse all 50 states, the District of Columbia, and 3,143 county news desks. Find local headlines, data, and weather for your county.`,
  ),
});

export const submitSeo = (scope?: string): SeoCopy => ({
  title: scope ? `Submit a Story — ${scope}` : "Submit a Story or Op-Ed",
  description: clampDescription(
    `Send news tips, community announcements, obituaries, and op-eds to ${site.name}${scope ? ` for ${scope}` : ""}.`,
  ),
});

/* -------------------------------------------------------------------------- */
/* JSON-LD                                                                    */
/* -------------------------------------------------------------------------- */

type Json = Record<string, unknown>;

const publisherRef = { "@type": "NewsMediaOrganization", "@id": `${SITE_URL}/#organization` };

export function organizationLd(): Json {
  return {
    "@type": "NewsMediaOrganization",
    "@id": `${SITE_URL}/#organization`,
    name: site.name,
    alternateName: site.shortName,
    url: `${SITE_URL}/`,
    slogan: site.tagline,
    description: site.description,
    foundingDate: site.founded,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl(site.logo),
      width: 512,
      height: 512,
    },
    email: site.contact.email,
    areaServed: { "@type": "Country", name: "United States" },
  };
}

export function webSiteLd(): Json {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: site.name,
    alternateName: site.shortName,
    url: `${SITE_URL}/`,
    description: site.description,
    inLanguage: "en-US",
    publisher: publisherRef,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/states?county={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbLd(crumbs: Crumb[]): Json {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: canonicalUrl(crumb.path),
    })),
  };
}

/** Breadcrumb trail down to a county, optionally with a section leaf. */
export function countyCrumbs(county: CountySite, leaf?: { name: string; slug: string }): Crumb[] {
  const trail: Crumb[] = [
    { name: "United States", path: "/" },
    { name: county.state.name, path: `/${county.state.slug}` },
    { name: county.displayName, path: `/${county.state.slug}/${county.slug}` },
  ];
  if (leaf) trail.push({ name: leaf.name, path: `/${county.state.slug}/${county.slug}/${leaf.slug}` });
  return trail;
}

export function collectionPageLd(options: { path: string; name: string; description: string; crumbs?: Crumb[] }): Json {
  return {
    "@type": "CollectionPage",
    "@id": `${canonicalUrl(options.path)}#page`,
    url: canonicalUrl(options.path),
    name: options.name,
    description: options.description,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    publisher: publisherRef,
    inLanguage: "en-US",
    ...(options.crumbs ? { breadcrumb: breadcrumbLd(options.crumbs) } : {}),
  };
}

/**
 * The county as a place, so search engines can connect the desk to the
 * administrative area it covers. FIPS is published as an identifier because it
 * is the join key every official dataset on the site uses.
 */
export function countyPlaceLd(county: CountySite): Json {
  return {
    "@type": "AdministrativeArea",
    "@id": `${canonicalUrl(`/${county.state.slug}/${county.slug}`)}#place`,
    name: county.displayName,
    alternateName: countyLabel(county),
    url: canonicalUrl(`/${county.state.slug}/${county.slug}`),
    identifier: { "@type": "PropertyValue", propertyID: "FIPS", value: county.fips },
    containedInPlace: { "@type": "State", name: county.state.name, url: canonicalUrl(`/${county.state.slug}`) },
    ...(county.latitude != null && county.longitude != null
      ? { geo: { "@type": "GeoCoordinates", latitude: county.latitude, longitude: county.longitude } }
      : {}),
  };
}

export function datasetLd(options: {
  path: string;
  name: string;
  description: string;
  county: CountySite;
  keywords?: string[];
}): Json {
  return {
    "@type": "Dataset",
    "@id": `${canonicalUrl(options.path)}#dataset`,
    url: canonicalUrl(options.path),
    name: options.name,
    description: options.description,
    license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true,
    creator: publisherRef,
    spatialCoverage: countyPlaceLd(options.county),
    ...(options.keywords?.length ? { keywords: options.keywords } : {}),
  };
}

export function newsArticleLd(options: {
  path: string;
  headline: string;
  description: string;
  publishedAt: string;
  authorName: string;
  section?: string;
  body?: string;
}): Json {
  return {
    "@type": "NewsArticle",
    "@id": `${canonicalUrl(options.path)}#article`,
    mainEntityOfPage: canonicalUrl(options.path),
    url: canonicalUrl(options.path),
    headline: options.headline,
    description: options.description,
    datePublished: options.publishedAt,
    dateModified: options.publishedAt,
    author: { "@type": "Person", name: options.authorName },
    publisher: publisherRef,
    image: [absoluteUrl(site.ogImage)],
    inLanguage: "en-US",
    isAccessibleForFree: true,
    ...(options.section ? { articleSection: options.section } : {}),
    ...(options.body ? { articleBody: options.body } : {}),
  };
}

export function webPageLd(options: { path: string; name: string; description: string; crumbs?: Crumb[] }): Json {
  return {
    "@type": "WebPage",
    "@id": `${canonicalUrl(options.path)}#page`,
    url: canonicalUrl(options.path),
    name: options.name,
    description: options.description,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    publisher: publisherRef,
    inLanguage: "en-US",
    ...(options.crumbs ? { breadcrumb: breadcrumbLd(options.crumbs) } : {}),
  };
}

/** Wraps one or more node objects in a single @graph document. */
export function jsonLdGraph(...nodes: (Json | null | undefined)[]) {
  const graph = nodes.filter(Boolean) as Json[];
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
}

/* -------------------------------------------------------------------------- */
/* Visible breadcrumb trail                                                   */
/* -------------------------------------------------------------------------- */

/** Leaf labels for the county and state sections that hang off a desk. */
const SECTION_LABELS: Record<string, string> = {
  weather: "Weather",
  data: "County Data",
  "economic-data": "Economic Data",
  "op-eds": "Op-Eds",
  partners: "Partners",
  "local-sources": "Local Sources",
  submit: "Submit A Story",
  classifieds: "Classifieds",
};

function sectionLabel(slug: string) {
  if (SECTION_LABELS[slug]) return SECTION_LABELS[slug];
  const group = getSubjectGroup(slug);
  if (group) return group.title;
  const subject = getSubjectPage(slug);
  if (subject) return subject.title;
  return undefined;
}

/**
 * The trail rendered above the page and mirrored into BreadcrumbList JSON-LD:
 *
 *   United States › Texas › Lubbock County › Weather
 *
 * Derived from the pathname rather than passed in per route, so the visible
 * breadcrumbs and the structured data cannot drift apart as routes are added.
 * Returns a single crumb for the front page, which the renderer treats as
 * "nothing to show".
 */
export function crumbTrail(pathname: string, county?: CountySite, state?: StateSite): Crumb[] {
  const trail: Crumb[] = [{ name: "United States", path: "/" }];
  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) return trail;

  if (segments[0] === "topics") {
    const slug = segments[1];
    const group = getSubjectGroup(slug);
    if (group) {
      trail.push({ name: group.title, path: `/topics/${group.slug}` });
      return trail;
    }
    const subject = getSubjectPage(slug);
    if (subject) {
      trail.push({ name: subject.categoryTitle, path: `/topics/${subject.categorySlug}` });
      trail.push({ name: subject.title, path: `/topics/${subject.slug}` });
    }
    return trail;
  }

  if (segments[0] === "states") {
    trail.push({ name: "States & Counties", path: "/states" });
    return trail;
  }

  if (county) {
    trail.push({ name: county.state.name, path: `/${county.state.slug}` });
    trail.push({ name: county.displayName, path: `/${county.state.slug}/${county.slug}` });

    const rest = segments.slice(2);
    if (rest.length) {
      const base = `/${county.state.slug}/${county.slug}`;
      const label = sectionLabel(rest[0]);
      if (label) trail.push({ name: label, path: `${base}/${rest[0]}` });
      // /data/:domain — the atlas domain is the leaf.
      if (rest[0] === "data" && rest[1]) {
        const domain = atlasDomainLabels[rest[1] as keyof typeof atlasDomainLabels];
        if (domain) trail.push({ name: domain, path: `${base}/data/${rest[1]}` });
      }
    }
    return trail;
  }

  if (state) {
    trail.push({ name: state.name, path: `/${state.slug}` });
    const label = segments[1] ? sectionLabel(segments[1]) : undefined;
    if (label) trail.push({ name: label, path: `/${state.slug}/${segments[1]}` });
    return trail;
  }

  // A published op-ed sits under the opinion desk.
  if (segments[0] === "op-eds" && segments[1]) {
    trail.push({ name: "Op-Eds", path: "/op-eds" });
    if (segments[1] === dataCentersOpEd.slug) {
      trail.push({ name: dataCentersOpEd.title, path: dataCentersOpEd.path });
    }
    return trail;
  }

  // Standalone editorial and legal pages.
  const staticLabels: Record<string, string> = {
    about: "About",
    partners: "Partners",
    "op-eds": "Op-Eds",
    submit: "Submit A Story",
    privacy: "Privacy",
    terms: "Terms",
  };
  const label = staticLabels[segments[0]];
  if (label) trail.push({ name: label, path: `/${segments[0]}` });
  return trail;
}
