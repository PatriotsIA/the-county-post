---
name: the-county-post
description: Guides work on The County Post newspaper-style React site, including county data feeds, EmailJS submissions, and monochrome old-timey styling. Use when editing files in /home/telephone/PIA/the-county-post or when asked to adjust county news pages, feeds, or submission flow.
disable-model-invocation: true
---

# The County Post Project Skill

Use this skill whenever you touch the `the-county-post` repo.

## Paths & stack
- Root: `/home/telephone/PIA/the-county-post`
- Vite + React + TypeScript
- Styling lives in `src/index.css` (monochrome, newspaper fonts)
- Routing in `src/App.tsx`; data in `src/data/*`; feeds in `src/lib/*`; submission form in `src/components/SubmissionForm.tsx`

## Commands
- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint` (oxlint)

## Environment
Copy `.env.example` to `.env` and set:
- `VITE_EMAILJS_SERVICE_ID`
- `VITE_EMAILJS_TEMPLATE_ID`
- `VITE_EMAILJS_PUBLIC_KEY`
- `VITE_NEWS_API_URL` only when the County Post News API is available. Do not set this to localhost in hosted deployments.
- `.env` is local-only and must not be committed. `.env.example` is the committed reference.

## Data & feeds
- Counties come from `@nickgraffis/us-counties` via `src/data/counties.ts`; routing slugs are lowercase `/:state/:county`.
- Feed sections prefer the County Post News API through `src/lib/news-api.ts`.
- If the API is not configured or unavailable, feed sections fall back to browser-side RSS through `src/lib/rss.ts` and `src/lib/fallback-feed-urls.ts`.
- RSS fallback uses `RSS_2_API` as the rss2json API key, with `VITE_RSS2JSON_API_KEY` still supported as a legacy alias. `vite.config.ts` explicitly exposes `RSS_2_API`.
- The UI should indicate the active article source per section: County News API or Fallback RSS.

## Ads & partners
- Ad creatives live in `src/data/ads.ts`. County-scoped ads use `countyKeys` (for example `texas/randall`).
- Partner listings are derived from ads in `src/data/partners.ts`; do not maintain a separate partner list.
- When adding a county-scoped ad, set `countyKeys` and it will appear in carousels, feed sponsors (if wired), and partner pages for those counties automatically.
- Global partners page: `/partners` (`GlobalPartnerDirectory`).
- County partners page: `/:stateSlug/:countySlug/partners` (`CountyPartnerDirectory`).

## Submissions (EmailJS)
- `src/components/SubmissionForm.tsx` posts via `sendCountyFormEmail` (`src/lib/email.ts`).
- Template variables sent: `title`, `name`, `email`, `reply_to`, `to_email`, `county_name`, `county_slug`, `state_name`, `state_slug`, `message`, `page_url`, `submitted_at`.
- If EmailJS keys are missing, the form surfaces an error—check env first.

## Styling notes
- Keep the palette black/white/cream; fonts use Playfair Display + Libre Baskerville + Roboto Mono.
- Maintain letterpress-inspired borders and uppercase headings.
