export type AdPricingKey =
  | "advertiser-directory"
  | "weather-sponsor"
  | "county-hero-sponsor"
  | "national-hero-sponsor"
  | "feed-articles"
  | "feed-obituaries"
  | "feed-sports"
  | "feed-subject"
  | "homepage-sponsor-carousel"
  | "county-sponsor-carousel"
  | "newsroom-ad-strip"
  | "page-bottom-banner";

export type AdPricingTier = "Preferred Advertiser" | "Gold Advertiser" | "Platinum Advertiser" | "County Advertiser" | "National Advertiser";

export type AdPricing = {
  key: AdPricingKey;
  label: string;
  monthly: number;
  yearly: number;
  tier: AdPricingTier;
  quoteOnly?: boolean;
  quoteLabel?: string;
};

export const nationwidePricingLabel = "Contact for nationwide ad pricing";

export const advertiserTiers = [
  {
    name: "Preferred Advertiser",
    monthly: 95,
    yearly: 950,
    summary: "Clickable advertiser directory listing with business logo, description, and link.",
  },
  {
    name: "Gold Advertiser",
    monthly: 295,
    yearly: 2950,
    summary: "Feed, weather, or section sponsorship plus advertiser directory listing.",
  },
  {
    name: "Platinum Advertiser",
    monthly: 495,
    yearly: 4950,
    summary: "Priority placement, page banners, feed sponsorship priority, and directory listing.",
  },
  {
    name: "County Advertiser",
    monthly: 995,
    yearly: 9950,
    summary: "Premium county hero Presented By sponsorship for county-specific visibility.",
  },
] as const;

export const adjacentCountyAddOns = [
  { name: "Additional Adjacent County — Preferred", monthly: 47.5, yearly: 475, matchesTier: "Preferred Advertiser ($95/mo base)" },
  { name: "Additional Adjacent County — Gold", monthly: 147.5, yearly: 1475, matchesTier: "Gold Advertiser ($295/mo base)" },
  { name: "Additional Adjacent County — Platinum", monthly: 247.5, yearly: 2475, matchesTier: "Platinum Advertiser ($495/mo base)" },
  { name: "Additional Adjacent County — County Advertiser", monthly: 497.5, yearly: 4975, matchesTier: "County Advertiser ($995/mo base)" },
] as const;

export const adAssetSpecs = {
  square: "250×250 PNG for square/card placements",
  banner: "980×300 PNG for bottom banner placements",
  email: "submissions@thecountypost.com",
} as const;

const pricingByKey: Record<AdPricingKey, AdPricing> = {
  "advertiser-directory": {
    key: "advertiser-directory",
    label: "Advertiser Directory Listing",
    monthly: 95,
    yearly: 950,
    tier: "Preferred Advertiser",
  },
  "weather-sponsor": {
    key: "weather-sponsor",
    label: "Weather Presented By",
    monthly: 295,
    yearly: 2950,
    tier: "Gold Advertiser",
  },
  "county-hero-sponsor": {
    key: "county-hero-sponsor",
    label: "County Hero Presented By",
    monthly: 995,
    yearly: 9950,
    tier: "County Advertiser",
  },
  "national-hero-sponsor": {
    key: "national-hero-sponsor",
    label: "National Hero Presented By",
    monthly: 0,
    yearly: 0,
    tier: "National Advertiser",
    quoteOnly: true,
    quoteLabel: nationwidePricingLabel,
  },
  "feed-articles": {
    key: "feed-articles",
    label: "Articles Feed Sponsor",
    monthly: 295,
    yearly: 2950,
    tier: "Gold Advertiser",
  },
  "feed-obituaries": {
    key: "feed-obituaries",
    label: "Obituaries Feed Sponsor",
    monthly: 295,
    yearly: 2950,
    tier: "Gold Advertiser",
  },
  "feed-sports": {
    key: "feed-sports",
    label: "Sports Feed Sponsor",
    monthly: 295,
    yearly: 2950,
    tier: "Gold Advertiser",
  },
  "feed-subject": {
    key: "feed-subject",
    label: "Subject Feed Sponsor",
    monthly: 295,
    yearly: 2950,
    tier: "Gold Advertiser",
  },
  "homepage-sponsor-carousel": {
    key: "homepage-sponsor-carousel",
    label: "Homepage Sponsor Carousel",
    monthly: 0,
    yearly: 0,
    tier: "National Advertiser",
    quoteOnly: true,
    quoteLabel: nationwidePricingLabel,
  },
  "county-sponsor-carousel": {
    key: "county-sponsor-carousel",
    label: "County Sponsor Carousel",
    monthly: 295,
    yearly: 2950,
    tier: "Gold Advertiser",
  },
  "newsroom-ad-strip": {
    key: "newsroom-ad-strip",
    label: "Newsroom Ad Strip",
    monthly: 295,
    yearly: 2950,
    tier: "Gold Advertiser",
  },
  "page-bottom-banner": {
    key: "page-bottom-banner",
    label: "Bottom Banner",
    monthly: 495,
    yearly: 4950,
    tier: "Platinum Advertiser",
  },
};

export function getAdPricing(key: AdPricingKey) {
  return pricingByKey[key];
}

export function formatAdPrice(amount: number) {
  const hasCents = !Number.isInteger(amount);
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })}`;
}

export function formatPlacementPricing(pricing: AdPricing) {
  if (pricing.quoteOnly) return pricing.quoteLabel || nationwidePricingLabel;
  return `${formatAdPrice(pricing.monthly)}/mo · ${formatAdPrice(pricing.yearly)}/yr`;
}

export function pricingInventoryPlacements() {
  return Object.values(pricingByKey);
}
