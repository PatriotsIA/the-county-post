# Double B Ranch — November 16, 2026

Double B Ranch runs statewide in Texas: every one of the 254 county editions and the Texas state edition. Both creatives link to https://bbranchtexas.com/.

| Creative | File | Size |
| --- | --- | --- |
| Square (in-feed and square carousel) | `ad-assets/double-b-ranch-square.webp` | 600 × 600, lossless WebP, 50 KB |
| Banner | `ad-assets/double-b-ranch-banner.webp` | 1960 × 600 (980:300), lossless WebP, 50 KB |

## Artwork

The ranch's deer skull logo is white on a transparent background, so both creatives set it on solid black to keep it visible on the cream page.

The owner supplied the logo as a 128 × 128 PNG. The same artwork is published at 480 × 480 on the advertiser's site, and that copy is used at its native size, unscaled. Provenance is in `ad-assets/double-b-ranch.source.txt`.

## Placement

- **Square:** follows LEMC Realty and precedes the *Caesar Rodney* book in the square carousel and the in-feed rotation, at the default weight.
- **Banner:** follows the *Books for All Ages* banner and precedes *Caesar Rodney*.
  - This placement also breaks up a run of book banners.
- **County masthead sponsors:** not in the pool (`mastheadSponsor: false`), so every county keeps its current sponsor (PIA-014).
- **Partner pages:** listed as a Texas statewide partner on `/partners` and on every Texas county's partners page. Its square is shown there, and its "Visit partner" link opens bbranchtexas.com.
- **Classifieds:** the build exports both creatives to `dist/classifieds-ads.json`.
