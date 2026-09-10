import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CountySite } from "../data/counties";
import { getCountyNativeNewsSources } from "../lib/local-news-sources";
import { fetchCountySources, isNewsApiConfigured, type ReviewedCountySource } from "../lib/news-api";
import { LoadingIndicator } from "./LoadingIndicator";

const outletTypeLabels: Record<ReviewedCountySource["outletTypes"][number], string> = {
  newspaper: "Newspaper",
  radio: "Radio station",
  television: "TV channel",
  digital: "News website",
};

const coverageLabels = { local: "Local", regional: "Regional", statewide: "Statewide", "local-regional": "Local / regional" };

export function CountyLocalSourcesDirectory({ county }: { county: CountySite }) {
  // The API's source registry is the single source of truth; the static list
  // only bridges the gap while the request is in flight or the API is down.
  const [sources, setSources] = useState<ReviewedCountySource[]>(() => getCountyNativeNewsSources(county));
  const [loaded, setLoaded] = useState(!isNewsApiConfigured());
  const [publisherType, setPublisherType] = useState("all");
  const [coverage, setCoverage] = useState("all");

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
  const visibleSources = sources.filter((source) =>
    (publisherType === "all" || source.outletTypes.includes(publisherType as ReviewedCountySource["outletTypes"][number]))
    && (coverage === "all" || (source.coverage || "local-regional") === coverage),
  );

  return (
    <div className="layout-grid">
      <section className="hero-card">
        <p className="kicker">Local media directory</p>
        <h1>{county.displayName} Local Sources</h1>
        <p className="lead">
          Find newspapers, TV channels, radio stations, and news websites serving{" "}
          {county.displayName}, {county.state.name}, with local, regional, and statewide coverage clearly labeled.
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
            <div className="local-sources-filters">
              <label>Publisher type
                <select aria-label="Publisher type" value={publisherType} onChange={(event) => setPublisherType(event.target.value)}>
                  <option value="all">All publishers</option>
                  {Object.entries(outletTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>Coverage
                <select aria-label="Coverage" value={coverage} onChange={(event) => setCoverage(event.target.value)}>
                  <option value="all">All coverage</option>
                  {Object.entries(coverageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            <p className="muted" role="status">{visibleSources.length} of {sources.length} sources shown</p>
            <div className="local-sources-grid">
              {visibleSources.map((source) => (
                <article key={source.websiteUrl} className="local-source-card">
                  <div className="local-source-types" aria-label="Outlet types">
                    {source.outletTypes.map((type) => (
                      <span key={type}>{outletTypeLabels[type]}</span>
                    ))}
                  </div>
                  <h3>{source.name}</h3>
                  <p className="local-source-coverage">{coverageLabels[source.coverage || "local-regional"]} coverage</p>
                  {source.aliases?.length ? <p>Also known as {source.aliases.join(", ")}</p> : null}
                  <a href={source.websiteUrl} target="_blank" rel="noreferrer">
                    Visit news outlet
                  </a>
                  {source.coverageUrl ? <a className="local-source-coverage-link" href={source.coverageUrl} target="_blank" rel="noreferrer">About this source</a> : null}
                </article>
              ))}
            </div>
            {!visibleSources.length ? <p>No sources match these filters. Try another publisher type or coverage area.</p> : null}
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
          <LoadingIndicator label="Loading reviewed sources…" />
        )}
      </section>
    </div>
  );
}
