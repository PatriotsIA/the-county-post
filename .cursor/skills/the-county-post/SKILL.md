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

Optional feed overrides:
- `VITE_RSS_PROVIDER_URL` (defaults to rss2json)
- `VITE_RSS2JSON_API_KEY`
- `VITE_RSS_RAW_PROXY_URL` (defaults to allorigins raw)

## Data & feeds
- Counties come from `@nickgraffis/us-counties` via `src/data/counties.ts`; routing slugs are lowercase `/:state/:county`.
- Feed queries are built in `src/lib/county-feed-urls.ts` using Google News RSS with county/state disambiguation.
- RSS fetching lives in `src/lib/rss.ts` (provider first, raw XML fallback).

## Submissions (EmailJS)
- `src/components/SubmissionForm.tsx` posts via `sendCountyFormEmail` (`src/lib/email.ts`).
- Template variables sent: `title`, `name`, `email`, `reply_to`, `to_email`, `county_name`, `county_slug`, `state_name`, `state_slug`, `message`, `page_url`, `submitted_at`.
- If EmailJS keys are missing, the form surfaces an error—check env first.

## Styling notes
- Keep the palette black/white/cream; fonts use Playfair Display + Libre Baskerville + Roboto Mono.
- Maintain letterpress-inspired borders and uppercase headings.
