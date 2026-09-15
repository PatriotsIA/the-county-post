# Freedom Pavement and Little Italy ads

The four supplied PNGs are preserved in `ad-assets/` and registered in `src/data/ads.ts`. Each advertiser has a 980 × 300 banner plus a square creative for the existing carousels and feed rotation.

- Freedom Pavement Services appears in the Oklahoma state edition and all 77 Oklahoma county editions. Both formats link to `https://freedom-pavement.com/`.
- Little Italy appears only in Polk, Scott, Montgomery, Pike, Howard, and Sevier counties in Arkansas, plus McCurtain and Le Flore counties in Oklahoma. Both ad formats and its partner listing link to `http://littleitalymena.com/`.

The existing partner directory derives one listing per advertiser, including the appropriate state or county coverage. Both advertisers appear together in McCurtain and Le Flore counties. Other editions retain their existing ad selections.

Initial release validation: production build and sitemap generation; all eight existing advertising/install browser tests; exhaustive banner, square, feed rotation, and partner targeting checks across 3,195 national/state/county editions; image decoding and destinations on 13 routes; ten county partner directories; and banner fit at a 390-pixel phone viewport. The original uploads and committed assets have matching SHA-256 hashes. Lint reports only the four pre-existing React hook warnings.

Polk County and destination update: production build passed; exhaustive targeting still covers all 3,195 editions with exactly eight Little Italy counties; both ad destinations verified on all eight county editions; all eight county partner listings and the global listing link to `http://littleitalymena.com/`. Browser checks also cover exclusions in other counties and mobile banner fit.
