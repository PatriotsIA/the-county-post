import type { AdCreative } from "./ads";
import paxtonSquare from "../../ad-assets/ken-paxton-square.webp";
import paxtonBanner from "../../ad-assets/ken-paxton-banner.webp";
import abbottSquare from "../../ad-assets/greg-abbott-square.webp";
import abbottBanner from "../../ad-assets/greg-abbott-banner.webp";

// Existing Patriots in Action artwork, including its support attribution.
export const paxtonSquareAd: AdCreative = {
  id: "ken-paxton-inline", slot: "inline", image: paxtonSquare,
  name: "Ken Paxton",
  alt: "Vote Ken Paxton for U.S. Senate · Texas. Unpaid support message created by Patriots in Action. View campaign information.",
  href: "https://patriotsinaction.com/ken-paxton",
  stateSlugs: ["texas"], mastheadSponsor: false,
};
export const paxtonBannerAd: AdCreative = {
  ...paxtonSquareAd, id: "ken-paxton-banner", slot: "banner", image: paxtonBanner,
};
export const abbottSquareAd: AdCreative = {
  id: "greg-abbott-inline", slot: "inline", image: abbottSquare,
  name: "Greg Abbott",
  alt: "Vote Greg Abbott for Texas Governor. Unpaid support message created by Patriots in Action. View campaign information.",
  href: "https://patriotsinaction.com/greg-abbott",
  stateSlugs: ["texas"], mastheadSponsor: false,
};
export const abbottBannerAd: AdCreative = {
  ...abbottSquareAd, id: "greg-abbott-banner", slot: "banner", image: abbottBanner,
};
