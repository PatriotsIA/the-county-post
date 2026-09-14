# Texas advertising and web app installation

Panhandle Legends uses the three published episodes found in the public Patriots in Action TV archive. The request did not contain video links, so these existing episodes were selected:

- [Quanah Parker](https://vimeo.com/1215218560)
- [Georgia O’Keeffe](https://vimeo.com/1206153465)
- [Charles & Mary Ann Goodnight](https://vimeo.com/1189445279)

Titles and thumbnails were verified against Vimeo's public profile API. Thumbnails are stored in `ad-assets/`; episode IDs and destinations are maintained in `src/data/panhandle-legends.ts`. Partner links go to the existing Texas Panhandle Legends collection in the Patriot Merch store.

The videos appear in Texas state and county ad carousels and approximately one in five existing feed ad positions. Players load on a reader's click; carousels pause during playback and players close when fully out of view. Every video also links directly to its Vimeo page. Videos cannot become feed or county masthead sponsors.

Panhandle Legends and Guerrilla Gear are listed once each as Texas statewide partners in the national directory and every Texas county directory. Other states do not receive these placements. County-specific creatives remain restricted to their named counties. Pasture Exchange and PestCon have been removed from all active creatives and sponsorship assignments.

The compact bookmark reminder sits in the bottom right on the national and county homepages, remembers dismissal for that edition during the session, and can be reopened from the footer. Android uses the browser's native install prompt when available, with browser-menu instructions as fallback. iPhone/iPad buttons explain Safari's Share → Add to Home Screen flow. Already installed apps do not show the automatic reminder. The existing standalone manifest and icons are retained, with a stable app ID and Apple web app metadata.

Validation: production build and sitemaps; existing 63-test browser suite; additional video placement/playback lifecycle checks; all 254 Texas counties and exclusions for all other county editions; phone layout, dismissal, installation cancellation, installed mode and blocked-storage checks.

Vimeo's public metadata confirms all three one-minute videos permit embedding anywhere. The real players return a connection-security restriction in the automated browser, and the Goodnights player also returned a temporary error on a live check. All three thumbnails, embed URLs, direct-watch links and player lifecycle were checked, but full Vimeo playback could not be verified in that environment. `node scripts/verify-panhandle-ads.mjs` checks playback, partner pages, the national popup and browser installability. After recording an external playback restriction, `--skip-playback` runs the remaining site checks without repeating those requests. Set `COUNTY_POST_URL=https://thecountypost.com` for production readback; output is saved under `test-results/panhandle-review/`.
