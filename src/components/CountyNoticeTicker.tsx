import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CountySite } from "../data/counties";
import { fetchCountyPublicNotices, type PublicNoticesResponse } from "../lib/public-notices";

export function CountyNoticeTicker({ county, active }: { county: CountySite; active: boolean }) {
  const [data, setData] = useState<PublicNoticesResponse>();
  const [failed, setFailed] = useState(false);
  const supported = county.state.slug === "texas";

  useEffect(() => {
    if (!active || !supported) return;
    let cancelled = false;
    setFailed(false);
    fetchCountyPublicNotices(county)
      .then(response => { if (!cancelled) setData(response); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [county, active, supported]);

  const unavailable = failed || data?.meta.status === "unavailable";
  const latest = !unavailable ? data?.items[0] : undefined;
  const date = latest?.eventDate || latest?.publishedAt;
  const count = data && !unavailable ? data.meta.totalAvailable : undefined;
  return (
    <aside className="county-notice-ticker" aria-label={`${county.displayName} public notice summary`}>
      <span className="county-notice-ticker-count">{count === undefined ? "Public notices" : `${count} public ${count === 1 ? "notice" : "notices"}`}</span>
      <div className="county-notice-ticker-preview">
        {latest ? <>
          <a href={latest.url} target="_blank" rel="noreferrer" title={latest.title}><span className="county-notice-ticker-caption">Most recent: </span>{latest.title}</a>
          {date ? <time dateTime={date}>{formatNoticeDate(date)}</time> : null}
          {data?.meta.status === "partial" ? <span className="county-notice-ticker-status">Some sources unavailable</span> : null}
        </> : <span>{!supported ? "County sources are not connected yet." : unavailable ? "Notices unavailable. View official sources." : data?.meta.status === "partial" ? "Some sources are unavailable. View official sources." : data ? "No recent notices in connected sources." : "Loading county notices…"}</span>}
      </div>
      <Link className="county-notice-ticker-all" to={`/${county.state.slug}/${county.slug}/public-notices`}>See All {county.displayName} Public Notices <span aria-hidden="true">→</span></Link>
    </aside>
  );
}

function formatNoticeDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/Chicago" }).format(date) : "";
}
