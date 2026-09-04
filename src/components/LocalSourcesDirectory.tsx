import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CountySite } from "../data/counties";
import { getCountyNativeNewsSources } from "../lib/local-news-sources";
import { fetchCountySources, isNewsApiConfigured, type ReviewedCountySource } from "../lib/news-api";

const outletTypeLabels: Record<ReviewedCountySource["outletTypes"][number], string> = {
  newspaper: "Newspaper",
  radio: "Radio",
  television: "Television",
  digital: "Digital newsroom",
};

export function CountyLocalSourcesDirectory({ county }: { county: CountySite }) {
  // The API's source registry is the single source of truth; the static list
  // only bridges the gap while the request is in flight or the API is down.
  const [sources, setSources] = useState<ReviewedCountySource[]>(() => getCountyNativeNewsSources(county));
  const [loaded, setLoaded] = useState(!isNewsApiConfigured());

  useEffect(() => {
    let cancelled = false;
    setSources(getCountyNativeNewsSources(county));
    setLoaded(!isNewsApiConfigured());
    if (!isNewsApiConfigured()) return;
    fetchCountySources(county.state.slug, county.slug)
      .then((reviewed) => {
        if (cancelled) return;
        setSources(reviewed);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [county]);

  const submitPath = `/${county.state.slug}/${county.slug}/submit`;

  return (
    <div className="layout-grid">
      <section className="hero-card">
        <p className="kicker">Local media directory</p>
        <h1>{county.displayName} Local Sources</h1>
        <p className="lead">
          Reviewed local and regional newspapers, radio stations, television stations, and digital newsrooms serving{" "}
          {county.displayName}, {county.state.name}.
        </p>
      </section>

      <section className="card local-sources-section">
        <p className="kicker">Verified outlets</p>
        <h2>News sources serving {county.displayName}</h2>
        {sources.length ? (
          <>
            <p className="muted">
              These outlets have been reviewed for this county edition. Inclusion is informational and does not imply endorsement.
            </p>
            <div className="local-sources-grid">
              {sources.map((source) => (
                <article key={source.websiteUrl} className="local-source-card">
                  <div className="local-source-types" aria-label="Outlet types">
                    {source.outletTypes.map((type) => (
                      <span key={type}>{outletTypeLabels[type]}</span>
                    ))}
                  </div>
                  <h3>{source.name}</h3>
                  {source.aliases?.length ? <p>Also known as {source.aliases.join(", ")}</p> : null}
                  <a href={source.websiteUrl} target="_blank" rel="noreferrer">
                    Visit news outlet
                  </a>
                </article>
              ))}
            </div>
          </>
        ) : loaded ? (
          <div className="local-sources-empty">
            <h3>No reviewed local sources are listed yet</h3>
            <p>
              We would rather show an honest gap than list an outlet we have not verified. Know a local newspaper, radio station,
              television station, or digital newsroom serving {county.displayName}?
            </p>
            <Link to={submitPath}>Submit a local source</Link>
          </div>
        ) : (
          <p className="muted">Loading reviewed sources…</p>
        )}
      </section>
    </div>
  );
}
