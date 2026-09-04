# County feeds, client side

How the browser decides what appears on a county desk and how the feeds load.
The rules themselves, the data behind them, and the API architecture are
documented in the API repo's `docs/feeds.md`; this covers the half that runs
here, and the two traps that made desks render empty while the API was sending
full feeds.

## The scope contract

Every county response from the News API carries the filter's inputs in
`scope`, and `NewsFeedSection.tsx` mirrors the server's locality rules from
them exactly:

| Field | Meaning |
| --- | --- |
| `places` | Towns distinctive enough to identify the county bare ("Lufkin") |
| `datelinePlaces` | Shared names needing a dateline ("Memphis, TX") or corroboration |
| `trustedHosts` | Outlets whose stories are county-local by provenance |
| `countyNameDistinctive` | Whether the county's own name stands alone |

The client re-check exists as a safety net for feeds that were never
server-scoped; it must never be *stricter* than the API on API-sourced items.
Both places that broke that rule discarded most of a county's coverage:
requiring the state's name in the text (a Lufkin school-board story never says
"Texas"), and not knowing the trusted hosts (fifty stories in, four rendered).
When a rule changes server-side, mirror it here in the same change; when the
client needs data it doesn't have, extend the scope payload — never approximate.

## The prefetch prop trap

The county page prefetches its lead section and passes the scope fields down as
`initial*` props. Those props resolve *after* the component's first render, and
`useState(initialX ?? [])` reads its argument exactly once — so the lead
section once kept empty arrays forever and filtered against nothing while every
self-fetching section worked. The `effective*` pattern (component state when
this section has fetched its own scope, props otherwise) is the fix. Any new
scope field must join it, in the props, the state, and the `filteredItems`
dependency array.

## Infinite scroll

Scrolling near a feed's end raises `requestedCount` and refetches with the
larger limit; the API's `meta.hasMore` (backed by its `offset` support) says
whether another page exists. Two regressions to guard:

- The trigger once required `source === "fallback"`, so scrolling never loaded
  more on an API-backed feed — which is every county desk.
- Before `hasMore`, the trigger compared surviving items against the requested
  count, so any over-filtering also silently disabled paging.

`MAX_REQUESTED_ITEMS` (600) matches the API's own ceiling; raise them together
or not at all.

## Story cards

The Local Sources directory page fetches `/v1/sources/counties/<state>/<county>` — the API source registry is the single source of truth, and the static list in `src/lib/local-news-sources.ts` is only an in-flight/offline fallback (it drifted once and hid every promoted Texas outlet). Story-card attribution is load-bearing: the publisher leads the card, the outbound link
names its destination, County Post originals are marked as original reporting,
and placeholder thumbnails never carry this paper's branding over another
outlet's work. Publisher strings are sanitised (aggregators leak their search
query into the source field) with the article's own hostname as the honest
fallback. Aggregated stories emit no NewsArticle structured data — only
`/op-eds/*` does. The SEO side of the cards and pages is `docs/seo.md`.

## When a desk looks wrong

The API is the reference: fetch
`/v1/feeds/counties/<state>/<county>/<topic>?limit=120` and compare its item
count against the rendered `.feed-card` count (headless checks need generous
waits — a cold county build can take seconds even with the API's shared cache
in front of most of them). If they disagree, instrument the client filter's
stages and count where items vanish; every empty-desk mystery so far has been
one stage silently dropping items, not many things going slightly wrong.
