# The County Post

An old-timey, black-and-white county news desk. Every U.S. county gets live headlines, market and weather context, a sourced County Data Atlas, and a reader submission form powered by EmailJS.

## Getting Started

```bash
npm install
npm run dev
```

## Environment

Copy `.env.example` to `.env` for local development only. Do not commit `.env`; it is ignored by git.

```text
VITE_EMAILJS_SERVICE_ID=
VITE_EMAILJS_TEMPLATE_ID=
VITE_EMAILJS_PUBLIC_KEY=

# Optional until the County Post News API is deployed.
VITE_NEWS_API_URL=
```

EmailJS powers the submission form. `VITE_NEWS_API_URL` is the single base URL for news, county weather, atlas, and FRED-backed data. Weather.gov credentials and the required NWS user agent stay on the API; the browser has no weather secret.

## Documentation

- Comprehensive overview: `docs/architecture.md`
- Visual dashboard canvas (open in Cursor): `/home/telephone/.cursor/projects/home-telephone-PIA-the-county-post/canvases/county-post-overview.canvas.tsx`

## News Loading

Each news section tries sources in this order:

1. County Post News API, when `VITE_NEWS_API_URL` is configured and reachable.
2. Browser-side fallback RSS fetching, using Google News RSS URLs and the restored RSS provider/proxy flow.

The UI displays the active source per section:

- `Fetching articles via County News API`
- `Fetching articles via Fallback RSS`

Fallback configuration:

- `VITE_RSS_PROVIDER_URL`: optional RSS-to-JSON provider override. Defaults to `https://api.rss2json.com/v1/api.json`.
- `RSS_2_API`: optional rss2json API key used by the fallback provider. This non-`VITE_` variable is explicitly exposed in `vite.config.ts`.
- `VITE_RSS2JSON_API_KEY`: legacy alias for the rss2json API key; still supported.
- `VITE_RSS_LOCAL_PROXY_URL`: optional local proxy path for development. Leave unset unless a proxy endpoint exists.
- `VITE_RSS_RAW_PROXY_URL`: optional raw CORS proxy URL.

When the News API fails, the browser backs off API requests for a few minutes before trying it again. Fallback RSS results are cached per feed URL to avoid repeated rss2json calls while users scroll or sections re-render.

This allows the frontend to deploy now without the localhost API. Once the API is deployed, set `VITE_NEWS_API_URL` in the deployment environment and the app will prefer the API while keeping fallback available.

## Project Notes

- Built with Vite + React + TypeScript.
- County and state data come from `@nickgraffis/us-counties`.
- County and state market selection uses county centroids and nearest in-state news hubs.
- Feeds prefer `VITE_NEWS_API_URL` when available, then fall back to RSS.
- The top strip includes a TradingView stock ticker, LiveCoinWatch crypto ticker, and county weather on county pages.
- County weather comes from the County Post News API, which fetches National Weather Service observations, forecasts, and active alerts plus weekly U.S. Drought Monitor county conditions. The ticker, notice strips, and weather page share one metadata-driven browser cache.
- Styling is intentionally monochrome with bold, newspaper-inspired typography.
- `.env` must stay local. If secrets were ever committed, rotate them and rewrite/purge GitHub history separately.

## Submission Workflow

The `SubmissionForm` component posts to EmailJS using the three `VITE_EMAILJS_*` variables. The template receives:

- `title`, `name`, `email`, `reply_to`
- `to_email`, `county_name`, `county_slug`, `state_name`, `state_slug`
- `message` (formatted details), `page_url`, `submitted_at`

## Routes

- `/` front page with county search, national feeds, and state directory
- `/topics/:subjectSlug` national editorial desk and subcategory pages:
  - Economy & Markets: `economy-markets`, `monetary-policy`, `markets-investing`, `jobs-business`
  - Taxes & Public Finance: `taxes-public-finance`, `property-taxes`, `municipal-bonds`, `budgets-levies`
  - Elections & Transparency: `elections-transparency`, `voting-systems`, `election-administration`, `audits-recounts`, `open-records`
- `/submit` national submit op-eds/stories page
- `/states` state and county directory
- `/states/:stateSlug` state news page
- `/states/:stateSlug/:subjectSlug` state subject pages, including `op-eds`
- `/states/:stateSlug/submit` state submit op-eds/stories page
- `/:stateSlug/:countySlug` county news page with feeds and submission form
- `/:stateSlug/:countySlug/weather` county current conditions, active NWS alerts, weekly drought conditions, seven-day/period and hourly forecasts, and weather stories
- `/:stateSlug/:countySlug/data` County Data Atlas hub with compact cross-domain measures and coverage status
- `/:stateSlug/:countySlug/data/:domain` atlas domain detail with trends, comparisons, compositions, citations, vintages, and downloads
- `/:stateSlug/:countySlug/economic-data` county FRED economic profile with unemployment, income, and GDP history
- `/:stateSlug/:countySlug/op-eds` county opinion page
- `/:stateSlug/:countySlug/:subjectSlug` county editorial desk and subcategory pages using the same slugs
- `/:stateSlug/:countySlug/submit` county submit op-eds/stories page

The contextual navigation bar appears below the masthead and links to the active national, state, or county section pages.

County home pages load a compact, cross-domain atlas snapshot from the News API. The data hub calls `GET /v1/counties/:stateSlug/:countySlug/atlas`; domain routes call the matching `/atlas/:domain` endpoint and lazy-load chart code. The UI preserves source links, metric vintages, modeled/preliminary flags, margins of error, coverage notices, suppression reasons, and partial-release warnings. Missing values are never rendered as zero.

County routes call `GET /v1/counties/:stateSlug/:countySlug/weather` through `VITE_NEWS_API_URL`; the weather stories section calls `GET /v1/feeds/counties/:stateSlug/:countySlug/weather` and retains RSS fallback. Responses are cached using the API weather and alert TTL metadata, and in-flight requests are shared without letting one unmounted view cancel another subscriber. Active NWS CAP alerts and weekly U.S. Drought Monitor conditions are displayed separately so persistent drought is not mislabeled as a current warning. Official attribution links to the [National Weather Service API](https://www.weather.gov/documentation/services-web-api), [NWS alerts documentation](https://www.weather.gov/documentation/services-web-alerts), and [U.S. Drought Monitor](https://www.droughtmonitor.unl.edu/DmData/DataDownload/WebServiceInfo.aspx).

Atlas domains are `demographics`, `economy`, `housing`, `jobs-business`, `education`, `health`, `civic-elections`, `public-safety`, `agriculture`, `environment-disasters`, `government-finance`, and `infrastructure`. Domain pages provide CSV and JSON downloads when measures are available, and every chart includes a text summary and data table.

The existing `/economic-data` route remains available for the live FRED profile and source-series links. FRED and official-source credentials remain server-side: the atlas adds no frontend secret and uses only the existing `VITE_NEWS_API_URL`.
Legacy `sound-money`, `paper-elections`, and `bond-issues` links redirect to their replacement desk pages.

## Deployment Notes

- Do not set `VITE_NEWS_API_URL` to `localhost` in hosted environments.
- Leave `VITE_NEWS_API_URL` unset until the deployed County Post News API URL is available.
- Configure EmailJS variables in the hosting provider if the submission form should work in production.
- Keep `.env.example` committed as documentation; keep `.env` untracked.
