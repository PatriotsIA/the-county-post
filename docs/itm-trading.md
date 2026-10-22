# ITM Trading sponsor page

`/itm-trading` combines the existing precious-metals feed with a sponsor profile,
Stan Roberts contact section, and ITM's video feed. Primary navigation, the footer,
and the Market desk link to the page with real anchors. The Market desk displays
a shared Gold-API.com spot-price ticker and retains a compact ITM sponsor link.
Other existing ITM video placements remain.

The sponsor page uses the full County Post masthead, global primary navigation,
and national desk navigation, including the shared mobile menu. Its sponsor
content and spot-price tools remain below the global header.

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
spot-price notice. Stan's Calendly URL also carries that parameter. Organization
identity URLs in JSON-LD, internal routes, email/phone protocols, and YouTube
media links are not campaign links.

## Spot prices — October 12, 2026

The Market Desk and ITM price cards, calculator, unit conversions and gold/silver
ratio use the same `/v1/markets/metals` snapshot from Gold-API.com. The stock
TradingView widget remains; the metals widget has been replaced with our own
four-metal display. The duplicate gold instrument was removed from the stock
widget. Both feeds load only while the Market Desk is open.

Only the free, no-key `/price/XAU`, `/price/XAG`, `/price/XPT` and `/price/XPD`
endpoints are used. No historical API or paid endpoint is called. Commercial use
is permitted by [Gold-API.com terms](https://gold-api.com/terms). Their
[documentation](https://gold-api.com/llms.txt) requests at least 30 seconds of
caching and supplies Cache-Control; the County Post waits at least 60 seconds
after each complete fetch, honoring longer provider cache durations.

The API stores one versioned state object in the existing S3 feed cache. Atomic
conditional writes elect one refresher across Lambda instances. Four sequential
requests are spaced at least 1.1 seconds apart. A 120-second lease prevents
cold-start stampedes and bounds crash recovery. Browser refreshes cannot bypass
the shared throttle. S3 errors fail closed without calling the provider.

Provider errors stop the batch immediately. The shared state records exponential
backoff beginning at five minutes, up to one hour, and honors any longer
Retry-After value. Last-good complete snapshots retain their original quote and
fetch timestamps. Failed batches never publish a mixture of old and new prices.

The browser coalesces requests and caches successful results for 15 seconds;
CDN responses also cache for 15 seconds. Visible pages check each minute, paused
when hidden or when the Market Desk is closed. Quote age is reevaluated on every
check, including failures. Quotes older than 15 minutes are labeled delayed or
possibly from a closed market; those older than four days cannot power the tools.

`priceType: "spot"` distinguishes the new contract from legacy benchmarks.
Each metal has `quotedAt`; `fetchedAt` records our fetch, and `nextRefreshAt`
records the shared cooldown. The cards compare with the previous saved quote
(`previousPrice` and `previousQuotedAt`), explicitly not a daily close or 24-hour
change. No comparison is shown until a second distinct quote is saved.

Deploy the API before the frontend. The old frontend can continue displaying
prices during rollout; the new frontend rejects legacy benchmark responses.

## Sponsor-supplied copy — October 20, 2026

Stan Roberts supplied the hero, "Your contact at ITM Trading" and "Meet our
sponsor" copy; it is used verbatim and replaces the earlier paraphrase of ITM's
About page, including the PCGS/NGC grading sentence. At his request the "Read
ITM's company profile" link is removed for now, and the Retirement accounts card
links to Stan's contact section (`#stan-roberts`, "Ask Stan about IRAs") instead
of ITM's IRA page. `aboutUrl` and `iraUrl` stay in `src/data/itm-trading.ts`
for when those links return.

## IRA topics and videos — October 20, 2026

Stan's follow-up replaces the Retirement accounts description with a "Learn
About" list (`iraTopics` in `src/data/itm-trading.ts`); the card still links to
his contact section, and ITM's IRA page stays unlinked until readers contact
the team. The YouTube embeds are hidden for now; the Videos & education section
shows his line inviting readers to contact Stan and his team for videos, followed
by the ITM blog button. `itmVideoIds` and `itmVideoTitles` are kept for their
return.

On October 22, 2026 the blog button became a "Contact Stan" button that jumps to
his contact section (`#stan-roberts`). `blogUrl` stays in
`src/data/itm-trading.ts`, unlinked.

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

Company copy is paraphrased and linked to its source; sponsorship is disclosed
at the start. No guarantees of financial returns are repeated. Outbound sponsor
links use `rel="sponsored"`; Gold-API.com attribution is a normal followed link.

## SEO and hosting

The route has title, description, canonical, WebPage/breadcrumb JSON-LD with an
explicit sponsor, and a sitemap/llms entry. The build writes `itm-trading.html`
with initial metadata, following the existing `/legends` approach. After that
artifact deploys, merge `ops/itm-trading-routes.json` before the general Amplify
SPA rewrite while preserving all existing domain and Legends rules. No app or
branch environment update is required. AI crawler permissions are unchanged.

## Checks

The Playwright ITM suite covers shared prices across national/state/county desks
and the ITM tools, deferred mobile requests, stock-provider independence,
conversion and purity calculations, refresh recovery, stale and malformed quotes,
sponsor navigation, metadata and a 320px layout. API tests cover concurrent
instances, request spacing, provider cache hints, 429 backoff, validation,
conditional S3 writes and storage failures. Verify the live API contract before
publishing the frontend, then verify calculator values against the same snapshot.
