import { NavLink } from "react-router-dom";
import type { CountySite } from "../data/counties";
import { atlasDomainLinks } from "../lib/atlas-domain-labels";

export function AtlasDomainNav({ county }: { county: CountySite }) {
  return (
    <nav className="atlas-domain-nav" aria-label={`${county.displayName} data domains`}>
      {atlasDomainLinks(county).map((link) => (
        <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => (isActive ? "active" : "")}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
