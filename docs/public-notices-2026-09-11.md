# Texas public notices

Every county page now has a separate Public Notices section and a county navigation link. Texas pages load official notices from the new dedicated county API endpoint; the full `/:state/:county/public-notices` page includes notice-type and county/regional filters, pagination, original links, event/publication date labels and source availability. Obituaries retain their own existing news feed.

The source rollout includes profiles for all 254 Texas counties, 179 verified notice/agenda boards and 99 local RSS calendars, plus county-scoped TCEQ/TxDOT records. A local live audit found 171 notices across 92 counties on September 11. Other counties have source links even when no recent feed entry is available. This is selected official coverage, not a complete legal notice archive; newspaper notices remain available through the linked Texas directory.

County home previews load near the viewport so notice retrieval is independent of news loading. Responses are checked against the requested state, slug and FIPS before display. Other states show that their sources are not connected yet and are noindex. The 254 Texas notice pages are included in the sitemap (16,041 total URLs).

Validation includes new browser cases for geographic rejection and retry, mobile width, original links, event dates, category/coverage filters, pagination, source outages, county-home integration and all 254 Texas routes. The backend's existing PIA/news contracts and AWS infrastructure remain unchanged.

Release checks passed 141 backend tests and all 55 frontend browser cases (54 in the full run, followed by the updated obituary regression). Twelve additional browser checks used the actual local API and live sources at 1280px and 320px, with no browser errors. API/website builds and SAM lint passed. Frontend lint retains four existing React-hook warnings; the build retains its existing large-bundle warning. Fixture-driven full-page tests also emit the existing ResizeObserver loop warning.

Source review and operating instructions: `county-post-news-api/docs/public-notices.md` and its `docs/public-notices/texas-source-review.csv`.
