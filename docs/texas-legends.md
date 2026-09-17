# Texas Legends landing page

The Texas Legends page presents the existing **Panhandle Legends** series, with all nine videos from the shared catalog in `src/data/panhandle-legends.ts`.

- State landing page: `/texas/texas-legends`.
- County landing pages: `/texas/:countySlug/texas-legends`, for all 254 valid Texas counties.
- Texas state and county navigation include a Texas Legends link. The Panhandle Legends listing in the global and every Texas county partner directory has an **Explore Texas Legends** button. County buttons retain the county context.
- Each video has a thumbnail, title, duration, and direct Vimeo link. No player loads automatically.
- County versions canonicalize to the state page. Only the state page is added to the sitemap.

## Content and link sources

- [Vimeo showcase catalog](https://vimeo.com/api/v2/album/12112279/videos.json): nine video IDs, titles, durations (eight 60-second videos and one 15-second promo), and publisher profile `https://vimeo.com/patriotsinactiontv`; checked September 17, 2026.
- [Series recognition and educational mission](https://www.aol.com/articles/panhandle-legends-series-honored-city-090135000.html): background on King Hill and KAMR's history series.
- [Series launch coverage](https://www.yahoo.com/news/articles/panhandle-legends-uncovers-colorful-texas-152435066.html): collaboration credit for King Hill, KAMR, and Patriots in Action.
- [Patriot Merch collection](https://shop.patriotsinaction.com/collections/texas-panhandle-legends): existing series merchandise destination.
- [KAMR media directory](https://www.einpresswire.com/world-media-directory/detail/84869): KAMR website, Facebook, and Twitter URLs. Social links are explicitly labeled as KAMR accounts; no separate series-only social account was verified.
- Patriots in Action website and community links match the existing PIA project destinations.

External links are labeled by publisher or destination. The landing page does not imply that KAMR's station-wide social accounts are dedicated Legends accounts.

## Validation

Production build and sitemap generation pass. The 21 focused browser tests cover the new collection, existing advertising/install behavior, and SEO. New checks include all nine video destinations and image decoding, global/county partner buttons, Texas navigation, exclusions outside Texas, invalid counties, legacy redirects, canonical and breadcrumb metadata, publisher social destinations, and a 320-pixel phone layout. A separate browser review confirms all 254 Texas county path/partner mappings and captures desktop/mobile layouts. Lint has only the four existing React hook warnings.
