import type { CountyAtlasDomain } from "./county-atlas-api";

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
