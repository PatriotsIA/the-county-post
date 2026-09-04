import { Seo } from "./Seo";
import { collectionPageLd, jsonLdGraph } from "../lib/seo";
import { Link } from "react-router-dom";
import type { AdCreative } from "../data/ads";
import type { CountySite } from "../data/counties";
import { countyAdKey } from "../data/ads";
import {
  countyPartnersPath,
  formatPartnerCountyLabel,
  formatPartnerCountyLabels,
  getCountyPartnerPageKeys,
  getCountyScopedPartners,
  getLocalCountyPartners,
  getSitewidePartners,
  isPartnerDirectoryHref,
} from "../data/partners";

function PartnerCallout() {
  return (
    <section className="partner-callout">
      <div>
        <p className="kicker">Founding partners</p>
        <h2>Become a County Post partner</h2>
        <p>Put your organization in front of readers following national, state, and local news.</p>
      </div>
      <a href="https://www.advertise.thecountypost.com/advertise" className="partner-callout-action" target="_blank" rel="noreferrer">
        Learn More
      </a>
    </section>
  );
}

function PartnerList({ partners, showCountyCoverage = false }: { partners: AdCreative[]; showCountyCoverage?: boolean }) {
  if (!partners.length) {
    return <p className="muted">No partners listed yet.</p>;
  }

  return (
    <div className="partner-directory">
      {partners.map((partner) => (
        <article key={partner.id} className="partner-card">
          <img src={partner.image} alt="" />
          <div>
            <h3>{partner.name}</h3>
            {showCountyCoverage && partner.countyKeys?.length ? (
              <p className="partner-coverage">Supporting {formatPartnerCountyLabels(partner.countyKeys)}</p>
            ) : (
              <p>Supporting independent county-by-county news coverage.</p>
            )}
            {isPartnerDirectoryHref(partner.href) ? (
              <span className="partner-directory-label">County Post partner</span>
            ) : (
              <a href={partner.href} target="_blank" rel="noreferrer sponsored">
                Visit partner
              </a>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

export function GlobalPartnerDirectory() {
  const sitewidePartners = getSitewidePartners();
  const countyPartners = getCountyScopedPartners();
  const countyPartnerPages = getCountyPartnerPageKeys();

  return (
    <div className="layout-grid">
      <Seo
        title="Partners & Advertisers"
        description="Businesses and organizations that support The County Post across its national, state, and county editions."
        policy="editorial"
        jsonLd={jsonLdGraph(
          collectionPageLd({
            path: "/partners",
            name: "Partners & Advertisers",
            description: "Businesses and organizations that support The County Post across every edition.",
            crumbs: [
              { name: "United States", path: "/" },
              { name: "Partners", path: "/partners" },
            ],
          }),
        )}
      />
      <section className="hero-card">
        <p className="kicker">Advertiser directory</p>
        <h1>Our Partners</h1>
        <p className="lead">Explore the businesses and organizations that support The County Post across every edition.</p>
      </section>

      <PartnerCallout />

      <section className="card partner-section">
        <p className="kicker">Sitewide partners</p>
        <h2>Partners supporting every County Post edition</h2>
        <p className="muted">These organizations support readers across national, state, and county coverage.</p>
        <PartnerList partners={sitewidePartners} />
      </section>

      {countyPartners.length ? (
        <section className="card partner-section">
          <p className="kicker">County edition partners</p>
          <h2>Partners supporting local editions</h2>
          <p className="muted">These advertisers support coverage in specific County Post communities.</p>
          <PartnerList partners={countyPartners} showCountyCoverage />
        </section>
      ) : null}

      {countyPartnerPages.length ? (
        <section className="card partner-section">
          <p className="kicker">County partner pages</p>
          <h2>Browse partners by county edition</h2>
          <p className="muted">Each county edition lists the local and sitewide partners supporting that community.</p>
          <div className="partner-county-links">
            {countyPartnerPages.map((countyKey) => {
              const [stateSlug, countySlug] = countyKey.split("/");
              return (
                <Link key={countyKey} to={countyPartnersPath(stateSlug, countySlug)} className="partner-county-link">
                  {formatPartnerCountyLabel(countyKey)}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function CountyPartnerDirectory({ county }: { county: CountySite }) {
  const countyKey = countyAdKey(county.state.slug, county.slug);
  const localPartners = getLocalCountyPartners(countyKey);
  const sitewidePartners = getSitewidePartners();

  return (
    <div className="layout-grid">
      <section className="hero-card">
        <p className="kicker">Advertiser directory</p>
        <h1>{county.displayName} Partners</h1>
        <p className="lead">
          Businesses and organizations supporting The County Post in {county.displayName}, {county.state.name}.
        </p>
        <p className="muted">
          <Link to="/partners">View all County Post partners</Link>
        </p>
      </section>

      <PartnerCallout />

      {localPartners.length ? (
        <section className="card partner-section">
          <p className="kicker">Local edition partners</p>
          <h2>Partners supporting {county.displayName}</h2>
          <p className="muted">These advertisers are featured in the {county.displayName} edition.</p>
          <PartnerList partners={localPartners} />
        </section>
      ) : null}

      <section className="card partner-section">
        <p className="kicker">Sitewide partners</p>
        <h2>Partners also supporting this edition</h2>
        <p className="muted">These organizations support readers across every County Post edition, including {county.displayName}.</p>
        <PartnerList partners={sitewidePartners} />
      </section>
    </div>
  );
}
