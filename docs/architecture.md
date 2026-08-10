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

## API Surfaces
- Health: `GET /health` on the Lambda base URL.
- Feeds:
  - National: `GET /v1/feeds/national/{topic}`
  - State: `GET /v1/feeds/states/{stateSlug}/{topic}`
  - County: `GET /v1/feeds/counties/{stateSlug}/{countySlug}/{topic}`
- Page bundles (prefetch multiple sections): `GET /v1/pages/{national|states/{stateSlug}|counties/{stateSlug}/{countySlug}}`

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
