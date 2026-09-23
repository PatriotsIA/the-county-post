# Panhandle Legends sponsor page

The dedicated **Panhandle Legends** sponsor page presents all nine videos from the shared catalog in `src/data/panhandle-legends.ts`. Its name describes the series; its sponsorship still covers the Texas edition and all 254 Texas county editions.

- Canonical landing page: `https://thecountypost.com/legends`.
- Former `/texas/texas-legends` and valid `/texas/:countySlug/texas-legends` URLs redirect to `/legends`, preserving query strings and video anchors. The older `/states/texas/...` aliases still work. Invalid counties remain not-found pages.
- Texas state and county navigation include a **Panhandle Legends** link. The global and every Texas county partner directory have an **Explore Panhandle Legends** button leading to the same dedicated page.
- Existing Texas ad placements, creative IDs, images, rotation, Vimeo playback, and merchandise destinations are unchanged. No ads were added outside Texas.
- Each video has a thumbnail, title, duration, and direct Vimeo link. No player loads automatically.
- The sponsor page omits the edition section navigation, ticker, and general ad slots. Only `/legends` appears in the sitemap.

## Hosting and initial metadata

The build writes `dist/legends.html` with the sponsor title, description, canonical, and social metadata before JavaScript runs. The app still supplies its full content and structured data in the browser. Other routes retain the existing SPA serving model.

After the build containing `legends.html` deploys, insert the rules in `ops/legends-routes.json` before Amplify's general SPA rewrite, preserving existing domain redirects and other rules. Do not replace the entire rule list with this fragment. The exact `/legends` rewrite must come before the catch-all. Legacy county redirects are validated by the app so invalid county URLs stay not-found pages.

Amplify evaluates rules in order; see [redirects](https://docs.aws.amazon.com/amplify/latest/userguide/redirects.html) and [rewrite examples](https://docs.aws.amazon.com/amplify/latest/userguide/redirect-rewrite-examples.html). Verify `/legends` returns 200 with the sponsor metadata in the initial HTML, `/legends/` and the legacy statewide URL redirect, and ordinary county routes still return 200.

## Content and link sources

- [Vimeo showcase catalog](https://vimeo.com/api/v2/album/12112279/videos.json): nine video IDs, titles, durations (eight 60-second videos and one 15-second promo), and publisher profile `https://vimeo.com/patriotsinactiontv`; checked September 17, 2026.
- [Series recognition and educational mission](https://www.aol.com/articles/panhandle-legends-series-honored-city-090135000.html): background on King Hill and KAMR's history series.
- [Series launch coverage](https://www.yahoo.com/news/articles/panhandle-legends-uncovers-colorful-texas-152435066.html): collaboration credit for King Hill, KAMR, and Patriots in Action.
- [Patriot Merch collection](https://shop.patriotsinaction.com/collections/texas-panhandle-legends): existing series merchandise destination.
- [KAMR media directory](https://www.einpresswire.com/world-media-directory/detail/84869): KAMR website, Facebook, and Twitter URLs. Social links are explicitly labeled as KAMR accounts; no separate series-only social account was verified.
- Patriots in Action website and community links match the existing PIA project destinations.

External links are labeled by publisher or destination. The landing page does not imply that KAMR's station-wide social accounts are dedicated Legends accounts.

## Validation

Run the production build, lint, and Playwright suite before release. `tests/e2e/panhandle-legends.spec.ts` checks all nine video destinations and image decoding, global/county partner buttons, Texas navigation, exclusions outside Texas, invalid counties, legacy redirects with tracking parameters and anchors, canonical and breadcrumb metadata, publisher links, and a 320-pixel phone layout. `advertisers-install.spec.ts` checks the existing sponsor coverage and ad behavior, including all 254 Texas counties. Lint currently has four existing React hook warnings.
