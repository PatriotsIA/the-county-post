export type PublicNotice = {
  id: string;
  title: string;
  url: string;
  sourceId: string;
  sourceName: string;
  countyFips: string[];
  coverage: "county" | "regional";
  geographyLabel: string;
  category: "meeting" | "hearing" | "procurement" | "tax" | "legal" | "other";
  eventDate?: string;
  publishedAt?: string;
};

export type NoticeSource = {
  id: string;
  name: string;
  url: string;
  kind: "government" | "newspaper-directory";
  status: "current" | "stale" | "unavailable" | "link-only";
  checkedAt?: string;
};

export type PublicNoticesResponse = {
  county: { state: string; county: string; fips: string; displayName: string };
  items: PublicNotice[];
  sources: NoticeSource[];
  meta: {
    rollout: "texas" | "not-yet-supported";
    status: "current" | "partial" | "unavailable" | "not-yet-supported";
    count: number;
    totalAvailable: number;
    hasMore: boolean;
    offset: number;
    checkedAt: string;
    lookbackDays: number;
    cacheTtlSeconds: number;
  };
};

import type { CountySite } from "../data/counties";

const cache = new Map<string, { expiresAt: number; response: Promise<PublicNoticesResponse> }>();
export async function fetchCountyPublicNotices(county: CountySite, offset = 0) {
  const base = String(import.meta.env.VITE_NEWS_API_URL || "").trim().replace(/\/$/, "");
  if (!base) throw new Error("Public notices are temporarily unavailable.");
  const url = `${base}/v1/counties/${county.state.slug}/${county.slug}/public-notices?limit=100&offset=${offset}`;
  const hit = cache.get(url);
  if (hit && hit.expiresAt > Date.now()) return hit.response;
  const response = (async () => {
    const result = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!result.ok) throw new Error("Public notices are temporarily unavailable.");
    const body = await result.json() as PublicNoticesResponse;
    if (body.county?.fips !== county.fips || body.county?.state !== county.state.slug || body.county?.county !== county.slug
      || !Array.isArray(body.items) || !Array.isArray(body.sources) || !body.meta
      || body.items.some((item) => !item.countyFips?.includes(county.fips) || !safeLink(item.url))) {
      throw new Error("Public notices could not be verified for this county.");
    }
    if (body.meta.status === "unavailable" || body.meta.status === "partial") cache.delete(url);
    return { ...body, sources: body.sources.filter((source) => safeLink(source.url)) };
  })().catch((error) => { cache.delete(url); throw error; });
  if (cache.size >= 64) cache.delete(cache.keys().next().value!);
  cache.set(url, { expiresAt: Date.now() + 300000, response });
  return response;
}

function safeLink(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
}
