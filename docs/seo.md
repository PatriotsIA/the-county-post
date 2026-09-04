# SEO

How search and AI-crawler visibility is put together in this repo, and what has
to be true outside it for any of it to work.

## The one thing that outranks everything else

**The Amplify SPA rewrite must return 200.**

At the time this was written, every deep route on the production site returned
`301` to a trailing-slash URL and then `404`, with the SPA shell as the body.
Readers saw a working page; Googlebot saw a 404 and dropped the URL. That is
roughly 100,000 URLs, including every county desk.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -L https://thecountypost.com/texas/potter
```

`200` is correct. Anything else means the rewrite is missing or misconfigured,
and nothing else in this document matters until it is fixed. The rule, and the
console and CLI steps to apply it, are in
`~/.claude/skills/county-post-seo/references/amplify.md`.

A consequence worth remembering: a catch-all 200 rewrite is evaluated ahead of
static files at extensionless paths, so prerendered `<route>/index.html` files
would be unreachable. Do not build a prerenderer against this serving model. If
client-side metadata ever proves insufficient, the escalation is real SSR behind
a different serving model.

## Per-page metadata

React 19 hoists `<title>`, `<meta>`, and `<link>` rendered anywhere in the tree
into `<head>`, so there is **no metadata dependency** — do not add
`react-helmet-async`; it fights React's own hoisting.

- `src/lib/seo.ts` — canonical URLs, per-page-kind title and description
  builders, the index-tier policy, JSON-LD builders, and the breadcrumb trail.
- `src/components/Seo.tsx` — the single component every route renders.

Every route renders exactly one `<Seo>`. A route without one inherits whatever
the previous route left in `<head>`, which is worse than having no metadata at
all. When you add a route, add its `<Seo>` in the same change.

`src/data/site.ts` holds the canonical origin. It shipped as
`https://thecountypost.local`, which silently poisoned every canonical URL and
every JSON-LD `url`. Check it first whenever canonicals look wrong.

### Titles come from `<Seo>`, not from an effect

`App` used to set `document.title` in a `useEffect`. That ran after render and
overwrote the `<title>` React hoists, so every page reported either the masthead
or a bare county name. The effect is gone; `tests/e2e/seo.spec.ts` guards it.

The visible county `<h1>` still uses `county.pageName`
("The County Post - Anderson County"). The document title is search-led
("Anderson County, Texas News | The County Post"). Those are deliberately
different — the heading is branding, the title is a search result.

## Crawl discovery runs on `<a href>`

Google discovers pages by following anchors. A sitemap says which URLs exist; it
is not a route a crawler can walk, and a search box is not a crawl path at all
because a crawler cannot type.

Before `StateCountyIndex` existed, **no anchor anywhere on the site pointed at
any of the 3,143 county desks** — they were reachable only by typing into a
search field. The link graph is now:

```
/  ──►  /states  ──►  /:state  ──►  /:state/:county  ──►  sections
```

Every county is three clicks from the front page. Each state page renders every
one of its counties as a real link (Texas: 254 anchors). Keep it that way:
if you replace a listing with a search-only interface, the pages behind it leave
the index.

Visible breadcrumbs (`United States › Texas › Lubbock County › Weather`) come
from `crumbTrail()` in `src/lib/seo.ts`, which also feeds the `BreadcrumbList`
JSON-LD, so the two cannot drift apart.

## Index tiering

The route table multiplies out to roughly 100,000 URLs. Every page gets full
metadata; not every page gets indexed. Submitting 100,000 near-duplicate
aggregation pages is what Google's scaled-content-abuse and doorway-page policies
target. The tiers live in one exported object, `indexPolicy` in `src/lib/seo.ts`:

| Tier | Meaning | Routes |
| --- | --- | --- |
| `sitemap` | Indexed and submitted | home, topics, states, county homes, `/data`, `/weather`, `/economic-data`, `/local-sources`, editorial, legal |
| `index` | Indexable, found by internal links only | county op-eds, county partners, atlas domain pages, county and state subject desks |
| `noindex` | `noindex, follow` | every `/submit`, `/classifieds`, 404 |

That is ~15,800 submitted URLs out of ~100,000 possible. If this ever needs
revisiting, the evidence is Search Console's *Crawled – currently not indexed*
bucket: a large and growing count of county sub-pages means the policy is too
permissive, not that more URLs should be submitted.

## Sitemaps

Generated at build time from the same data the router uses, never hand-edited.

