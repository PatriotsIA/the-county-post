import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CountySite } from "../data/counties";
import {
  fetchCountyEconomicData,
  type CountyEconomicData as CountyEconomicDataResponse,
  type CountyEconomicMetric,
  type FredObservation,
} from "../lib/county-economy-api";

type LoadState = {
  status: "loading" | "loaded" | "error";
  data?: CountyEconomicDataResponse;
  error?: string;
};

export function CountyEconomicSnapshot({ county }: { county: CountySite }) {
  const state = useCountyEconomicData(county);
  const pageUrl = `/${county.state.slug}/${county.slug}/economic-data`;
  const featuredMetrics =
    state.data?.metrics.filter((metric) =>
      ["unemployment-rate", "median-household-income", "per-capita-personal-income"].includes(metric.key),
    ) || [];

  return (
    <section className="card county-economic-snapshot">
      <header className="economic-snapshot-heading">
        <div>
          <p className="kicker">County economy · FRED</p>
          <h2>{county.displayName} economic snapshot</h2>
        </div>
        <Link className="section-action" to={pageUrl}>
          View full economic data
        </Link>
      </header>

      {state.status === "loading" ? <p className="muted">Loading county economic indicators…</p> : null}
      {state.status === "error" ? <p className="muted">{state.error}</p> : null}
      {featuredMetrics.length ? (
        <div className="economic-snapshot-grid">
          {featuredMetrics.map((metric) => (
            <article key={metric.key}>
              <p className="meta-label">{metric.label}</p>
              <p className="economic-snapshot-value">{formatMetricValue(metric)}</p>
              <p className="economic-snapshot-date">{observationYear(metric.latest.date)} · {metric.source}</p>
            </article>
          ))}
        </div>
      ) : null}
      <p className="economic-source-note">
        Latest available annual observations from the Federal Reserve Bank of St. Louis. Release years vary by series.
      </p>
    </section>
  );
}

export function CountyEconomicData({ county }: { county: CountySite }) {
  const state = useCountyEconomicData(county);

  return (
    <div className="layout-grid">
      <section className="hero-card economic-data-hero">
        <p className="kicker">County economy · Federal Reserve data</p>
        <h1>
          {county.displayName} Economic Data <span className="muted">({county.state.abbr})</span>
        </h1>
        <p className="lead">
          A nonpartisan county economic profile using official series distributed by FRED, including employment,
          household income, personal income, and county production.
        </p>
        <div className="economic-data-meta">
          <span>County FIPS: {county.fips}</span>
          <span>
            Source:{" "}
            <a href="https://fred.stlouisfed.org/" target="_blank" rel="noreferrer">
              Federal Reserve Bank of St. Louis
            </a>
          </span>
          {state.data?.meta.latestObservationDate ? <span>Latest series year: {observationYear(state.data.meta.latestObservationDate)}</span> : null}
        </div>
      </section>

      {state.status === "loading" ? (
        <section className="card economic-data-status">
          <p className="kicker">FRED county series</p>
          <h2>Loading economic indicators…</h2>
          <p className="muted">Retrieving the latest cached county observations.</p>
        </section>
      ) : null}

      {state.status === "error" ? (
        <section className="card economic-data-status">
          <p className="kicker">FRED county series</p>
          <h2>Economic data is temporarily unavailable</h2>
          <p className="error">{state.error}</p>
        </section>
      ) : null}

      {state.data?.metrics.length ? (
        <section className="card economic-data-section">
          <header className="section-heading">
            <div className="section-heading-rule" aria-hidden />
            <div>
              <p className="kicker">Latest observations & recent history</p>
              <h2>{county.displayName} indicators</h2>
            </div>
            <div className="section-heading-rule" aria-hidden />
          </header>
          <div className="economic-metric-grid">
            {state.data.metrics.map((metric) => (
              <EconomicMetricCard key={metric.key} metric={metric} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="card economic-methodology">
        <p className="kicker">About the data</p>
        <h2>How to read this county profile</h2>
        <ul>
          <li>Values are the latest observations available from FRED; annual release schedules differ by agency and series.</li>
          <li>“County GDP” uses current dollars. “Real county GDP” uses chained 2017 dollars to account for inflation.</li>
          <li>Changes compare the latest observation with the immediately preceding annual observation.</li>
          <li>FRED republishes data from the Bureau of Labor Statistics, Census Bureau, and Bureau of Economic Analysis.</li>
        </ul>
        <p>
          <a href="https://fred.stlouisfed.org/docs/api/fred/" target="_blank" rel="noreferrer">
            Read the FRED API documentation
          </a>
        </p>
      </section>
    </div>
  );
}

function EconomicMetricCard({ metric }: { metric: CountyEconomicMetric }) {
  return (
    <article className="economic-metric-card">
      <div className="economic-metric-heading">
        <div>
          <p className="meta-label">{metric.frequency} · {metric.source}</p>
          <h3>{metric.label}</h3>
        </div>
        <span className="economic-metric-year">{observationYear(metric.latest.date)}</span>
      </div>
      <p className="economic-metric-value">{formatMetricValue(metric)}</p>
      {metric.change ? (
        <p className="economic-metric-change">
          {formatMetricChange(metric)} from {metric.previous ? observationYear(metric.previous.date) : "the prior observation"}
        </p>
      ) : null}
      <TrendLine observations={metric.observations} label={`${metric.label} recent trend`} />
      <p className="economic-metric-description">{metric.description}</p>
      <a className="economic-series-link" href={metric.seriesUrl} target="_blank" rel="noreferrer">
        FRED series {metric.seriesId} ↗
      </a>
    </article>
  );
}

function TrendLine({ observations, label }: { observations: FredObservation[]; label: string }) {
  if (observations.length < 2) return null;

  const width = 280;
  const height = 84;
  const padding = 8;
  const values = observations.map((observation) => observation.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const points = observations
    .map((observation, index) => {
      const x = padding + (index / (observations.length - 1)) * (width - padding * 2);
      const y = height - padding - ((observation.value - minimum) / range) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="economic-trend">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
        <polyline points={points} />
      </svg>
      <div className="economic-trend-years">
        <span>{observationYear(observations[0].date)}</span>
        <span>{observationYear(observations.at(-1)!.date)}</span>
      </div>
    </div>
  );
}

function useCountyEconomicData(county: CountySite): LoadState {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetchCountyEconomicData(county.state.slug, county.slug, controller.signal)
      .then((data) => setState({ status: "loaded", data }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "County economic data is unavailable.",
        });
      });
    return () => controller.abort();
  }, [county.slug, county.state.slug]);

  return state;
}

function formatMetricValue(metric: CountyEconomicMetric) {
  if (metric.valueKind === "percent") {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(metric.latest.value)}%`;
  }
  const value = metric.valueKind === "currency-thousands" ? metric.latest.value * 1_000 : metric.latest.value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: metric.valueKind === "currency-thousands" ? "compact" : "standard",
    maximumFractionDigits: metric.valueKind === "currency-thousands" ? 1 : 0,
  }).format(value);
}

function formatMetricChange(metric: CountyEconomicMetric) {
  if (!metric.change) return "";
  const sign = metric.change.absolute > 0 ? "+" : "";
  if (metric.valueKind === "percent") {
    return `${sign}${metric.change.absolute.toFixed(1)} percentage points`;
  }
  if (metric.change.percent !== undefined) {
    return `${metric.change.percent > 0 ? "+" : ""}${metric.change.percent.toFixed(1)}%`;
  }
  return `${sign}${metric.change.absolute.toLocaleString("en-US")}`;
}

function observationYear(date: string) {
  return date.slice(0, 4);
}
