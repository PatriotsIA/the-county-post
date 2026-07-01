import { getCountyByState } from "@nickgraffis/us-counties";
import { countyCentroidsByFips } from "./county-centroids";
import { stateNewsHubs } from "./state-news-hubs";
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
  const centroid = countyCentroidsByFips[county.FIPS];

  return {
    name: county.name,
    slug,
    state,
    fips: county.FIPS,
    displayName,
    latitude: centroid?.[0],
    longitude: centroid?.[1],
    description: `County-level dispatches for ${displayName}, ${state.abbr}. Local headlines, sports, obituaries, and nearby stories in one place.`,
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

export function getCountyMarketCity(county: CountySite) {
  return getCountyMarketCities(county, 1)[0] || county.name;
}

export function getCountyMarketCities(county: CountySite, limit = 2) {
  const explicitCities = county.primaryCity ? [county.primaryCity] : [];
  const hubs = stateNewsHubs[county.state.slug] || [];

  const sortedHubs =
    county.latitude !== undefined && county.longitude !== undefined
      ? [...hubs].sort(
          (a, b) =>
            haversineMiles(county.latitude!, county.longitude!, a.latitude, a.longitude) -
            haversineMiles(county.latitude!, county.longitude!, b.latitude, b.longitude),
        )
      : hubs;

  return Array.from(new Set([...explicitCities, ...sortedHubs.map((hub) => hub.city)])).slice(0, limit);
}

function haversineMiles(latA: number, lonA: number, latB: number, lonB: number) {
  const earthRadiusMiles = 3958.8;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(latB - latA);
  const dLon = toRadians(lonB - lonA);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
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
