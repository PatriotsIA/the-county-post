import type { AdCreative } from "./ads";
import paxtonSquare from "../../ad-assets/ken-paxton-square.webp";
import paxtonBanner from "../../ad-assets/ken-paxton-banner.webp";
import abbottSquare from "../../ad-assets/greg-abbott-square.webp";
import abbottBanner from "../../ad-assets/greg-abbott-banner.webp";

// Artwork built by the PIA site (scripts/campaigns/build-ads.ts), which names each
// ad's supporter and publisher; the alt text repeats that attribution.
export const paxtonSquareAd: AdCreative = {
  id: "ken-paxton-inline", slot: "inline", image: paxtonSquare,
  name: "Ken Paxton",
  alt: "Vote Ken Paxton for U.S. Senate · Texas. Published by GOP Connect LLC. Not authorized by any candidate or candidate’s committee. View campaign information.",
  href: "https://patriotsinaction.com/ken-paxton",
  stateSlugs: ["texas"], mastheadSponsor: false,
};
export const paxtonBannerAd: AdCreative = {
  ...paxtonSquareAd, id: "ken-paxton-banner", slot: "banner", image: paxtonBanner,
};
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
