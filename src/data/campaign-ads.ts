import type { AdCreative } from "./ads";
import abbottSquare from "../../ad-assets/greg-abbott-square.webp";
import abbottBanner from "../../ad-assets/greg-abbott-banner.webp";

// Artwork built by the PIA site (scripts/campaigns/build-ads.ts), which names each
// ad's supporter and publisher; the alt text repeats that attribution.
export const abbottSquareAd: AdCreative = {
  id: "greg-abbott-inline", slot: "inline", image: abbottSquare,
  name: "Greg Abbott",
  alt: "Vote Greg Abbott for Texas Governor. Published by Patriots Connect, LLC, d/b/a Patriots in Action. PatriotsInAction.com. Not authorized by any candidate or candidate’s committee. View campaign information.",
  href: "https://patriotsinaction.com/greg-abbott",
  stateSlugs: ["texas"], mastheadSponsor: false,
};
export const abbottBannerAd: AdCreative = {
  ...abbottSquareAd, id: "greg-abbott-banner", slot: "banner", image: abbottBanner,
};
