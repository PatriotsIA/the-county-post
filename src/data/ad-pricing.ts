export type CountyRateTier = {
  population: string;
  colorCardMonthly: number;
  sectionSponsorMonthly: number;
};

export type CampaignScope = "county" | "state";
export type CountyPlacement = "color-card" | "section-sponsorship";
export type StatePlacement = "state-ad" | "state-feed-sponsorship";
export type BillingCadence = "monthly" | "annual";
export type SponsorableFeed =
  | "general"
  | "sports"
  | "obituaries"
  | "politics"
  | "economy"
  | "crime"
  | "opinion"
  | "weather";

export const countyRateTiers: CountyRateTier[] = [
  { population: "Under 5,000", colorCardMonthly: 25, sectionSponsorMonthly: 50 },
  { population: "5,000–20,000", colorCardMonthly: 75, sectionSponsorMonthly: 150 },
  { population: "20,000–100,000", colorCardMonthly: 150, sectionSponsorMonthly: 300 },
  { population: "100,000–250,000", colorCardMonthly: 250, sectionSponsorMonthly: 500 },
  { population: "250,000–500,000", colorCardMonthly: 400, sectionSponsorMonthly: 800 },
  { population: "500,000–750,000", colorCardMonthly: 550, sectionSponsorMonthly: 1100 },
  { population: "750,000–1,000,000", colorCardMonthly: 750, sectionSponsorMonthly: 1500 },
  { population: "1,000,000–2,500,000", colorCardMonthly: 1000, sectionSponsorMonthly: 2000 },
  { population: "Over 2,500,000", colorCardMonthly: 1250, sectionSponsorMonthly: 2500 },
];

export const sponsorableFeeds: Array<{ key: SponsorableFeed; label: string }> = [
  { key: "general", label: "Headlines" },
  { key: "sports", label: "Sports" },
  { key: "obituaries", label: "Obituaries" },
  { key: "politics", label: "Politics" },
  { key: "economy", label: "Economy" },
  { key: "crime", label: "Crime" },
  { key: "opinion", label: "Opinion" },
  { key: "weather", label: "Weather" },
];

export const STATE_AD_RATE_PER_COUNTY = 10;
export const STATE_FEED_SPONSOR_RATE_PER_COUNTY = 20;
export const ANNUAL_BILLED_MONTHS = 10;

export const adAssetSpecs = {
  square: "250×250 full-color JPG or PNG; displayed at news-card dimensions",
  banner: "980×300 JPG or PNG for network section-break bands",
  email: "submissions@thecountypost.com",
} as const;

export function monthlyCountyPlacementPrice(population: number, placement: CountyPlacement) {
  const tier =
    population < 5_000
      ? countyRateTiers[0]
      : population < 20_000
        ? countyRateTiers[1]
        : population < 100_000
          ? countyRateTiers[2]
          : population < 250_000
            ? countyRateTiers[3]
            : population < 500_000
              ? countyRateTiers[4]
              : population < 750_000
                ? countyRateTiers[5]
                : population < 1_000_000
                  ? countyRateTiers[6]
                  : population < 2_500_000
                    ? countyRateTiers[7]
                    : countyRateTiers[8];
  return placement === "color-card" ? tier.colorCardMonthly : tier.sectionSponsorMonthly;
}

export function monthlyStatePlacementPrice(countyCount: number, placement: StatePlacement, feedCount = 0) {
  if (placement === "state-ad") return countyCount * STATE_AD_RATE_PER_COUNTY;
  return countyCount * STATE_FEED_SPONSOR_RATE_PER_COUNTY * feedCount;
}

export function checkoutPrice(monthlyPrice: number, billing: BillingCadence) {
  return billing === "annual" ? monthlyPrice * ANNUAL_BILLED_MONTHS : monthlyPrice;
}

export function formatAdPrice(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}
