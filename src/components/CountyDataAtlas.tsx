import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CountySite } from "../data/counties";
import { atlasDomainLabels } from "../lib/atlas-domain-labels";
import { CountyShowUpMeter } from "./CountyShowUpMeter";
import {
  fetchCountyAtlasDomain,
  fetchCountyAtlasOverview,
  type CountyAtlasDomain,
  type CountyAtlasDomainDocument,
  type CountyAtlasMetric,
  type CountyAtlasOverview,
  type CountyAtlasSource,
} from "../lib/county-atlas-api";
import {
  atlasMetricSummary,
  atlasMetricVintage,
  atlasMetricYear,
  formatAtlasMetricValue,
  formatAtlasTimestamp,
} from "../lib/county-atlas-format";

const LazyAtlasMetricChart = lazy(() =>
  import("./AtlasCharts").then((module) => ({ default: module.AtlasMetricChart })),
);

type LoadState<T> =
  | { status: "loading" }
  | { status: "loaded"; data: T }
  | { status: "error"; error: string };

export function CountyDataAtlasHub({ county }: { county: CountySite }) {
  const state = useAtlasOverview(county);
  const data = state.status === "loaded" ? state.data : undefined;

  return (
    <div className="layout-grid atlas-page">
      <AtlasHero county={county} meta={data?.meta} />

      {state.status === "loading" ? (
        <AtlasStatus title="Loading the county atlas…" detail="Retrieving the latest cached county overview." />
      ) : null}
      {state.status === "error" ? <AtlasError county={county} message={state.error} /> : null}

      {data ? (
        <>
          {data.meta.partial ? (
            <AtlasWarnings
              title="Partial county atlas"
              warnings={[
                "Some domains or measures are not available in this release. Missing and suppressed values are never shown as zero.",
              ]}
            />
          ) : null}

          <section className="card atlas-section" aria-labelledby="atlas-domain-heading">
            <header className="atlas-section-heading">
              <div>
                <p className="kicker">County overview</p>
                <h2 id="atlas-domain-heading">Explore the data desks</h2>
              </div>
              <p>{data.domains.filter((entry) => entry.available).length} of {data.domains.length} domains available</p>
            </header>
            <div className="atlas-domain-grid">
              {data.domains.map((entry) => (
                <article
                  className={`atlas-domain-card${entry.available ? "" : " atlas-domain-card-missing"}`}
                  key={entry.domain.slug}
                >
                  <div className="atlas-domain-heading">
                    <div>
                      <p className="kicker">{entry.domain.shortLabel}</p>
                      <h3>{entry.domain.label}</h3>
                    </div>
                    <span className={`atlas-availability ${entry.available ? "available" : "missing"}`}>
                      {entry.available ? "Available" : "Data pending"}
                    </span>
                  </div>
                  <p>{entry.domain.description}</p>
                  {entry.featuredMetrics.length ? (
                    <div className="atlas-featured-grid">
                      {entry.featuredMetrics.map((metric) => (
                        <AtlasMetricSummary key={metric.key} metric={metric} />
                      ))}
                    </div>
                  ) : (
                    <p className="atlas-missing-note">No county measures are available in this domain yet.</p>
                  )}
                  {entry.warnings.length ? (
                    <AtlasInlineWarnings warnings={entry.warnings} />
                  ) : null}
                  {entry.available ? (
                    <Link className="atlas-domain-link" to={`/${county.state.slug}/${county.slug}/data/${entry.domain.slug}`}>
                      Open {entry.domain.shortLabel} data
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
          <AtlasSourceCatalog sources={data.meta.sources} />
        </>
      ) : null}
      <CountyShowUpMeter county={county} />
    </div>
  );
}

export function CountyAtlasDomainPage({
  county,
  domain,
}: {
  county: CountySite;
  domain: CountyAtlasDomain;
}) {
  const state = useAtlasDomain(county, domain);
  const data = state.status === "loaded" ? state.data : undefined;

  return (
    <div className="layout-grid atlas-page">
      <AtlasHero county={county} meta={data?.meta} />

      {state.status === "loading" ? (
        <AtlasStatus title={`Loading ${atlasDomainLabels[domain]}…`} detail="Retrieving county measures and provenance." />
      ) : null}
      {state.status === "error" ? <AtlasError county={county} message={state.error} /> : null}

      {data ? (
        <>
          {data.meta.partial || data.warnings.length ? (
            <AtlasWarnings
              title={data.meta.partial ? "Partial domain coverage" : "Coverage notes"}
              warnings={[
                ...(data.meta.partial
                  ? ["This domain is incomplete for this county. Available measures are shown with their own coverage and vintage."]
                  : []),
                ...data.warnings,
              ]}
            />
          ) : null}

          <section className="card atlas-section" aria-labelledby="atlas-metrics-heading">
            <header className="atlas-section-heading">
              <div>
                <p className="kicker">Featured measures</p>
                <h2 id="atlas-metrics-heading">{data.domain.label}</h2>
              </div>
              {data.metrics.length ? <AtlasDownloads data={data} /> : null}
            </header>
            {data.metrics.length ? (
              <div className="atlas-metric-grid">
                {data.metrics.map((metric) => (
                  <AtlasMetricDetail key={metric.key} metric={metric} />
                ))}
              </div>
            ) : (
              <div className="atlas-empty-state">
                <h3>No measures are available yet</h3>
                <p>This source wave does not include county-level values for this domain. Check the coverage notes and sources below.</p>
              </div>
            )}
          </section>
          <AtlasSourceCatalog sources={mergeSources(data.meta.sources, data.metrics.map((metric) => metric.source))} />
        </>
      ) : null}
      {domain === "civic-elections" ? <CountyShowUpMeter county={county} /> : null}
    </div>
  );
}

function AtlasHero({
  county,
  meta,
}: {
  county: CountySite;
  meta?: CountyAtlasOverview["meta"] | CountyAtlasDomainDocument["meta"];
}) {
  return (
    <section className="hero-card atlas-hero">
      <div className="atlas-freshness" aria-label="Atlas freshness and geography">
        <span>County FIPS: {county.fips}</span>
        <span>Snapshot: {meta?.version || "Loading"}</span>
        <span>Generated: {meta ? formatAtlasTimestamp(meta.generatedAt) : "Loading"}</span>
        <span>Retrieved: {meta ? formatAtlasTimestamp(meta.retrievedAt) : "Loading"}</span>
        {meta?.partial ? <strong>Partial coverage</strong> : null}
      </div>
    </section>
  );
}

function AtlasMetricSummary({ metric }: { metric: CountyAtlasMetric }) {
  return (
    <div className="atlas-metric-summary">
      <p className="meta-label">{metric.label}</p>
      <p className="atlas-metric-value">{formatAtlasMetricValue(metric)}</p>
      <p className="atlas-metric-vintage">Latest available: {atlasMetricYear(metric)}</p>
      <MetricNotices metric={metric} compact />
      <p className="atlas-metric-source">
        <a href={metric.source.url} target="_blank" rel="noreferrer">
          {metric.source.agency}
        </a>
      </p>
    </div>
  );
}

function AtlasMetricDetail({ metric }: { metric: CountyAtlasMetric }) {
  const hasMetricValue = metric.value !== undefined || Boolean(metric.displayValue);
  const hasChartData =
    (metric.chart === "trend" && (metric.observations?.length || 0) > 1) ||
    (metric.chart === "comparison" && metric.value !== undefined && Boolean(metric.benchmarks?.length)) ||
    ((metric.chart === "distribution" || metric.chart === "composition") && Boolean(metric.distribution?.length));

  return (
    <article className={`atlas-metric-card${metric.suppressed || !hasMetricValue ? " atlas-metric-missing" : ""}`}>
      <header className="atlas-metric-heading">
        <div>
          <p className="kicker">{metric.source.name}</p>
          <h3>{metric.label}</h3>
        </div>
        <span className="atlas-year">Latest available: {atlasMetricYear(metric)}</span>
      </header>
      <p className="atlas-metric-value">{formatAtlasMetricValue(metric)}</p>
      <p>{metric.description}</p>
      <p className="atlas-text-summary">{atlasMetricSummary(metric)}.</p>
      <MetricNotices metric={metric} />
      {metric.suppressed || !hasMetricValue ? (
        <p className="atlas-missing-note">
          {metric.suppressionReason || "This measure is not available for this county and is not treated as zero."}
        </p>
      ) : null}
      {hasChartData ? (
        <Suspense fallback={<p className="muted">Loading accessible chart and data table…</p>}>
          <LazyAtlasMetricChart metric={metric} />
        </Suspense>
      ) : null}
      <dl className="atlas-provenance">
        <div>
          <dt>Vintage</dt>
          <dd>{atlasMetricVintage(metric)}</dd>
        </div>
        <div>
          <dt>Geography vintage</dt>
          <dd>{metric.geographyVintage || "Not specified"}</dd>
        </div>
        <div>
          <dt>Retrieved</dt>
          <dd>{metric.retrievedAt ? formatAtlasTimestamp(metric.retrievedAt) : "Not specified"}</dd>
        </div>
        <div>
          <dt>Revision status</dt>
          <dd>{metric.revisionStatus ? sentenceCase(metric.revisionStatus) : metric.preliminary ? "Preliminary" : "Not specified"}</dd>
        </div>
        {metric.coverageDenominator !== undefined ? (
          <div>
            <dt>Coverage basis</dt>
            <dd>
              {metric.coverageNumerator?.toLocaleString("en-US") ?? "Not specified"} of{" "}
              {metric.coverageDenominator.toLocaleString("en-US")}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Citation</dt>
          <dd>
            <a href={metric.source.url} target="_blank" rel="noreferrer">
              {metric.source.agency} — {metric.source.name}
            </a>
          </dd>
        </div>
      </dl>
    </article>
  );
}

function MetricNotices({ metric, compact = false }: { metric: CountyAtlasMetric; compact?: boolean }) {
  const notices = [
    metric.modeledEstimate ? "Modeled estimate" : "",
    metric.preliminary ? "Preliminary" : "",
    metric.coveragePercent !== undefined ? `Coverage: ${metric.coveragePercent}%` : "",
    metric.marginOfError !== undefined ? `Margin of error: ±${metric.marginOfError.toLocaleString("en-US")}` : "",
    metric.suppressed ? "Suppressed" : "",
  ].filter(Boolean);
  if (!notices.length) return null;

  return (
    <ul className={`atlas-notices${compact ? " compact" : ""}`} aria-label={`${metric.label} data notices`}>
      {notices.map((notice) => <li key={notice}>{notice}</li>)}
    </ul>
  );
}

function AtlasWarnings({ title, warnings }: { title: string; warnings: string[] }) {
  const uniqueWarnings = Array.from(new Set(warnings.filter(Boolean)));
  if (!uniqueWarnings.length) return null;
  return (
    <section className="atlas-warning" aria-labelledby="atlas-warning-heading">
      <p className="kicker">Read before comparing</p>
      <h2 id="atlas-warning-heading">{title}</h2>
      <AtlasInlineWarnings warnings={uniqueWarnings} />
    </section>
  );
}

function AtlasInlineWarnings({ warnings }: { warnings: string[] }) {
  return (
    <ul className="atlas-warning-list">
      {warnings.map((warning) => <li key={warning}>{warning}</li>)}
    </ul>
  );
}

function AtlasSourceCatalog({ sources }: { sources: CountyAtlasSource[] }) {
  const uniqueSources = mergeSources(sources);
  if (!uniqueSources.length) return null;
  return (
    <section className="card atlas-section atlas-sources" aria-labelledby="atlas-sources-heading">
      <p className="kicker">Citations & methodology</p>
      <h2 id="atlas-sources-heading">Sources used in this release</h2>
      <ol>
        {uniqueSources.map((source) => (
          <li key={source.id}>
            <h3>
              <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a>
            </h3>
            <p>{source.agency} · Refresh cadence: {source.cadence}</p>
            {source.methodology ? <p>{source.methodology}</p> : null}
            {source.licenseNote ? <p className="muted">{source.licenseNote}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function AtlasStatus({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="card atlas-status" aria-live="polite">
      <p className="kicker">County data</p>
      <h2>{title}</h2>
      <p className="muted">{detail}</p>
    </section>
  );
}

function AtlasError({ county, message }: { county: CountySite; message: string }) {
  return (
    <section className="card atlas-status atlas-error" role="alert">
      <p className="kicker">County data</p>
      <h2>The county atlas is temporarily unavailable</h2>
      <p>{message}</p>
      <p>No substitute values are shown while the source snapshot is unavailable.</p>
      <Link className="button-link" to={`/${county.state.slug}/${county.slug}`}>Return to county news</Link>
    </section>
  );
}

function AtlasDownloads({ data }: { data: CountyAtlasDomainDocument }) {
  return (
    <div className="atlas-downloads" aria-label="Download county data">
      <button type="button" onClick={() => downloadAtlasCsv(data)}>Download CSV</button>
      <button type="button" onClick={() => downloadFile(
        `${data.county.stateSlug}-${data.county.slug}-${data.domain.slug}.json`,
        JSON.stringify(data, null, 2),
        "application/json",
      )}>
        Download JSON
      </button>
    </div>
  );
}

function downloadAtlasCsv(data: CountyAtlasDomainDocument) {
  const headers = [
    "metric_key",
    "label",
    "value",
    "display_value",
    "unit",
    "date",
    "vintage",
    "retrieved_at",
    "geography_vintage",
    "revision_status",
    "source",
    "source_url",
    "modeled_estimate",
    "preliminary",
    "coverage_percent",
    "coverage_numerator",
    "coverage_denominator",
    "margin_of_error",
    "suppressed",
    "suppression_reason",
  ];
  const rows = data.metrics.map((metric) => [
    metric.key,
    metric.label,
    metric.value,
    metric.displayValue,
    metric.unit,
    metric.date,
    metric.vintage,
    metric.retrievedAt,
    metric.geographyVintage,
    metric.revisionStatus,
    `${metric.source.agency} — ${metric.source.name}`,
    metric.source.url,
    metric.modeledEstimate,
    metric.preliminary,
    metric.coveragePercent,
    metric.coverageNumerator,
    metric.coverageDenominator,
    metric.marginOfError,
    metric.suppressed,
    metric.suppressionReason,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  downloadFile(`${data.county.stateSlug}-${data.county.slug}-${data.domain.slug}.csv`, csv, "text/csv");
}

function downloadFile(filename: string, contents: string, contentType: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: `${contentType};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  if (value === undefined || value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function sentenceCase(value: string) {
  return value
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function mergeSources(...sourceGroups: CountyAtlasSource[][]) {
  return Array.from(
    new Map(sourceGroups.flat().filter(Boolean).map((source) => [source.id, source])).values(),
  );
}

function useAtlasOverview(county: CountySite): LoadState<CountyAtlasOverview> {
  const [state, setState] = useState<LoadState<CountyAtlasOverview>>({ status: "loading" });

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

function useAtlasDomain(
  county: CountySite,
  domain: CountyAtlasDomain,
): LoadState<CountyAtlasDomainDocument> {
  const [state, setState] = useState<LoadState<CountyAtlasDomainDocument>>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetchCountyAtlasDomain(county.state.slug, county.slug, domain, controller.signal)
      .then((data) => setState({ status: "loaded", data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "County data is unavailable.",
        });
      });
    return () => controller.abort();
  }, [county.slug, county.state.slug, domain]);

  return state;
}
