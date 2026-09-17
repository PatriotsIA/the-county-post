import cbt from "../../ad-assets/CBT4.jpg";
import amberwoodBrush from "../../ad-assets/Amberwood-Brush-Site-250.jpg";
import brownGmc from "../../ad-assets/BrownGMC-250.jpg";
import becomeAPatriot from "../../ad-assets/BecomeAPatriot.jpg";
import becomeAPatriot2 from "../../ad-assets/BecomeAPatriot2.jpg";
import dyers from "../../ad-assets/Dyers250.jpg";
import hoffbrau from "../../ad-assets/Hoffbrau250.jpg";
import guerrillaGear from "../../ad-assets/ad-guerilla-gear.png";
import lemcInline from "../../ad-assets/LEMC250.jpg";
import lemcBanner from "../../ad-assets/LEMC980.jpg";
import mattressBanner from "../../ad-assets/matress-ad.jpg";
import lawyersTitle from "../../ad-assets/LawyersTitle250.jpg";
import patriotTrailer from "../../ad-assets/PatriotTrailerStore.jpg";
import piaBanner from "../../ad-assets/PIA980.jpg";
import piaMerchStore from "../../ad-assets/pia-merch-store-ad.jpg";
import plainsBank from "../../ad-assets/PlainsBank250.jpg";
import loriHorner from "../../ad-assets/lori-horner-ad.png";
import freedomPavementBanner from "../../ad-assets/freedom-pavement-banner.png";
import freedomPavementInline from "../../ad-assets/freedom-pavement-inline.png";
import littleItalyBanner from "../../ad-assets/little-italy-banner.png";
import littleItalyInline from "../../ad-assets/little-italy-inline.png";
import eskimoHut from "../../ad-assets/eskimo-hut-inline.jpg";
import { panhandleLegendsAds } from "./panhandle-legends";

export type AdSlotId = "inline" | "banner";

export const LORI_HORNER_AD_ID = "lori-horner-inline";
const loriHornerCountyKeys = ["texas/randall", "texas/potter"] as const;
const littleItalyCountyKeys = [
  "arkansas/polk",
  "arkansas/scott",
  "arkansas/montgomery",
  "arkansas/pike",
  "arkansas/howard",
  "arkansas/sevier",
  "oklahoma/mccurtain",
  "oklahoma/le-flore",
];

export function countyAdKey(stateSlug: string, countySlug: string) {
  return `${stateSlug}/${countySlug}`;
}

// An edition key is a state slug or a state/county pair; undefined is national.
export function isAdVisibleInCounty(ad: AdCreative, editionKey?: string) {
  if (ad.stateSlugs?.length && (!editionKey || !ad.stateSlugs.includes(editionKey.split("/")[0]))) return false;
  if (ad.countyKeys?.length && (!editionKey || !ad.countyKeys.includes(editionKey))) return false;
  return true;
}

export function getAdsForSlot(slot: AdSlotId, countyKey?: string) {
  return ads.filter((ad) => ad.slot === slot && isAdVisibleInCounty(ad, countyKey));
}

export function getSportsFeedSponsorId(countyKey?: string) {
  if (countyKey && loriHornerCountyKeys.includes(countyKey as (typeof loriHornerCountyKeys)[number])) {
    return LORI_HORNER_AD_ID;
  }
  return undefined;
}

export const FEATURED_AD_ID = "merch-inline";
export const CAROUSEL_ONLY_AD_IDS = new Set([FEATURED_AD_ID]);

export function featuredAdRank(id: string, countyKey?: string) {
  if (id === FEATURED_AD_ID) return 0;
  if (id === LORI_HORNER_AD_ID && countyKey && loriHornerCountyKeys.includes(countyKey as (typeof loriHornerCountyKeys)[number])) {
    return 1;
  }
  if (id === "guerrilla-gear-inline") return 2;
  return 3;
}

export function isCarouselOnlyAd(id: string) {
  return CAROUSEL_ONLY_AD_IDS.has(id);
}

export function canSponsorFeed(ad: AdCreative) {
  return !ad.video && !isCarouselOnlyAd(ad.id);
}

const DEFAULT_IN_FEED_AD_WEIGHT = 3;

export function getInFeedAdRotation(editionKey?: string) {
  const inFeedAds = getAdsForSlot("inline", editionKey).filter((ad) => !isCarouselOnlyAd(ad.id));
  const videoAds = inFeedAds.filter((ad) => ad.video);
  const imageRotation = Array.from({ length: DEFAULT_IN_FEED_AD_WEIGHT }, (_, round) =>
    inFeedAds.filter((ad) => !ad.video && (ad.inFeedWeight ?? DEFAULT_IN_FEED_AD_WEIGHT) > round),
  ).flat();
  if (!videoAds.length) return imageRotation;
  // Use one of the existing ad positions for video after four image ads.
  // Each feed starts at a different point, and the overall ad density is unchanged.
  return imageRotation.flatMap((ad, index) => index % 4 === 3
    ? [ad, videoAds[Math.floor(index / 4) % videoAds.length]]
    : [ad]);
}

export type AdCreative = {
  id: string;
  slot: AdSlotId;
  image: string;
  name: string;
  alt: string;
  href: string;
  stateSlugs?: string[];
  countyKeys?: string[];
  inFeedWeight?: number;
  video?: { embedUrl: string; title: string; watchUrl: string };
};

export const PARTNER_DIRECTORY_PATH = "/partners";

