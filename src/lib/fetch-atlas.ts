import type { CountySite } from "../data/counties";
import {
  fetchCountyAtlasDomain,
  fetchCountyAtlasOverview,
  type CountyAtlasDomain,
  type CountyAtlasMetric,
} from "./county-atlas-api";

// POP100 by GEOID in the Census Bureau's 2020 county table for Connecticut.
// These are the eight geographies used by the edition directory.
const population2020: Record<string, number> = {
  "09001": 957419,
  "09003": 899498,
  "09005": 185186,
  "09007": 164245,
  "09009": 864835,
  "09011": 268555,
  "09013": 149788,
  "09015": 116418,
};

function historicalPopulation(county: CountySite): CountyAtlasMetric | undefined {
  const value = population2020[county.fips];
  if (value === undefined) return;
  return {
    key: "population",
    domain: "demographics",
    label: "Population",
    value,
    valueKind: "number",
    unit: "people",
    chart: "none",
    date: "2020-04-01",
    vintage: "2020 Census · historical county boundaries",
    description:
      "April 1, 2020 population count for this edition’s historic county. More recent federal county data for Connecticut uses planning regions.",
    source: {
      id: "decennial-census-2020",
      name: "U.S. Census Bureau · 2020 Census county counts",
      agency: "U.S. Census Bureau",
      cadence: "Decennial",
      url: "https://tigerweb.geo.census.gov/tigerwebmain/Files/acs25/tigerweb_acs25_county_2020_tab20_ct.html",
    },
  };
}

export async function fetchGuideAtlasOverview(county: CountySite, signal?: AbortSignal) {
  const doc = await fetchCountyAtlasOverview(county.state.slug, county.slug, signal);
  const metric = historicalPopulation(county);
  if (!metric || doc.county.fips !== county.fips) return doc;
  return {
    ...doc,
    domains: doc.domains.map((d) =>
      d.domain.slug === metric.domain && !d.available && !d.featuredMetrics.length
        ? { ...d, available: true, featuredMetrics: [metric] }
        : d,
    ),
  };
}

export async function fetchGuideAtlasDomain(
  county: CountySite,
  domain: CountyAtlasDomain,
  signal?: AbortSignal,
) {
  const doc = await fetchCountyAtlasDomain(county.state.slug, county.slug, domain, signal);
  if (
    domain !== "demographics" ||
    doc.county.fips !== county.fips ||
    doc.domain.slug !== domain ||
    doc.metrics.length
  )
    return doc;
  const metric = historicalPopulation(county);
  return metric ? { ...doc, metrics: [metric] } : doc;
}
