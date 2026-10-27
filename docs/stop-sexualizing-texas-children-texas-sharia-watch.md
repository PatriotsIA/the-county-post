# Stop Sexualizing Texas Children and Texas Sharia Watch — October 23, 2026

Each advertiser supplied a square ("250") and a banner ("980") creative. Both run statewide in Texas, the same way as Patriots for Paper.

| Advertiser | Scope | Creatives | Link |
| --- | --- | --- | --- |
| Stop Sexualizing Texas Children | Texas statewide | 1 square, 1 banner | https://recoveramerica.com/protectchildren |
| Texas Sharia Watch | Texas statewide | 1 square, 1 banner | https://www.facebook.com/profile.php?id=61593844757341 |

## Placement

- **Squares** appear in the square carousel and the in-feed ad rotation of every Texas edition.
  - Stop Sexualizing Texas Children sits between the *Electronic Voting* book and Plains Bank.
  - Texas Sharia Watch sits between *The Men Who Held the Oars* and the second Become a Patriot square.
- **Banners:** Stop Sexualizing Texas Children follows the *Electronic Voting* banner. Texas Sharia Watch follows *The Men Who Held the Oars*.
  - LEMC Realty stays first.
  - In Texas, no more than two book banners now run consecutively.
- **County masthead sponsors:** neither ad joins the masthead pool (`mastheadSponsor: false`), so every county keeps its current sponsor (PIA-014).
- **Partner pages:** each advertiser is listed as a Texas statewide partner on `/partners` and on every Texas county's partners page. Listings are generated from the ad entries by name.

## Images

The supplied PNGs are 250 × 250 and 980 × 300, at 70–300 KB each. The repository stores WebP copies at the same size (quality 88), 12–42 KB each.

They were not upscaled, so on high-density screens they look softer than the other advertisers' creatives, which were supplied at two to three times the display size. If the advertisers can send larger originals, replace the files in `ad-assets/` under the same names.

## Partner video — October 27, 2026

Stop Sexualizing Texas Children links to Recover America's Protect Children pledge, so its partner listing now carries the Patriots in Action TV video "BONNIE WALLACE RECOVERAMERICA" (https://vimeo.com/1239959908, 1 hr 6 min).

- The video appears beneath the partner cards wherever that listing does: the Texas statewide section of `/partners` and every Texas county's partners page. It never enters the ad rotation; the ad entries carry it as `partnerVideo`, which only the directory reads.
- The player uses Vimeo's supplied embed URL, permissions and title, in a 16:9 frame that loads lazily. Vimeo's `player.js` is left out because nothing here uses its scripting API.
- Vimeo's oEmbed endpoint answers without a referring domain, so embedding is not domain-restricted. Vimeo's bot check blocks headless browsers, so playback itself is confirmed by hand rather than by tests.