// When adding a county-scoped ad (countyKeys), it is included automatically on that
// county's partners page and in the global partners directory via src/data/partners.ts.
export const ads: AdCreative[] = [
  {
    id: "merch-inline",
    slot: "inline",
    image: piaMerchStore,
    name: "PATRIOT Merch",
    alt: "PATRIOT Merch — custom patriotic designs at Shop.PatriotsInAction.com",
    href: "https://shop.patriotsinaction.com/",
  },
  {
    id: LORI_HORNER_AD_ID,
    slot: "inline",
    image: loriHorner,
    name: "Lori Horner Realty Group",
    alt: "Lori Horner Realty Group",
    href: "https://www.lorihorner.com/",
    countyKeys: [...loriHornerCountyKeys],
    inFeedWeight: 1,
  },
  {
    id: "eskimo-hut-inline",
    slot: "inline",
    image: eskimoHut,
    name: "Eskimo Hut",
    alt: "Eskimo Hut — Mighty Cold!",
    href: "https://eskimohut.com/",
    countyKeys: ["texas/harris"],
  },
  {
    id: "lemc-inline",
    slot: "inline",
    image: lemcInline,
    name: "LEMC Realty",
    alt: "LEMC Realty",
    href: "https://www.331-rent.com/",
  },
  {
    id: "cbt-inline",
    slot: "inline",
    image: cbt,
    name: "CBT Real Estate Services",
    alt: "CBT Real Estate Services",
    href: "https://www.facebook.com/CBTRealEstateServices/",
  },
  {
    id: "plains-bank-inline",
    slot: "inline",
    image: plainsBank,
    name: "Plains Bank",
    alt: "Plains Bank",
    href: PARTNER_DIRECTORY_PATH,
  },
  {
    id: "patriot-trailer-inline",
    slot: "inline",
    image: patriotTrailer,
    name: "Patriot Trailer Store",
    alt: "Patriot Trailer Store",
    href: "https://piaevents.com/",
  },
  {
    id: "guerrilla-gear-inline",
    slot: "inline",
    image: guerrillaGear,
    name: "Guerrilla Gear",
    alt: "Guerrilla Gear",
    href: "https://www.guerrillagear.com/",
    stateSlugs: ["texas"],
  },
  ...panhandleLegendsAds,
  {
    id: "freedom-pavement-inline",
    slot: "inline",
    image: freedomPavementInline,
    name: "Freedom Pavement Services",
    alt: "Freedom Pavement Services — parking lot striping, sealcoating, and more. Call (405) 974-8118 for a free quote.",
    href: "https://freedom-pavement.com/",
    stateSlugs: ["oklahoma"],
  },
  {
    id: "freedom-pavement-banner",
    slot: "banner",
    image: freedomPavementBanner,
    name: "Freedom Pavement Services",
    alt: "Freedom Pavement Services — done right the first time. Call (405) 974-8118 for a free quote.",
    href: "https://freedom-pavement.com/",
    stateSlugs: ["oklahoma"],
  },
  {
    id: "little-italy-inline",
    slot: "inline",
    image: littleItalyInline,
    name: "Little Italy",
    alt: "Little Italy Italian Restaurant in Mena, Arkansas",
    href: "http://littleitalymena.com/",
    countyKeys: littleItalyCountyKeys,
  },
  {
    id: "little-italy-banner",
    slot: "banner",
    image: littleItalyBanner,
    name: "Little Italy",
    alt: "Little Italy Italian Restaurant — welcome to Little Italy in Mena, Arkansas",
    href: "http://littleitalymena.com/",
    countyKeys: littleItalyCountyKeys,
  },
  {
    id: "lemc-banner",
    slot: "banner",
    image: lemcBanner,
    name: "LEMC Realty",
    alt: "LEMC Realty",
    href: "https://www.331-rent.com/",
  },
  {
    id: "amberwood-brush-inline",
    slot: "inline",
    image: amberwoodBrush,
    name: "Amberwood Brush",
    alt: "Amberwood Brush",
    href: PARTNER_DIRECTORY_PATH,
  },
  {
    id: "brown-gmc-inline",
    slot: "inline",
    image: brownGmc,
    name: "Brown GMC",
    alt: "Brown GMC",
    href: PARTNER_DIRECTORY_PATH,
  },
  {
    id: "dyers-inline",
    slot: "inline",
    image: dyers,
    name: "Dyer's Bar-B-Que",
    alt: "Dyer's Bar-B-Que",
    href: PARTNER_DIRECTORY_PATH,
  },
  {
    id: "hoffbrau-inline",
    slot: "inline",
    image: hoffbrau,
    name: "Hoffbrau",
    alt: "Hoffbrau",
    href: PARTNER_DIRECTORY_PATH,
  },
  {
    id: "become-a-patriot-inline",
    slot: "inline",
    image: becomeAPatriot,
    name: "Become a Patriot",
    alt: "Become a Patriot",
    href: "https://community.patriotsinaction.com/",
  },
  {
    id: "become-a-patriot-2-inline",
    slot: "inline",
    image: becomeAPatriot2,
    name: "Become a Patriot",
    alt: "Become a Patriot",
    href: "https://community.patriotsinaction.com/",
  },
  {
    id: "lawyers-title-inline",
    slot: "inline",
    image: lawyersTitle,
    name: "Lawyers Title",
    alt: "Lawyers Title",
    href: PARTNER_DIRECTORY_PATH,
  },
  {
    id: "mattress-banner",
    slot: "banner",
    image: mattressBanner,
    name: "Mattress By Appointment",
    alt: "Mattress By Appointment",
    href: PARTNER_DIRECTORY_PATH,
  },
  {
    id: "pia-banner",
    slot: "banner",
    image: piaBanner,
    name: "Patriots in Action",
    alt: "Patriots in Action",
    href: "https://community.patriotsinaction.com/",
  },
];
