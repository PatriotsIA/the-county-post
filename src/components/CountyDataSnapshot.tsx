import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CountySite } from "../data/counties";
import {
  fetchCountyAtlasOverview,
  type CountyAtlasMetric,
  type CountyAtlasOverview,
} from "../lib/county-atlas-api";
import {
  atlasMetricYear,
  formatAtlasMetricValue,
  formatAtlasTimestamp,
} from "../lib/county-atlas-format";
import { CountyRainfallGlance } from "./CountyRainfallGlance";

type SnapshotState =
  | { status: "loading" }
  | { status: "loaded"; data: CountyAtlasOverview }
  | { status: "error"; error: string };

export function CountyDataSnapshot({ county }: { county: CountySite }) {
  const state = useCountyAtlasSnapshot(county);
  const atlasUrl = `/${county.state.slug}/${county.slug}/data`;
  const metrics =
    state.status === "loaded"
      ? state.data.domains
          .filter((entry) => entry.available)
          .flatMap((entry) => entry.featuredMetrics.slice(0, 1))
          .slice(0, 4)
      : [];

  return (
    <section className="card county-atlas-snapshot">
      <header className="atlas-snapshot-heading">
        <div>
          <p className="kicker">County Data Atlas</p>
          <h2>{county.displayName} at a glance</h2>
        </div>
        <Link className="section-action" to={atlasUrl}>Explore all county data</Link>
      </header>

      {state.status === "loading" ? (
        <p className="muted" aria-live="polite">Loading county indicators…</p>
      ) : null}
      {state.status === "error" ? (
        <p className="muted">County indicators are unavailable right now. {state.error}</p>
      ) : null}
      {metrics.length ? (
        <div className="atlas-snapshot-grid">
          {metrics.map((metric) => <SnapshotMetric key={`${metric.domain}-${metric.key}`} metric={metric} county={county} />)}
        </div>
      ) : null}
      <CountyRainfallGlance county={county} />
      {state.status === "loaded" ? (
        <p className="atlas-snapshot-note">
          Snapshot generated {formatAtlasTimestamp(state.data.meta.generatedAt)}.
          {state.data.meta.partial ? " Partial coverage: some domains or measures are not yet available." : ""}
          {" "}Each value links to its domain, vintage, and official source.
        </p>
      ) : null}
    </section>
  );
}

function SnapshotMetric({ metric, county }: { metric: CountyAtlasMetric; county: CountySite }) {
  return (
    <article>
      <p className="meta-label">{metric.label}</p>
      <p className="atlas-snapshot-value">{formatAtlasMetricValue(metric)}</p>
      <p className="atlas-snapshot-date">
        Latest available: {atlasMetricYear(metric)}
        {metric.modeledEstimate ? " · Modeled estimate" : ""}
        {metric.coveragePercent !== undefined ? ` · ${metric.coveragePercent}% coverage` : ""}
      </p>
      <Link to={`/${county.state.slug}/${county.slug}/data/${metric.domain}`}>
        {metric.source.agency}
      </Link>
    </article>
  );
}

function useCountyAtlasSnapshot(county: CountySite): SnapshotState {
  const [state, setState] = useState<SnapshotState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetchCountyAtlasOverview(county.state.slug, county.slug, controller.signal)
      .then((data) => setState({ status: "loaded", data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "County data is unavailable.",
        });
      });
    return () => controller.abort();
  }, [county.slug, county.state.slug]);

  return state;
}
