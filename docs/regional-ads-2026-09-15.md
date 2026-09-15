# Freedom Pavement and Little Italy ads

The four supplied PNGs are preserved in `ad-assets/` and registered in `src/data/ads.ts`. Each advertiser has a 980 × 300 banner plus a square creative for the existing carousels and feed rotation.

- Freedom Pavement Services appears in the Oklahoma state edition and all 77 Oklahoma county editions. Both formats link to `https://freedom-pavement.com/`.
- Little Italy appears only in Scott, Montgomery, Pike, Howard, and Sevier counties in Arkansas, plus McCurtain and Le Flore counties in Oklahoma. Both formats use the existing `/partners` fallback until a destination is supplied.

The existing partner directory derives one listing per advertiser, including the appropriate state or county coverage. Both advertisers appear together in McCurtain and Le Flore counties. Other editions retain their existing ad selections.

Validation: production build and sitemap generation; all eight existing advertising/install browser tests; exhaustive banner, square, feed rotation, and partner targeting checks across 3,195 national/state/county editions; image decoding and destinations on 13 routes; ten county partner directories; and banner fit at a 390-pixel phone viewport. The original uploads and committed assets have matching SHA-256 hashes. Lint reports only the four pre-existing React hook warnings.
