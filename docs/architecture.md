# County Post Frontend + News API Overview

## Quick links
- Visual dashboard (Canvas): `/home/telephone/.cursor/projects/home-telephone-PIA-the-county-post/canvases/county-post-overview.canvas.tsx`
- Frontend: Vite + React (SPA)
- Primary data source: County Post News API (`VITE_NEWS_API_URL`)
- Fallback: RSS (Google News + rss2json/proxy), cached per-feed

## Architecture & Data Flow
1) Browser loads sections (national/state/county/topic) through the News API when `VITE_NEWS_API_URL` is set and reachable.
2) On API error or CORS failure, the client backs off API calls for 5 minutes and switches to RSS fallback feeds.
3) RSS feeds are fetched through rss2json (or a configured proxy) and cached on the client for 5 minutes per feed URL.
4) The UI labels the active source per section: “County News API” or “Fallback RSS”.
5) County atlas pages request a compact county overview or one domain document from the same News API. Atlas requests are cached and deduplicated in the browser; chart code is loaded only on detail pages.
6) Every county route requests its weather document from the same News API. The top ticker, active-alert strip, and weather page share an in-flight request and cache the response for the shorter of the response and alert TTLs.

## API Surfaces
- Health: `GET /health` on the Lambda base URL.
- Feeds:
  - National: `GET /v1/feeds/national/{topic}`
  - State: `GET /v1/feeds/states/{stateSlug}/{topic}`
  - County: `GET /v1/feeds/counties/{stateSlug}/{countySlug}/{topic}`
- Page bundles (prefetch multiple sections): `GET /v1/pages/{national|states/{stateSlug}|counties/{stateSlug}/{countySlug}}`
- County Data Atlas:
  - Overview: `GET /v1/counties/{stateSlug}/{countySlug}/atlas`
  - Domain: `GET /v1/counties/{stateSlug}/{countySlug}/atlas/{domain}`
- County weather:
  - Conditions, forecasts, and alerts: `GET /v1/counties/{stateSlug}/{countySlug}/weather`
  - Local weather stories: `GET /v1/feeds/counties/{stateSlug}/{countySlug}/weather`

## County Weather
- Frontend route: `/{stateSlug}/{countySlug}/weather`.
- `TopTicker` uses the active county on every county subroute, links its compact current conditions to the weather page, and renders the highest-severity active alert directly below the weather row.
- The weather page presents the optional station observation, all returned forecast and hourly periods, active alert details, partial-response warnings, county/forecast zones, source freshness, and the NWS local UTC offset carried by forecast timestamps.
- Alert detail links and forecast/observation/zone provenance link directly to official NWS resources in a new tab. Attribution references the [NWS API](https://www.weather.gov/documentation/services-web-api) and [NWS alerts API](https://www.weather.gov/documentation/services-web-alerts).
- Weather stories use topic `weather` through the county News API feed. If that feed is unavailable, state-qualified county and nearby-market RSS queries provide the existing browser fallback without relaxing county locality checks.
- The typed weather client validates the response envelope, shares in-flight requests, and lets each React subscriber abort its own wait. The network request is cancelled only when no subscribers remain.
- The response cache uses the shorter of `meta.cacheTtlSeconds` and `meta.alertsCacheTtlSeconds`, capped at one hour, so active alerts are not held for the longer forecast window.

## County Data Atlas
- Frontend routes:
  - `/{stateSlug}/{countySlug}/data` — cross-domain hub
  - `/{stateSlug}/{countySlug}/data/{domain}` — domain measures, visualizations, citations, and downloads
- The overview payload contains domain availability, featured metrics, warnings, sources, generation/retrieval timestamps, and a `partial` flag. Domain documents add full metrics with observations, state/national benchmarks, distributions, suppression metadata, coverage, vintages, and provenance.
- Values are displayed exactly as supplied by the API. Missing and disclosure-suppressed observations remain unavailable rather than becoming zero.
- Every metric shows its latest date or vintage and official source. Modeled estimates, preliminary releases, margins of error, geography vintages, and incomplete coverage stay visible near the value.
- Trend, comparison, distribution, and composition graphics are secondary to an accessible text summary and table. The `recharts` bundle is split from news and county-home code.
- Domain pages expose the returned document as JSON and a flat metric CSV where data exists. Source URLs remain official external links.
- The current browser cache follows the API `cacheTtlSeconds` value (capped at 24 hours), shares in-flight requests, and lets individual views abort their wait without cancelling a shared request.
- The legacy `/{stateSlug}/{countySlug}/economic-data` FRED route remains active. It is not redirected until the atlas economy endpoint can preserve the live FRED series behavior.

## Frontend Behavior (News Loading)
- Prefers API when configured; uses fallback RSS otherwise.
- Client cache: 60s per API URL.
- API failure backoff: 5 minutes before retrying the API.
- RSS cache: 5 minutes per feed URL to limit rss2json calls during scroll/pagination.
- Page-level prefetch: `useNewsPage` fetches page bundles when an API path is supplied.

## Environment Variables (build-time for Vite)
- `VITE_NEWS_API_URL` — Base URL for the News API (no trailing `/health`).
- `RSS_2_API` — rss2json API key for fallback.
- `VITE_RSS_PROVIDER_URL` — Optional RSS-to-JSON endpoint override (defaults to rss2json.com).
- `VITE_RSS_RAW_PROXY_URL` — Optional CORS proxy for raw RSS.
- `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, `VITE_EMAILJS_PUBLIC_KEY` — Submission form delivery.

The atlas and county weather experience introduce no browser credential or additional environment variable. NWS user-agent configuration, official-source keys, and ingestion credentials stay behind the News API; the browser uses only `VITE_NEWS_API_URL`.

## Deployment (Amplify)
1) Set the env vars above in Amplify. Vite inlines them at build time—rebuild is required after changes.
2) Trigger a new deployment (Redeploy/Run build).
3) Verify after deploy:
   - Hard refresh the site.
   - DevTools Network should show `/v1/feeds/...` requests hitting the Lambda base.
   - Health: `GET /health` returns `{"ok":true,"service":"county-post-news-api",...}`.
4) CORS: Ensure the Lambda URL allows your frontend origin; otherwise the client will fall back to RSS.

## Local Development
- Copy `.env.example` to `.env` and set `VITE_NEWS_API_URL` to your local or deployed base if available.
- Run `npm install` then `npm run dev`.
- Leave `VITE_NEWS_API_URL` empty to force RSS fallback for offline API testing.

## Troubleshooting
- Seeing “Fetching articles via Fallback RSS” after deployment:
  - Confirm `VITE_NEWS_API_URL` is set (no `/health`) and redeploy.
  - Check DevTools for CORS or 4xx/5xx on `/v1/feeds/...`.
  - Lambda must return JSON and proper CORS headers.
- Slow sections: Keep API p95 under ~550ms; otherwise RSS may be slower but still serves.
- Empty feed: Verify topic/state/county slugs exist on the API; fallback will only show what RSS returns.

## Observability Tips
- Track API latency and error rate; align with the client backoff window (5 minutes).
- Monitor rss2json/proxy usage to avoid rate limits; client caches per feed for 5 minutes.
- Health check is lightweight—safe to use for uptime probes.
