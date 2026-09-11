# Texas public notices

Every county page now has a separate Public Notices section and a county navigation link. Texas pages load official notices from the new dedicated county API endpoint; the full `/:state/:county/public-notices` page includes notice-type and county/regional filters, pagination, original links, event/publication date labels and source availability. Obituaries retain their own existing news feed.

The source rollout includes profiles for all 254 Texas counties, 179 verified notice/agenda boards and 99 local RSS calendars, plus county-scoped TCEQ/TxDOT records. A local live audit found 171 notices across 92 counties on September 11. Other counties have source links even when no recent feed entry is available. This is selected official coverage, not a complete legal notice archive; newspaper notices remain available through the linked Texas directory.

County home previews load near the viewport so notice retrieval is independent of news loading. Responses are checked against the requested state, slug and FIPS before display. Other states show that their sources are not connected yet and are noindex. The 254 Texas notice pages are included in the sitemap (16,041 total URLs).

Validation includes new browser cases for geographic rejection and retry, mobile width, original links, event dates, category/coverage filters, pagination, source outages, county-home integration and all 254 Texas routes. The backend's existing PIA/news contracts and AWS infrastructure remain unchanged.

Release checks passed 141 backend tests and all 55 frontend browser cases (54 in the full run, followed by the updated obituary regression). Twelve additional browser checks used the actual local API and live sources at 1280px and 320px, with no browser errors. API/website builds and SAM lint passed. Frontend lint retains four existing React-hook warnings; the build retains its existing large-bundle warning. Fixture-driven full-page tests also emit the existing ResizeObserver loop warning.

Source review and operating instructions: `county-post-news-api/docs/public-notices.md` and its `docs/public-notices/texas-source-review.csv`.

The Market Desk also includes a slim county notice row beneath the weather alerts, with the complete notice count, the latest dated item and a right-aligned link to all county notices. It shares the existing notice request and keeps the county-page section above Politics. Empty, unavailable and unconnected county sources have distinct messages. The existing ITM sponsor logo now uses a lowercase `.jpg` asset in both the Market Desk and Hard Assets feed: the former uppercase `.JPG` URL was returning the SPA HTML document in production, preventing image decoding.

Follow-up validation passed all 58 browser cases and the production build, with desktop/mobile screenshots reviewed. The logo test simulates the hosting fallback for uppercase image URLs and verifies actual JPEG decoding.
