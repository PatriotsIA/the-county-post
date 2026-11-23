import rawRecords from "../data/county-crime.json?raw";
import type { CountySite } from "../data/counties";
import type {
  CountyAtlasDomainDocument,
  CountyAtlasMetric,
  CountyAtlasOverview,
  CountyAtlasSource,
} from "./county-atlas-api";

type RecordRow = {
  source: "agency" | "returnA" | "chr" | "ct";
  year: number;
  violent: number;
  property?: number;
  violentCount?: number;
  propertyCount?: number;
  coverage?: number;
};
const {
  counties: records,
  states,
}: { counties: Record<string, RecordRow | null>; states: Record<string, [number, number]> } =
  JSON.parse(rawRecords);
const sources: Record<RecordRow["source"], CountyAtlasSource> = {
  agency: {
    id: "probative-county-ucr-2.1.0",
    agency: "Probative Growth · FBI Uniform Crime Reporting",
    name: "Crime and arrests by county and state, v2.1.0",
    url: "https://doi.org/10.5281/zenodo.24011321",
    cadence: "Annual",
    methodology:
      "The publisher assigns each agency to its headquarters county. A department can serve residents across county lines. Rates use the population served by reporting agencies. Coverage weights agency populations by the months of reporting.",
    licenseNote:
      "County Post extract of Probative Growth v2.1.0, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Combined rates sum the two published rates.",
  },
  returnA: {
    id: "placestats-ucr-return-a",
    agency: "PlaceStats · FBI Uniform Crime Reporting",
    name: "County crime rates from the FBI Return A master file",
    cadence: "Annual",
    url: "https://placestats.org/us/indicator/ucr-violent_crime_rate/",
    methodology:
      "PlaceStats publishes county rates where agencies reporting all 12 months serve at least 90% of residents. Property crime includes burglary, larceny-theft and motor vehicle theft.",
  },
  ct: {
    id: "connecticut-dcj-2024",
    agency: "Connecticut Division of Criminal Justice",
    name: "2024 reported crime by judicial district",
    cadence: "Annual",
    url: "https://portal.ct.gov/dcj/-/media/dcj-beta/connecticut-data-report2025.pdf#page=3",
    methodology:
      "The judicial district and historic county have the same towns. Rates are calculated from the published offense counts and district population.",
  },
  chr: {
    id: "chr-2022-violent-crime",
    agency: "University of Wisconsin Population Health Institute",
    name: "County Health Rankings 2022 · violent crime trends",
    cadence: "Historical series",
    url: "https://www.countyhealthrankings.org/health-data/methodology-and-sources/data-documentation/national-data-documentation-2010-2023",
    methodology:
      "Historical annual rate of violent crimes reported to law enforcement per 100,000 reporting population. This release contains observations through 2016.",
  },
};

const agencyLookup: CountyAtlasSource = {
  id: "bjs-learcat",
  agency: "Bureau of Justice Statistics",
  name: "Explore local agency reports in LEARCAT",
  url: "https://learcat.bjs.ojp.gov/",
  cadence: "Annual",
  methodology: "Select a state and county to explore participating law enforcement agencies and the incidents they reported.",
};

const description = "Reported crime rates and offense counts, alongside fatal traffic crashes and deaths.";
const defaultDomain = {
  slug: "public-safety" as const,
  label: "Public Safety",
  shortLabel: "Safety",
  description,
  metricKeys: [],
  sourceIds: [],
};

