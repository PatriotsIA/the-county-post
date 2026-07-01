# The County Post

An old-timey, black-and-white county news desk. Every U.S. county gets a page with live headlines, market and crypto tickers, local county weather, and a reader submission form powered by EmailJS.

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

EmailJS powers the submission form. The news API variable is optional: leave `VITE_NEWS_API_URL` blank for the current deployment if the API is not available yet.

## News Loading

Each news section tries sources in this order:

1. County Post News API, when `VITE_NEWS_API_URL` is configured and reachable.
2. Browser-side fallback RSS fetching, using Google News RSS URLs and the restored RSS provider/proxy flow.

The UI displays the active source per section:

- `Fetching articles via County News API`
- `Fetching articles via Fallback RSS`

Fallback configuration:

- `VITE_RSS_PROVIDER_URL`: optional RSS-to-JSON provider override. Defaults to `https://api.rss2json.com/v1/api.json`.
- `VITE_RSS2JSON_API_KEY`: optional rss2json API key.
- `VITE_RSS_LOCAL_PROXY_URL`: optional local proxy path for development, default `/api/rss` in dev.
- `VITE_RSS_RAW_PROXY_URL`: optional raw CORS proxy URL.

This allows the frontend to deploy now without the localhost API. Once the API is deployed, set `VITE_NEWS_API_URL` in the deployment environment and the app will prefer the API while keeping fallback available.

## Project Notes

- Built with Vite + React + TypeScript.
- County and state data come from `@nickgraffis/us-counties`.
- County and state market selection uses county centroids and nearest in-state news hubs.
- Feeds prefer `VITE_NEWS_API_URL` when available, then fall back to RSS.
- The top strip includes a TradingView stock ticker, LiveCoinWatch crypto ticker, and county weather on county pages.
- Styling is intentionally monochrome with bold, newspaper-inspired typography.
- `.env` must stay local. If secrets were ever committed, rotate them and rewrite/purge GitHub history separately.

## Submission Workflow

The `SubmissionForm` component posts to EmailJS using the three `VITE_EMAILJS_*` variables. The template receives:

- `title`, `name`, `email`, `reply_to`
- `to_email`, `county_name`, `county_slug`, `state_name`, `state_slug`
- `message` (formatted details), `page_url`, `submitted_at`

## Routes

- `/` front page with county search, national feeds, and state directory
- `/states` state and county directory
- `/states/:stateSlug` state news page
- `/:stateSlug/:countySlug` county news page with feeds and submission form
- `/:stateSlug/:countySlug/op-eds` county opinion page

## Deployment Notes

- Do not set `VITE_NEWS_API_URL` to `localhost` in hosted environments.
- Leave `VITE_NEWS_API_URL` unset until the deployed County Post News API URL is available.
- Configure EmailJS variables in the hosting provider if the submission form should work in production.
- Keep `.env.example` committed as documentation; keep `.env` untracked.
