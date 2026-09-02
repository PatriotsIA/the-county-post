import cbt from "../../ad-assets/CBT4.jpg";
import amberwoodBrush from "../../ad-assets/Amberwood-Brush-Site-250.jpg";
import arwLogo from "../../ad-assets/ARWLogo250.jpg";
import brownGmc from "../../ad-assets/BrownGMC-250.jpg";
import canyonRidge from "../../ad-assets/CanyonRidge250.jpg";
import catchings from "../../ad-assets/Catchings250.jpg";
import becomeAPatriot from "../../ad-assets/BecomeAPatriot.jpg";
import becomeAPatriot2 from "../../ad-assets/BecomeAPatriot2.jpg";
import dyers from "../../ad-assets/Dyers250.jpg";
import hoffbrau from "../../ad-assets/Hoffbrau250.jpg";
import guerrillaGear from "../../ad-assets/ad-guerilla-gear.png";
import lemcInline from "../../ad-assets/LEMC250.jpg";
import lemcBanner from "../../ad-assets/LEMC980.jpg";
import mattressBanner from "../../ad-assets/matress-ad.jpg";
import lawyersTitle from "../../ad-assets/LawyersTitle250.jpg";
import pastureBanner from "../../ad-assets/Pasture-Exchange980.jpg";
import pastureInline from "../../ad-assets/PastureEXCHANGELogo.jpg";
import patriotDispatch from "../../ad-assets/PatriotDispatch.jpg";
import patriotMessaging from "../../ad-assets/PatriotMessaging.jpg";
import patriotTrailer from "../../ad-assets/PatriotTrailerStore.jpg";
import pestCon from "../../ad-assets/PestCon250.jpg";
import piaBanner from "../../ad-assets/PIA980.jpg";
import piaMerchStore from "../../ad-assets/pia-merch-store-ad.jpg";
import plainsBank from "../../ad-assets/PlainsBank250.jpg";
import loriHorner from "../../ad-assets/lori-horner-ad.png";

export type AdSlotId = "inline" | "banner";

export const LORI_HORNER_AD_ID = "lori-horner-inline";
const loriHornerCountyKeys = ["texas/randall", "texas/potter"] as const;

export function countyAdKey(stateSlug: string, countySlug: string) {
  return `${stateSlug}/${countySlug}`;
}

export function isAdVisibleInCounty(ad: AdCreative, countyKey?: string) {
  if (!ad.countyKeys?.length) return true;
  if (!countyKey) return false;
  return ad.countyKeys.includes(countyKey);
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

export type AdCreative = {
  id: string;
  slot: AdSlotId;
  image: string;
  name: string;
  alt: string;
  href: string;
  countyKeys?: string[];
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
    id: "patriot-dispatch-inline",
    slot: "inline",
    image: patriotMessaging,
    name: "Patriot Dispatch",
    alt: "Patriot Dispatch",
    href: "https://patriotsforaction.org/messaging",
  },
  {
    id: "patriot-dispatch-card-inline",
    slot: "inline",
    image: patriotDispatch,
    name: "Patriot Dispatch",
    alt: "Patriot Dispatch",
    href: "https://patriotsforaction.org/messaging",
  },
  {
    id: "pasture-exchange-inline",
    slot: "inline",
    image: pastureInline,
    name: "Pasture Exchange",
    alt: "Pasture Exchange",
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
    id: "arw-inline",
    slot: "inline",
    image: arwLogo,
    name: "ARW",
    alt: "ARW",
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
    id: "canyon-ridge-inline",
    slot: "inline",
    image: canyonRidge,
    name: "Canyon Ridge",
    alt: "Canyon Ridge",
    href: PARTNER_DIRECTORY_PATH,
  },
  {
    id: "catchings-inline",
    slot: "inline",
    image: catchings,
    name: "Catchings",
    alt: "Catchings",
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
    id: "pestcon-inline",
    slot: "inline",
    image: pestCon,
    name: "PestCon",
    alt: "PestCon",
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
    id: "pasture-exchange-banner",
    slot: "banner",
    image: pastureBanner,
    name: "Pasture Exchange",
    alt: "Pasture Exchange",
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
