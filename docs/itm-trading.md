# ITM Trading sponsor page

`/itm-trading` combines the existing precious-metals feed with a sponsor profile,
Stan Roberts contact section, and ITM's video feed. Primary navigation, the footer,
and the Market desk link to the page with real anchors. The Market desk no longer
loads metals prices on every edition. Other existing ITM video placements remain.

## Prices

The same `/v1/markets/metals` API supplies USD per troy ounce. The API also passes
through optional `previousPrice`, `fixedAt`, and `sourceLabel` values from Minted
Metal. The client verifies prices and units before computing anything. Previous
values, fixing times and feed update times remain distinct. Older API responses
still show prices while unavailable comparisons are labeled honestly.

The tracker offers gram/kilogram conversions, dollar and percentage changes from
the previous published benchmark, a two-value comparison, gold/silver ratio,
and quantity/purity calculator. These are reference calculations, not spot prices,
retail prices, a rolling 24-hour change, or a historical chart. Fixing dates are
visible for each metal; dates more than four days old receive an older-benchmark
label. Missing and malformed prices never turn into zero. Refresh failures retain
previously received data with an explicit status and original dates.

The page checks every 15 minutes while visible. The server keeps its existing
15-minute provider cache. No provider URL, key, template or environment changes
are needed. Minted Metal's public API notice says anonymous requests will be
limited to 10/minute from October 6, 2026; keep this behind the existing API cache.

## Verified content sources — October 1, 2026

- https://www.itmtrading.com/about — family ownership, product categories,
  coin examination/third-party grading, continuing client service, and “Stan R.”
  listed under Gold & Silver Analysts. Its direct analyst contact links require
  a verification step; no guessed direct address, tenure, biography or photo is used.
- https://www.itmtrading.com/international-bullion — Phoenix location and 1995 founding.
- https://www.itmtrading.com/contactus — 888-696-4653, services@itmtrading.com,
  business hours as published (PST), and appointment-only Phoenix office.
  These are labeled ITM business contacts; readers are told to ask for Stan Roberts.
  Stan's full name is supplied by the project brief and also matches his public
  professional profile at https://www.linkedin.com/in/stan-roberts-513b7715.
- https://www.itmtrading.com/products, /strategy, /ira — resource summaries.
- https://mintedmetal.com/api/ and https://mintedmetal.com/api/prices.json —
  field meanings, refresh cadence, CC BY 4.0 and visible attribution requirement.
- https://www.lbma.org.uk/prices-and-data/lbma-precious-metal-prices — benchmark context.

Company copy is paraphrased and linked to its source; sponsorship is disclosed
at the start. No guarantees of financial returns are repeated. Outbound sponsor
links use `rel="sponsored"`; Minted Metal attribution is a normal followed link.

## SEO and hosting

The route has title, description, canonical, WebPage/breadcrumb JSON-LD with an
explicit sponsor, and a sitemap/llms entry. The build writes `itm-trading.html`
with initial metadata, following the existing `/legends` approach. After that
artifact deploys, merge `ops/itm-trading-routes.json` before the general Amplify
SPA rewrite while preserving all existing domain and Legends rules. No app or
branch environment update is required. AI crawler permissions are unchanged.

## Checks

The Playwright ITM suite covers navigation and the removal of edition metal
requests; verified contacts and sponsor metadata; conversion, comparison and
calculator behavior; malformed/unavailable/stale data; refresh recovery; and
320px layout. The API suite pins provider metadata, numeric validation and stale
fallback dates. Build and lint are local; release checks should remain a brief
page, metadata and API-health smoke check.
