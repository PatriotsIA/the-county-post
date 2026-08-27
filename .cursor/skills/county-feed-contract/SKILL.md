---
name: county-feed-contract
description: Maintains The County Post frontend integration with the county-news API and its RSS fallback. Use when changing county or topic feeds, API response handling, fallback locality, duplicate suppression, feed metadata, or deployment validation.
---

# County Feed Frontend Contract

## Canonical files

- API request and response types: `src/lib/news-api.ts`
- Browser RSS parsing and duplicate suppression: `src/lib/rss.ts`
- Fallback query construction: `src/lib/fallback-feed-urls.ts`
- Reviewed county-native source profiles: `src/lib/local-news-sources.ts`
- Feed rendering and locality fallback labels: `src/components/NewsFeedSection.tsx`
- Route scope and editorial taxonomy: `src/App.tsx`

## Integration rules

1. Prefer `GET /v1/pages/counties/:stateSlug/:countySlug` for county pages; use API section results as already filtered.
2. Preserve a browser RSS fallback when `VITE_NEWS_API_URL` is unavailable or fails.
3. Keep the fallback's county/state locality and near-duplicate behavior aligned with the API. A fallback must not weaken same-name county protections.
4. Do not strip or reinterpret `meta.sourcesUsed`; it identifies county primary, market, and nearby coverage tiers during rollout.
5. Keep no-image labels user-facing (`X County News`), never expose fallback query text.
6. Mirror reviewed county-native source profile changes from the API so direct feeds, targeted source searches, and strict locality behavior remain aligned during browser fallback.

## API changes

Before consuming a new API field or tier, check `/home/telephone/PIA/county-post-news-api/src/types.ts`, `src/news-service.ts`, and `api-update.md`. Coordinate API and frontend changes so the response shape remains backwards-compatible.

## Validation

```bash
npm run lint
npm run build
```

For feed changes, verify an API-backed county route and the RSS fallback path, including an ambiguous county name such as Polk in Arkansas versus Florida.
