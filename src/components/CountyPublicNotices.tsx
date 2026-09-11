import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { CountySite } from "../data/counties";
import { fetchCountyPublicNotices, type PublicNoticesResponse, type PublicNotice } from "../lib/public-notices";
import { LoadingIndicator } from "./LoadingIndicator";

const categories: Record<PublicNotice["category"], string> = { meeting: "Public meeting", hearing: "Public hearing", procurement: "Bids & proposals", tax: "Taxes & budgets", legal: "Legal notice", other: "Public notice" };

export function CountyPublicNotices({ county, compact = false }: { county: CountySite; compact?: boolean }) {
  const root = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(!compact);
  const [data, setData] = useState<PublicNoticesResponse>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [category, setCategory] = useState("all");
  const [coverage, setCoverage] = useState("all");
  const [visibleCount, setVisibleCount] = useState(compact ? 4 : 12);
  const [loadingMore, setLoadingMore] = useState(false);
  const supported = county.state.slug === "texas";

  useEffect(() => {
    if (!compact || !root.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setReady(true); observer.disconnect(); } }, { rootMargin: "300px" });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [compact]);

  useEffect(() => {
    if (!ready || !supported) return;
    let cancelled = false;
    setError("");
    fetchCountyPublicNotices(county).then((response) => { if (!cancelled) setData(response); })
      .catch((failure: Error) => { if (!cancelled) setError(failure.message); });
    return () => { cancelled = true; };
  }, [county, ready, supported, retry]);

  async function loadMore() {
    if (!data) return;
    setLoadingMore(true);
    try {
      if (data.meta.hasMore) {
        const next = await fetchCountyPublicNotices(county, data.meta.offset + data.meta.count);
        setData({ ...next, items: [...new Map([...data.items, ...next.items].map((item) => [item.id, item])).values()] });
      }
      setVisibleCount((count) => count + 12);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to load more notices."); }
    finally { setLoadingMore(false); }
  }

  const items = (data?.items || []).filter((item) => (category === "all" || item.category === category) && (coverage === "all" || item.coverage === coverage));
  return (
    <section ref={root} className="card public-notices" aria-label={`${county.displayName} public notices`}>
      <p className="kicker">Government & community records</p>
      {compact ? <h2>Public Notices</h2> : <h1>{county.displayName}, {county.state.name} Public Notices</h1>}
      {!supported ? <p>Public notice coverage begins with Texas. Sources for {county.displayName}, {county.state.name} are not connected yet.</p> : <>
        <p>Official meetings, hearings, and notices for {county.displayName}. Regional notices list the counties they cover.</p>
        <p className="muted">Selected official sources; this is not a complete legal notice archive. Read the original notice for deadlines, changes, and participation details.</p>
        {!data && !error ? <LoadingIndicator label="Loading county public notices…" /> : null}
        {error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Retry notices</button></div> : null}
        {data?.meta.status === "partial" || data?.meta.status === "unavailable" ? <p role="status">{data.meta.status === "unavailable" ? "Notice feeds are temporarily unavailable. Check the source websites below." : "Some sources could not be refreshed. Check their websites for updates."}</p> : null}
        {!compact && data ? <div className="notice-filters">
          <label>Notice type<select aria-label="Notice type" value={category} onChange={(event) => { setCategory(event.target.value); setVisibleCount(12); }}><option value="all">All notice types</option>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Notice coverage<select aria-label="Notice coverage" value={coverage} onChange={(event) => { setCoverage(event.target.value); setVisibleCount(12); }}><option value="all">County and regional</option><option value="county">County</option><option value="regional">Regional</option></select></label>
        </div> : null}
        <div className="notice-list">
          {items.slice(0, visibleCount).map((item) => <article className="notice-card" key={item.id}>
            <p className="notice-meta">{categories[item.category]} · {item.coverage === "regional" ? "Regional" : "County"}</p>
            <h3><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a></h3>
            <p>{item.geographyLabel}</p>
            <p className="notice-meta">{item.sourceName}</p>
            {item.eventDate || item.publishedAt ? <p className="notice-date">{item.eventDate ? "Meeting / notice date" : "Published"}: <time dateTime={item.eventDate || item.publishedAt}>{formatDate(item.eventDate || item.publishedAt!)}</time></p> : null}
          </article>)}
        </div>
        {data && !items.length && data.meta.status !== "unavailable" ? <p>{data.items.length ? "No notices match these filters." : "No county-specific notices were found in the connected feeds. Check the county notice board for additional postings."}</p> : null}
        {!compact && (items.length > visibleCount || data?.meta.hasMore) ? <button type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading notices…" : "Show more notices"}</button> : null}
        {data ? <details className="notice-sources" open={!compact}>
          <summary>Notice sources and availability</summary>
          <ul>{data.sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a><span> — {source.status === "link-only" ? "Visit source" : source.status === "unavailable" ? "Feed unavailable" : source.status === "stale" ? "Saved notices; refresh unavailable" : "Feed connected"}</span>{source.checkedAt ? <small>Last retrieved {formatDate(source.checkedAt)}</small> : null}</li>)}</ul>
        </details> : null}
      </>}
      {compact ? <Link className="button-link" to={`/${county.state.slug}/${county.slug}/public-notices`}>View public notices and sources</Link> : null}
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/Chicago" }).format(date) : value;
}
