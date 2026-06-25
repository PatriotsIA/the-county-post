# The County Post

An old-timey, black-and-white county news desk. Every U.S. county gets a page with live Google News RSS feeds for local headlines, sports, obituaries, and national context, plus a reader submission form powered by EmailJS.

## Getting started

```bash
npm install
npm run dev
```

## Environment

EmailJS powers the submission form. Copy `.env.example` to `.env` and add your keys:

```
VITE_EMAILJS_SERVICE_ID=
VITE_EMAILJS_TEMPLATE_ID=
VITE_EMAILJS_PUBLIC_KEY=
```

Optional overrides:

- `VITE_RSS_PROVIDER_URL` (defaults to `https://api.rss2json.com/v1/api.json`)
- `VITE_RSS2JSON_API_KEY` (if your provider requires one)
- `VITE_RSS_RAW_PROXY_URL` (defaults to `https://api.allorigins.win/raw`)

## Project notes

- Built with Vite + React + TypeScript.
- County and state data come from `@nickgraffis/us-counties`.
- Feeds are generated via Google News RSS queries with county/state disambiguation.
- Styling is intentionally monochrome with bold, newspaper-inspired typography.

## Submission workflow

The `SubmissionForm` component posts to EmailJS using the three `VITE_EMAILJS_*` variables. The template receives:

- `title`, `name`, `email`, `reply_to`
- `to_email`, `county_name`, `county_slug`, `state_name`, `state_slug`
- `message` (formatted details), `page_url`, `submitted_at`

## Routes

- `/` Front page with search
- `/states` State and county directory
- `/:state/:county` County news page with feeds and submission form
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
