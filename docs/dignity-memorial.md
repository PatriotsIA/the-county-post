# Dignity Memorial

Dignity Memorial is a Texas statewide partner. The supplied 580 × 200 logo is stored at `ad-assets/dignity-memorial-logo.jpg`, and `ad-assets/dignity-memorial-wordmark.jpg` is the same artwork with the background margin cropped so it reads at the partner card's 86-pixel size.

- **Obituaries:** the logo presents the Obituaries feed ("Presented by") in every Texas edition: all 254 county home pages and the Texas state page. Other states and the national page show PIA Events.
- **Partner pages:** it is listed under statewide partners on `/partners` and on every Texas county's partners page.

Clicking either opens `https://www.dignitymemorial.com/`.

It is a feed-only sponsor (`feedOnlySponsors` in `src/data/ads.ts`). It does not join the square or banner carousels, the in-feed ad rotation or the county masthead sponsor, so adding it did not reshuffle any other advertiser's placements.
