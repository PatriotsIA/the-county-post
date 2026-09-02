import { NavLink } from "react-router-dom";
import type { CountySite } from "../data/counties";
import { atlasDomainLabels } from "../lib/atlas-domain-labels";
import { countyAtlasDomains } from "../lib/county-atlas-api";

export function AtlasDomainNav({ county }: { county: CountySite }) {
  const base = `/${county.state.slug}/${county.slug}/data`;
  return (
    <nav className="atlas-domain-nav" aria-label={`${county.displayName} data domains`}>
      <NavLink to={base} end className={({ isActive }) => (isActive ? "active" : "")}>
        Overview
      </NavLink>
      {countyAtlasDomains.map((domain) => (
        <NavLink key={domain} to={`${base}/${domain}`} className={({ isActive }) => (isActive ? "active" : "")}>
          {atlasDomainLabels[domain]}
        </NavLink>
      ))}
    </nav>
  );
}