export function countyCrime(county: CountySite) {
  const row = records[county.fips];
  const metrics: CountyAtlasMetric[] = [];
  if (!row) {
    const [violent, property] = states[county.state.abbr];
    return {
      metrics,
      sources: [sources.agency, agencyLookup],
      warnings: [
        `No verified county crime figures are available for ${county.displayName} in the included releases.`,
        `State context only · ${county.state.name}, 2025. Reporting agencies recorded ${violent.toLocaleString("en-US")} violent offenses and ${property.toLocaleString("en-US")} property offenses per 100,000 reporting population statewide.`,
      ],
    };
  }
  const source = sources[row.source];
  const scope =
    row.source === "agency"
      ? `Agencies assigned to ${county.displayName} reported with ${row.coverage}% population-weighted coverage. Agencies can serve people across county lines.`
      : row.source === "returnA"
        ? `Agencies reporting all 12 months served at least 90% of the county population in ${row.year}.`
        : row.source === "ct"
          ? "This judicial district covers exactly the towns in the historic county. Rates use its published population."
          : "This historical release covers violent crime only.";
  const { year, coverage, source: sourceKey } = row;
  const geography =
    sourceKey === "agency"
      ? "Reporting agencies grouped by headquarters county"
      : sourceKey === "ct"
        ? "Historic county and judicial district with the same towns"
        : "County reporting population";
  const period = row.year === 2025 ? String(row.year) : `${row.year} · historical observation`;
  function add(key: string, label: string, value: number | undefined, unit: string) {
    if (value === undefined) return;
    metrics.push({
      key,
      label,
      domain: "public-safety",
      value,
      valueKind: "number",
      unit,
      chart: "none",
      vintage: period,
      date: year + "-12-31",
      retrievedAt: "2026-11-20",
      description: scope,
      coveragePercent: coverage,
      geographyVintage: geography,
      source:
        sourceKey === "returnA" && key.startsWith("property")
          ? { ...source, url: "https://placestats.org/us/indicator/ucr-property_crime_rate/" }
          : source,
    });
  }
  const rateUnit = sourceKey === "ct" || sourceKey === "returnA" ? "per 100,000 residents" : "per 100,000 reporting population";
  add("violent-crime-rate", "Reported violent crime rate", row.violent, rateUnit);
  add("property-crime-rate", "Reported property crime rate", row.property, rateUnit);
  add(
    "reported-crime-rate",
    "Combined reported violent and property crime rate",
    row.property === undefined ? undefined : Number((row.violent + row.property).toFixed(2)),
    rateUnit,
  );
  add("violent-crime-count", "Reported violent offenses", row.violentCount, "offenses");
  add("property-crime-count", "Reported property offenses", row.propertyCount, "offenses");
  const warnings = [scope];
  if (row.year !== 2025)
    warnings.unshift(
      `No 2025 agency series is available for this county. The available observation is from ${row.year}.`,
    );
  return { metrics, sources: [source], warnings };
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}
export function withCountyCrime(
  county: CountySite,
  doc?: CountyAtlasDomainDocument,
): CountyAtlasDomainDocument {
  const crime = countyCrime(county);
  const remote = doc?.metrics || [];
  const metrics = [
    ...remote,
    ...crime.metrics.filter((m) => !remote.some((existing) => existing.key === m.key)),
  ];
  const domain = doc?.domain || defaultDomain;
  const allSources = [
    ...(doc?.meta.sources || []),
    ...crime.sources.filter((s) => !doc?.meta.sources?.some((r) => r.id === s.id)),
  ];
  return {
    county: doc?.county || {
      name: county.name,
      displayName: county.displayName,
      fips: county.fips,
      slug: county.slug,
      stateName: county.state.name,
      stateAbbr: county.state.abbr,
      stateSlug: county.state.slug,
    },
    domain: {
      ...domain,
      description,
      metricKeys: unique([...(domain.metricKeys || []), ...metrics.map((m) => m.key)]),
      sourceIds: unique([...(domain.sourceIds || []), ...crime.sources.map((s) => s.id)]),
    },
    metrics,
    warnings: unique([
      ...(doc?.warnings || [
        "The live Atlas desk could not be loaded. This page shows the saved crime release.",
      ]),
      ...crime.warnings,
    ]),
    meta: {
      ...(doc?.meta || {
        version: "county-crime-2026-11-20",
        generatedAt: "2026-11-20",
        retrievedAt: "2026-11-20",
        partial: true,
        cacheTtlSeconds: 0,
      }),
      sources: allSources,
    },
  };
}

export function withCrimeOverview(county: CountySite, doc: CountyAtlasOverview): CountyAtlasOverview {
  const crime = countyCrime(county);
  const domains = [...doc.domains];
  const index = domains.findIndex((entry) => entry.domain.slug === "public-safety");
  const current = domains[index];
  const domain = current?.domain || defaultDomain;
  const featured = current?.featuredMetrics || [];
  const entry = {
    domain: {
      ...domain,
      description,
      metricKeys: unique([...(domain.metricKeys || []), ...crime.metrics.map((m) => m.key)]),
      sourceIds: unique([...(domain.sourceIds || []), ...crime.sources.map((s) => s.id)]),
    },
    available: Boolean(current?.available || crime.metrics.length),
    featuredMetrics: [
      ...featured,
      ...crime.metrics.slice(0, 1).filter((m) => !featured.some((x) => x.key === m.key)),
    ],
    warnings: unique([...(current?.warnings || []), ...crime.warnings]),
  };
  if (index < 0) domains.push(entry);
  else domains[index] = entry;
  return {
    ...doc,
    domains,
    meta: {
      ...doc.meta,
      sources: [
        ...(doc.meta.sources || []),
        ...crime.sources.filter((s) => !doc.meta.sources?.some((r) => r.id === s.id)),
      ],
    },
  };
}