```bash
npm run seo:sitemap
```

The generator cannot `import` the app's data modules directly — `src/data/*.ts`
uses extensionless imports that Node's TypeScript stripping refuses to resolve —
so it is bundled through Vite first, which resolves them exactly as the app does:

```
vite build --ssr scripts/seo/generate-sitemaps.ts --outDir .seo-build --emptyOutDir
node .seo-build/generate-sitemaps.js
```

`npm run build` runs both, so Amplify emits fresh sitemaps on every deploy.
Output is a sitemap index at `dist/sitemap.xml` over per-type children, chunked
at 25,000 URLs (the spec limit is 50,000 / 50 MB).

## AI crawlers are welcome

`public/robots.txt` names AI and LLM agents in explicit `Allow` groups rather
than leaving them to the wildcard: `GPTBot`, `OAI-SearchBot`, `ClaudeBot`,
`Claude-User`, `PerplexityBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`,
`Bytespider`, `Meta-ExternalAgent`, and others. `public/llms.txt` gives the same
audience a structured map of the URL shapes, county sections, and data
provenance.

This is deliberate. Generic SEO checklists commonly recommend disallowing these
agents; that is the opposite of what this site wants. Do not reverse it.

## Attribution

Most of what the site shows was reported by somebody else, and the cards say so.
`ArticleCard` in `src/components/NewsFeedSection.tsx` puts the publisher on its
own line above the headline, dates the story explicitly, and labels the outbound
link with its destination:

```
REUTERS
Gold gains as markets await key US inflation data
Published Aug 10, 2026
View original story at Reuters →
```

The County Post's own reporting is labelled `The County Post · Original
reporting` and links internally. Placeholder thumbnails name the story's
publisher — they used to read "County Post News" over another outlet's work.

Aggregated stories deliberately carry **no** `Article`/`NewsArticle` structured
data. Claiming authorship of another publisher's story in machine-readable form
is the same misrepresentation as hiding the byline. Only `/op-eds/*`, which this
paper wrote, emits `NewsArticle`.

## Analytics

GA4 (`G-ZDZY8JLQKQ`) is configured in `index.html` with `send_page_view: false`.
`Seo.tsx` sends one `page_view` per route change, including the first. Before
this, `gtag('config')` fired once on load and client-side navigations sent
nothing, so GA4 only ever saw landing pages.

If GA4 pageviews look inflated, check that Enhanced Measurement's "page changes
based on browser history events" is not also enabled — use one or the other,
never both.

## Performance

`src/assets/county-post-logo.png` is the masthead and footer logo, rendered on
every page at a maximum of 540 CSS pixels. It was a 1.4 MB, 1448-pixel-wide PNG;
it is now 116 KB at 1080 pixels. Do not point `rel="icon"` or the masthead at
the full-size originals in the repo root.

Generated social and icon assets live in `public/`: `social-card.png`
(1200×630), `county-post-mark-512.png`, `apple-touch-icon.png`, `icon-192.png`,
`favicon-32.png`, `favicon.ico`. Regenerate them from
`county-post-final-logo.png` with ImageMagick if the logo changes, keeping the
`#e7e6e1` paper ground.

`public/data/counties-albers-10m.json` is 795 KB and must stay lazily loaded by
the map component.

## Tests

`tests/e2e/seo.spec.ts` covers the parts that fail silently: one title,
description, and canonical per route; page-specific titles; the noindex tiers;
structured data per page kind; the crawlable county index; the breadcrumb
hierarchy; and publisher attribution on cards.

```bash
npx playwright test tests/e2e/seo.spec.ts
```

One gotcha when adding tests here: scope `page.route` mocks narrowly. A
catch-all on `http://localhost:8787/v1/**` also intercepts the weather, atlas,
and markets calls, and a feed-shaped payload on those endpoints throws inside
their parsers and blanks the whole page. Mock `/v1/feeds/**` instead. County
desks also apply a strict locality filter, so a fixture story that does not
mention the county is dropped before it renders — use a national desk when the
assertion is about presentation.

## Still outstanding

- The Amplify 200-rewrite and the `www` → apex 301 (console work, PIA account).
- Submit `https://thecountypost.com/sitemap.xml` in Search Console.
- `PrivacyPage` claims "No behavioral tracking or ad tech" while GA4 is active.
  That needs correcting for accuracy.
- A malformed API response can throw during render and blank the page; there is
  no error boundary around the feed sections.
