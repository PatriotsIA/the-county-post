import type { CountySite } from "../data/counties";
import { countyAtlasDomains, type CountyAtlasDomain } from "./county-atlas-api";

export const atlasDomainLabels: Record<CountyAtlasDomain, string> = {
  demographics: "Demographics",
  economy: "Economy & Income",
  housing: "Housing",
  "jobs-business": "Jobs & Business",
  education: "Education",
  health: "Health",
  "civic-elections": "Civic Life & Elections",
  "public-safety": "Public Safety",
  agriculture: "Agriculture",
  "environment-disasters": "Environment & Disasters",
  "government-finance": "Government & Public Finance",
  infrastructure: "Infrastructure & Connectivity",
};

/** The data overview plus one link per atlas domain, for the data nav and the phone jump menu. */
export function atlasDomainLinks(county: CountySite) {
  const base = `/${county.state.slug}/${county.slug}/data`;
  return [
    { to: base, label: "Overview", end: true },
    ...countyAtlasDomains.map((domain) => ({ to: `${base}/${domain}`, label: atlasDomainLabels[domain], end: false })),
  ];
}
