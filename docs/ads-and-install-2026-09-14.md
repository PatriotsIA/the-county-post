# Texas advertising and web app installation

Panhandle Legends uses all nine videos from the [Panhandle Legends Vimeo showcase](https://vimeo.com/showcase/12112279), including its 15-second promo:

- [Quanah Parker](https://vimeo.com/1215218560)
- [Georgia O’Keeffe](https://vimeo.com/1206153465)
- [Rick Husband](https://vimeo.com/1165499745)
- [Panhandle Legends Promo](https://vimeo.com/1165499670)
- [Melissa Eakle](https://vimeo.com/1165499251)
- [Joe Fortenberry](https://vimeo.com/1165499027)
- [Frenchy McCormick](https://vimeo.com/1165498956)
- [Fray Padilla](https://vimeo.com/1165498523)
- [Bones Hooks](https://vimeo.com/1165498343)

Membership, titles and thumbnails were verified against [Vimeo's public showcase API](https://vimeo.com/api/v2/album/12112279/videos.json) on September 14, 2026. The original three-video catalog came from recent profile uploads and did not match the showcase; the catalog now matches the showcase's exact nine video IDs. Thumbnails are stored in `ad-assets/`; episode IDs and destinations are maintained in `src/data/panhandle-legends.ts`. Partner links go to the existing Texas Panhandle Legends collection in the Patriot Merch store.

The videos appear in Texas state and county ad carousels and approximately one in five existing feed ad positions. Players load on a reader's click; carousels pause during playback and players close when fully out of view. Every video also links directly to its Vimeo page. Videos cannot become feed or county masthead sponsors.

Panhandle Legends and Guerrilla Gear are listed once each as Texas statewide partners in the national directory and every Texas county directory. Other states do not receive these placements. County-specific creatives remain restricted to their named counties. Pasture Exchange and PestCon have been removed from all active creatives and sponsorship assignments.

The Panhandle Legends partner listing also has an **Explore Texas Legends** button for the dedicated video collection. The global directory links to `/texas/texas-legends`; Texas county partner pages link to their county's `/texas/:countySlug/texas-legends` page. See `docs/texas-legends.md` for content sources and routing details.

The compact bookmark reminder sits in the bottom right on the national and county homepages, remembers dismissal for that edition during the session, and can be reopened from the footer. Android uses the browser's native install prompt when available, with browser-menu instructions as fallback. iPhone/iPad buttons explain Safari's Share → Add to Home Screen flow. Already installed apps do not show the automatic reminder. The existing standalone manifest and icons are retained, with a stable app ID and Apple web app metadata.

Validation covers the production build and sitemaps, every showcase video ID in both the carousel catalog and feed rotation for the Texas state edition and all 254 Texas counties, exclusions for other county editions, all nine local thumbnails and matching click-to-load players, and playback lifecycle. The advertising/install browser suite also covers phone layout, dismissal, installation cancellation, installed mode and blocked storage. The existing 63-test browser suite passed for the initial advertising/install release.

Vimeo's public metadata confirms all nine videos permit embedding anywhere (eight one-minute videos and one 15-second promo). The real players returned a connection-security restriction in the automated browser during the initial release checks, so full Vimeo playback could not be verified in that environment. `node scripts/verify-panhandle-ads.mjs` checks playback, the exact nine-video catalog and thumbnails in state/county carousels, partner pages, the national popup and browser installability. After recording an external playback restriction, `--skip-playback` still verifies every catalog ID, thumbnail and direct-watch link without repeating player requests. Set `COUNTY_POST_URL=https://thecountypost.com` for production readback; output is saved under `test-results/panhandle-review/`.
