# Books, The Ballot Box and Patriots for Paper — October 22, 2026

Each advertiser supplied a square ("250") and a banner ("980") version of every creative. GroundMark Realty's pair is held back for now.

| Advertiser | Scope | Creatives | Link |
| --- | --- | --- | --- |
| Patriots in Action Books | National | 9 titles, square and banner each | https://shop.patriotsinaction.com/collections/books |
| The Ballot Box | National | 1 square, 1 banner | https://theballotbox.com/ |
| Patriots for Paper | Texas statewide | 1 square, 1 banner | https://patriotsforpaper.com/ |

## Placement

- **Squares** appear in the square carousel and the in-feed ad rotation.
  - Each book title sits between two existing advertisers.
  - The Ballot Box sits between LEMC Realty and Plains Bank.
  - Patriots for Paper follows Amberwood Brush.
- **Book weighting:** each book title runs at in-feed weight 1, so the nine titles together get about three times one advertiser's in-feed share.
- **Banners** are spread between the existing banners, and LEMC Realty stays first.
  - With nine book banners and four others nationally, at most three book banners run consecutively.
- **County masthead sponsors:** the new ads are left out of that pool (`mastheadSponsor: false`), so every county keeps its current masthead sponsor (PIA-014).
- **Partner pages:** the advertisers are listed automatically. Patriots in Action Books and The Ballot Box appear as sitewide partners, and Patriots for Paper as a Texas statewide partner.

## Images

The supplied PNGs were 1254 × 1254 squares and roughly 2000 × 780 banners, at 2–3 MB each (about 57 MB for the 22 files).

The repository stores right-sized WebP copies, 4.5 MB in total:
- **Squares:** 750 × 750, three times the 250-pixel display size.
- **Banners:** 600 pixels tall, twice the 300-pixel banner slot.

The copies were compared visually against the originals at full resolution. The banners are about 2.6:1 rather than the slot's 980:300, so they are letterboxed (`object-fit: contain`) rather than cropped.
