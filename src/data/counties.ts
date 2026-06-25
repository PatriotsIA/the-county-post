import { getCountyByState } from "@nickgraffis/us-counties";
import { buildCountyFeedUrl } from "../lib/county-feed-urls";
import { site } from "./site";
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
  description: string;
  feeds: {
    localNewsUrl: string;
    localSportsUrl: string;
    localVideoUrl: string;
    nationalNewsUrl: string;
    obituariesUrl: string;
  };
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

  return {
    name: county.name,
    slug,
    state,
    fips: county.FIPS,
    displayName,
    description: `County-level dispatches for ${displayName}, ${state.abbr}. Local headlines, sports, obituaries, and nearby stories in one place.`,
    feeds: {
      localNewsUrl: buildCountyFeedUrl("localNews", county.name, state),
      localSportsUrl: buildCountyFeedUrl("localSports", county.name, state),
      localVideoUrl: buildCountyFeedUrl("localVideo", county.name, state),
      nationalNewsUrl: site.links.nationalNews,
      obituariesUrl: buildCountyFeedUrl("obituaries", county.name, state),
    },
  };
}

const countyOverrides: Record<string, Partial<CountySite>> = {
  "texas/potter": {
    primaryCity: "Amarillo",
  },
  "texas/randall": {
    primaryCity: "Amarillo",
  },
};

function withOverrides(county: CountySite): CountySite {
  const key = `${county.state.slug}/${county.slug}`;
  const override = countyOverrides[key];
  if (!override) return county;

  return {
    ...county,
    ...override,
    feeds: { ...county.feeds, ...override.feeds },
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
