# ITM Trading sponsor page

`/itm-trading` combines the existing precious-metals feed with a sponsor profile,
Stan Roberts contact section, and ITM's video feed. Primary navigation, the footer,
and the Market desk link to the page with real anchors. The Market desk displays
a separate TradingView spot-price ticker and retains a compact ITM sponsor link.
Other existing ITM video placements remain.

The sponsor page uses the full County Post masthead, global primary navigation,
and national desk navigation, including the shared mobile menu. Its sponsor
content and benchmark tools remain below the global header.

## Sponsor contacts and referral tracking — October 6, 2026

The sponsor brief supplies Stan Roberts' title (Senior Analyst), direct phone
(`623-208-7493`), email (`stanr@itmtrading.com`), and appointment page
(`https://calendly.com/stanr-pt_i/30min`). The primary contact button opens that
30-minute booking page. Stan's Team lists Fernando Grijalva, Keely Caul, and Nate
Batiste, with a link to ITM's analyst directory. The other analysts' direct phone
numbers could not be verified on ITM's site; its analyst emails are behind a
CAPTCHA. Omit those unverified contacts. Stan's card uses the direct contacts
supplied by the user in place of the former general business contacts.

All reader links to ITM's website use the shared URLs in `src/data/itm-trading.ts`
with `utm_source=countypost`, including the Hard Assets sponsor logo and metals
benchmark notice. Stan's Calendly URL also carries that parameter. Organization
identity URLs in JSON-LD, internal routes, email/phone protocols, and YouTube
media links are not campaign links.

## Market desk spot ticker

The edition ticker uses TradingView's `tv-ticker-tape` with OANDA's XAUUSD,
XAGUSD, XPTUSD, and XPDUSD cash-metal quotes (gold, silver, platinum, and
palladium in USD per troy ounce). Prices and changes are rendered by TradingView,
with its attribution and market status. These are broker spot-market quotes,
separate from the daily LBMA benchmarks on the sponsor page and from retail
coin/bar prices.

The stock and metals tickers share one provider script. Both mount only while
the Market desk is expanded and are removed when it closes. A failed or timed-out
script load reports unavailable prices for both widgets; reopening the panel
retries. This ticker uses no County Post API requests, provider key, or paid API
subscription. The sponsor page's benchmark endpoint is unchanged.

TradingView's [widget setup guide](https://www.tradingview.com/widget-docs/tutorials/web-components/configuring/)
documents multiple tickers sharing one script. Its [available worldwide markets](https://www.tradingview.com/widget-docs/markets/worldwide/)
lists OANDA's currency/commodity quotes as real-time. Actual gold, silver,
platinum, and palladium widget quotes were visually verified on October 6, 2026.

The page uses The County Post's shared paper cards, typography, rules and color
palette. A compact sponsor introduction leads into Stan's profile and contact
details; the detailed price tracker, company background and videos follow below.

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
  These were the original general business contacts, superseded in Stan's card
  by the October 6 sponsor brief above.
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

The Playwright ITM suite covers the edition spot ticker without benchmark API
requests, deferred loading and shared script failure/recovery; navigation,
verified contacts and sponsor metadata; conversion, comparison and
calculator behavior; malformed/unavailable/stale data; refresh recovery; and
320px layout. The API suite pins provider metadata, numeric validation and stale
fallback dates. Build and lint are local; release checks should remain a brief
page, metadata and API-health smoke check.
