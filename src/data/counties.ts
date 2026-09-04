import { getCountyByState } from "@nickgraffis/us-counties";
import { countyCentroidsByFips } from "./county-centroids";
import { getStateBySlug, states, type StateSite } from "./states";

type UsCounty = {
  FIPS: string;
  name: string;
  state: string;
};

export type CountySite = {
  name: string;
  slug: string;
  state: StateSite;
  fips: string;
  displayName: string;
  pageName: string;
  primaryCity?: string;
  localCities?: string[];
  latitude?: number;
  longitude?: number;
  description: string;
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createCountySite(county: UsCounty, state: StateSite): CountySite {
  const slug = slugify(county.name);
  const displayName = `${county.name} County`;
  const pageName = `The County Post - ${displayName}`;
  const centroid = countyCentroidsByFips[county.FIPS];

  return {
    name: county.name,
    slug,
    state,
    fips: county.FIPS,
    displayName,
    pageName,
    latitude: centroid?.[0],
    longitude: centroid?.[1],
    description: `County-level dispatches for ${displayName}, ${state.abbr}. Local headlines, sports, obituaries, and public-interest reporting from this county.`,
  };
}

const countyOverrides: Record<string, Partial<CountySite>> = {
  "texas/potter": {
    primaryCity: "Amarillo",
    localCities: ["Amarillo", "Bushland", "Bishop Hills"],
    latitude: 35.4013,
    longitude: -101.8941,
  },
  "texas/randall": {
    primaryCity: "Amarillo",
    localCities: ["Amarillo", "Canyon", "Lake Tanglewood", "Palisades", "Timbercreek Canyon"],
    latitude: 34.9659,
    longitude: -101.8978,
  },
};

function withOverrides(county: CountySite): CountySite {
  const key = `${county.state.slug}/${county.slug}`;
  const override = countyOverrides[key];
  if (!override) return county;

  return {
    ...county,
    ...override,
  };
}

export const counties = states.flatMap((state) =>
  (getCountyByState(state.name) as UsCounty[]).map((county) => withOverrides(createCountySite(county, state))),
);

const countiesByStateAndSlug = new Map(counties.map((county) => [`${county.state.slug}/${county.slug}`, county]));

export function getCounty(stateSlug?: string, countySlug?: string) {
  if (!stateSlug || !countySlug) return undefined;
  const state = getStateBySlug(stateSlug);
  if (!state) return undefined;
  return countiesByStateAndSlug.get(`${state.slug}/${countySlug.toLowerCase()}`);
}

export function getCountiesForState(stateSlug?: string) {
  const state = getStateBySlug(stateSlug);
  if (!state) return [];
  return counties.filter((county) => county.state.slug === state.slug);
}

export function searchCounties(query: string, limit = 25) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return counties.slice(0, limit);

  return counties
    .filter(
      (county) =>
        county.displayName.toLowerCase().includes(normalized) ||
        county.state.name.toLowerCase().includes(normalized) ||
        county.state.abbr.toLowerCase().includes(normalized),
    )
    .slice(0, limit);
}
