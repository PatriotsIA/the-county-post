import amberwoodBrush from "../../ad-assets/amberwood-brush-square.png";
import amberwoodBrushLogo from "../../ad-assets/amberwood-brush-logo.png";
import becomeAPatriot from "../../ad-assets/BecomeAPatriot.jpg";
import becomeAPatriot2 from "../../ad-assets/BecomeAPatriot2.jpg";
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
import parallelRoofing from "../../ad-assets/parallel-roofing.png";
import parallelBuilders from "../../ad-assets/parallel-builders.png";
import gopConnect from "../../ad-assets/gopconnect-be-informed.png";
import darrylBergstresserBanner from "../../ad-assets/darryl-bergstresser-banner.png";
import dignityMemorialLogo from "../../ad-assets/dignity-memorial-logo.jpg";
import booksAllSquare from "../../ad-assets/books-all-square.webp";
import booksAllBanner from "../../ad-assets/books-all-banner.webp";
import booksCaesarRodneySquare from "../../ad-assets/books-caesar-rodney-square.webp";
import booksCaesarRodneyBanner from "../../ad-assets/books-caesar-rodney-banner.webp";
import booksElectronicVotingSquare from "../../ad-assets/books-electronic-voting-square.webp";
import booksElectronicVotingBanner from "../../ad-assets/books-electronic-voting-banner.webp";
import booksFoundingFathersSquare from "../../ad-assets/books-founding-fathers-square.webp";
import booksFoundingFathersBanner from "../../ad-assets/books-founding-fathers-banner.webp";
import booksFoundingOfAmericaSquare from "../../ad-assets/books-founding-of-america-square.webp";
import booksFoundingOfAmericaBanner from "../../ad-assets/books-founding-of-america-banner.webp";
import booksGrowingTheNationSquare from "../../ad-assets/books-growing-the-nation-square.webp";
import booksGrowingTheNationBanner from "../../ad-assets/books-growing-the-nation-banner.webp";
import booksMenWhoHeldTheOarsSquare from "../../ad-assets/books-men-who-held-the-oars-square.webp";
import booksMenWhoHeldTheOarsBanner from "../../ad-assets/books-men-who-held-the-oars-banner.webp";
import booksOperationShowUpSquare from "../../ad-assets/books-operation-show-up-square.webp";
import booksOperationShowUpBanner from "../../ad-assets/books-operation-show-up-banner.webp";
import booksWomenWhoGuardedTheBridgeSquare from "../../ad-assets/books-women-who-guarded-the-bridge-square.webp";
import booksWomenWhoGuardedTheBridgeBanner from "../../ad-assets/books-women-who-guarded-the-bridge-banner.webp";
import ballotBoxSquare from "../../ad-assets/ballot-box-square.webp";
import ballotBoxBanner from "../../ad-assets/ballot-box-banner.webp";
import patriotsForPaperSquare from "../../ad-assets/patriots-for-paper-square.webp";
import patriotsForPaperBanner from "../../ad-assets/patriots-for-paper-banner.webp";
import stopSexualizingSquare from "../../ad-assets/stop-sexualizing-texas-children-square.webp";
import stopSexualizingBanner from "../../ad-assets/stop-sexualizing-texas-children-banner.webp";
import texasShariaWatchSquare from "../../ad-assets/texas-sharia-watch-square.webp";
import texasShariaWatchBanner from "../../ad-assets/texas-sharia-watch-banner.webp";
import dignityMemorialWordmark from "../../ad-assets/dignity-memorial-wordmark.jpg";
import { panhandleLegendsAds } from "./panhandle-legends";

export type AdSlotId = "inline" | "banner";

export const DIGNITY_MEMORIAL_AD_ID = "dignity-memorial-sponsor";
export const LORI_HORNER_AD_ID = "lori-horner-inline";
const loriHornerCountyKeys = ["texas/randall", "texas/potter"] as const;
const parallelCountyKeys = ["texas/randall", "texas/potter"];
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

/** The first of the requested sponsors that appears in the edition presents the feed. */
export function getFeedSponsor(ids: string[], editionKey?: string) {
  const sponsors = [...ads, ...feedOnlySponsors].filter((ad) =>
    ad.slot === "inline" && isAdVisibleInCounty(ad, editionKey) && canSponsorFeed(ad));
  return ids.map((id) => sponsors.find((ad) => ad.id === id)).find(Boolean);
}

const DEFAULT_IN_FEED_AD_WEIGHT = 3;

export function getInFeedAdRotation(editionKey?: string) {
  const inFeedAds = getAdsForSlot("inline", editionKey).filter((ad) => !isCarouselOnlyAd(ad.id));
  const videoAds = inFeedAds.filter((ad) => ad.video);
  const imageRotation = Array.from({ length: DEFAULT_IN_FEED_AD_WEIGHT }, (_, round) =>
    inFeedAds.filter((ad) => !ad.video && (ad.inFeedWeight ?? DEFAULT_IN_FEED_AD_WEIGHT) > round),
  ).flat();
  if (!videoAds.length) return imageRotation;
  if (!imageRotation.length) return videoAds;
  // Repeat complete weighted image rounds so a smaller advertiser roster still
  // leaves room for every video in the rotation.
  const imageRounds = Math.ceil((videoAds.length * 4) / imageRotation.length);
  const completeImageRotation = Array.from({ length: imageRounds }, () => imageRotation).flat();
  // Use one of the existing ad positions for video after four image ads.
  // Each feed starts at a different point, and the overall ad density is unchanged.
  return completeImageRotation.flatMap((ad, index) => index % 4 === 3
    ? [ad, videoAds[Math.floor(index / 4) % videoAds.length]]
    : [ad]);
}

export type AdCreative = {
  id: string;
  slot: AdSlotId;
  image: string;
  sponsorImage?: string;
  name: string;
  alt: string;
  href: string;
  stateSlugs?: string[];
  countyKeys?: string[];
  inFeedWeight?: number;
  /** false keeps the ad out of the county masthead sponsor pool, so existing assignments hold. */
  mastheadSponsor?: boolean;
  video?: { embedUrl: string; title: string; watchUrl: string };
};

export const PARTNER_DIRECTORY_PATH = "/partners";

const BOOKS_URL = "https://shop.patriotsinaction.com/collections/books";
const STOP_SEXUALIZING_URL = "https://recoveramerica.com/protectchildren";
const TEXAS_SHARIA_WATCH_URL = "https://www.facebook.com/profile.php?id=61593844757341";
const STOP_SEXUALIZING_ALT = "Stop sexualizing Texas children. Let children be children.";
const TEXAS_SHARIA_WATCH_ALT = "Texas Sharia Watch — Sharia-Free Texas, legislative priority #2.";

// Patriots in Action books: a square and a banner for each of nine titles. Each
// runs at weight 1, so together they take about three advertisers' in-feed share.
const books = {
  "all": { square: booksAllSquare, banner: booksAllBanner, alt: "Books for All Ages — the Patriots in Action book collection. Shop the collection." },
  "caesar-rodney": { square: booksCaesarRodneySquare, banner: booksCaesarRodneyBanner, alt: "One ride. A nation’s future. Discover the courage of Caesar Rodney — read the story." },
  "electronic-voting": { square: booksElectronicVotingSquare, banner: booksElectronicVotingBanner, alt: "Big title. Bigger punchline. Everything a Voter Can Personally Verify About Electronic Voting by Daniel L. Rogers — get the book." },
  "founding-fathers": { square: booksFoundingFathersSquare, banner: booksFoundingFathersBanner, alt: "Big ideas. Bright colors. America’s Founding Fathers coloring book — color America’s founding story. Shop now." },
  "founding-of-america": { square: booksFoundingOfAmericaSquare, banner: booksFoundingOfAmericaBanner, alt: "Color your way through history! The Founding of America coloring book. Shop now." },
  "growing-the-nation": { square: booksGrowingTheNationSquare, banner: booksGrowingTheNationBanner, alt: "A growing nation. A colorful adventure. Growing the Nation coloring book. Shop now." },
  "men-who-held-the-oars": { square: booksMenWhoHeldTheOarsSquare, banner: booksMenWhoHeldTheOarsBanner, alt: "Ordinary men. Extraordinary courage. The Men Who Held the Oars: How Fishermen Carried the Revolution — read the story." },
  "operation-show-up": { square: booksOperationShowUpSquare, banner: booksOperationShowUpBanner, alt: "Liberty is not a spectator sport. Operation Show Up by Daniel L. Rogers — get the book." },
  "women-who-guarded-the-bridge": { square: booksWomenWhoGuardedTheBridgeSquare, banner: booksWomenWhoGuardedTheBridgeBanner, alt: "Someone had to guard the bridge. The Women Who Guarded the Bridge — read the story." },
};

function bookAd(title: keyof typeof books, slot: AdSlotId): AdCreative {
  const book = books[title];
  return {
    id: `books-${title}-${slot}`,
    slot,
    image: slot === "inline" ? book.square : book.banner,
    name: "Patriots in Action Books",
    alt: book.alt,
    href: BOOKS_URL,
    inFeedWeight: 1,
    mastheadSponsor: false,
  };
}

// When adding a county-scoped ad (countyKeys), it is included automatically on that
// county's partners page and in the global partners directory via src/data/partners.ts.
// Array order is rotation order: new creatives sit between existing ones of the same slot.
export const ads: AdCreative[] = [
  {
    id: "gopconnect-inline",
    slot: "inline",
    image: gopConnect,
    name: "GOPConnect",
    alt: "My Local GOP — Be informed. Text GOP to 84576. Paid for by GOPConnect, LLC.",
    href: "https://mylocalgop.com/",
  },
  bookAd("all", "inline"),
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
    id: "parallel-roofing-inline",
    slot: "inline",
    image: parallelRoofing,
    name: "Parallel Roofing",
    alt: "Parallel Roofing — a division of Parallel Builders",
    href: "https://pb-tx.com/",
    countyKeys: parallelCountyKeys,
  },
  {
    id: "parallel-roofing-banner",
    slot: "banner",
    image: parallelRoofing,
    name: "Parallel Roofing",
    alt: "Parallel Roofing — a division of Parallel Builders",
    href: "https://pb-tx.com/",
    countyKeys: parallelCountyKeys,
  },
  {
    id: "parallel-builders-inline",
    slot: "inline",
    image: parallelBuilders,
    name: "Parallel Builders",
    alt: "Parallel Builders — general contractors",
    href: "https://pb-tx.com/",
    countyKeys: parallelCountyKeys,
  },
  {
    id: "parallel-builders-banner",
    slot: "banner",
    image: parallelBuilders,
    name: "Parallel Builders",
    alt: "Parallel Builders — general contractors",
    href: "https://pb-tx.com/",
    countyKeys: parallelCountyKeys,
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
  bookAd("caesar-rodney", "inline"),
  {
    id: "ballot-box-inline",
    slot: "inline",
    image: ballotBoxSquare,
    name: "The Ballot Box",
    alt: "The Ballot Box — Your community. Your government. Explore officials, candidates and races at TheBallotBox.com.",
    href: "https://theballotbox.com/",
    mastheadSponsor: false,
  },
  bookAd("electronic-voting", "inline"),
  {
    id: "stop-sexualizing-texas-children-inline",
    slot: "inline",
    image: stopSexualizingSquare,
    name: "Stop Sexualizing Texas Children",
    alt: STOP_SEXUALIZING_ALT,
    href: STOP_SEXUALIZING_URL,
    stateSlugs: ["texas"],
    mastheadSponsor: false,
  },
  {
    id: "plains-bank-inline",
    slot: "inline",
    image: plainsBank,
    name: "Plains Bank",
    alt: "Plains Bank",
    href: PARTNER_DIRECTORY_PATH,
  },
  bookAd("founding-fathers", "inline"),
  {
    id: "patriot-trailer-inline",
    slot: "inline",
    image: patriotTrailer,
    name: "Patriot Trailer Store",
    alt: "Patriot Trailer Store",
    href: "https://piaevents.com/",
  },
  bookAd("founding-of-america", "inline"),
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
  bookAd("all", "banner"),
  bookAd("caesar-rodney", "banner"),
  {
    id: "ballot-box-banner",
    slot: "banner",
    image: ballotBoxBanner,
    name: "The Ballot Box",
    alt: "The Ballot Box — Your community. Your government. Explore officials, candidates and races at TheBallotBox.com.",
    href: "https://theballotbox.com/",
    mastheadSponsor: false,
  },
  bookAd("electronic-voting", "banner"),
  {
    id: "stop-sexualizing-texas-children-banner",
    slot: "banner",
    image: stopSexualizingBanner,
    name: "Stop Sexualizing Texas Children",
    alt: STOP_SEXUALIZING_ALT,
    href: STOP_SEXUALIZING_URL,
    stateSlugs: ["texas"],
    mastheadSponsor: false,
  },
  bookAd("founding-fathers", "banner"),
  {
    id: "amberwood-brush-inline",
    slot: "inline",
    image: amberwoodBrush,
    sponsorImage: amberwoodBrushLogo,
    name: "Amberwood Brush",
    alt: "Amberwood Brush Site — serving residential and commercial customers",
    href: PARTNER_DIRECTORY_PATH,
  },
  bookAd("growing-the-nation", "inline"),
  {
    id: "patriots-for-paper-inline",
    slot: "inline",
    image: patriotsForPaperSquare,
    name: "Patriots for Paper",
    alt: "Patriots for Paper — Paper ballots. Public counts. Real audits. Join the pledge at PatriotsForPaper.com.",
    href: "https://patriotsforpaper.com/",
    stateSlugs: ["texas"],
    mastheadSponsor: false,
  },
  {
    id: "become-a-patriot-inline",
    slot: "inline",
    image: becomeAPatriot,
    name: "Become a Patriot",
    alt: "Become a Patriot",
    href: "https://community.patriotsinaction.com/",
  },
  bookAd("men-who-held-the-oars", "inline"),
  {
    id: "texas-sharia-watch-inline",
    slot: "inline",
    image: texasShariaWatchSquare,
    name: "Texas Sharia Watch",
    alt: TEXAS_SHARIA_WATCH_ALT,
    href: TEXAS_SHARIA_WATCH_URL,
    stateSlugs: ["texas"],
    mastheadSponsor: false,
  },
  {
    id: "become-a-patriot-2-inline",
    slot: "inline",
    image: becomeAPatriot2,
    name: "Become a Patriot",
    alt: "Become a Patriot",
    href: "https://community.patriotsinaction.com/",
  },
  bookAd("operation-show-up", "inline"),
  {
    id: "lawyers-title-inline",
    slot: "inline",
    image: lawyersTitle,
    name: "Lawyers Title",
    alt: "Lawyers Title",
    href: PARTNER_DIRECTORY_PATH,
  },
  bookAd("women-who-guarded-the-bridge", "inline"),
  {
    id: "mattress-banner",
    slot: "banner",
    image: mattressBanner,
    name: "Mattress By Appointment",
    alt: "Mattress By Appointment",
    href: PARTNER_DIRECTORY_PATH,
  },
  bookAd("founding-of-america", "banner"),
  {
    id: "patriots-for-paper-banner",
    slot: "banner",
    image: patriotsForPaperBanner,
    name: "Patriots for Paper",
    alt: "Patriots for Paper — Paper ballots. Public counts. Real audits. Join the pledge at PatriotsForPaper.com.",
    href: "https://patriotsforpaper.com/",
    stateSlugs: ["texas"],
    mastheadSponsor: false,
  },
  bookAd("growing-the-nation", "banner"),
  {
    id: "pia-banner",
    slot: "banner",
    image: piaBanner,
    name: "Patriots in Action",
    alt: "Patriots in Action",
    href: "https://community.patriotsinaction.com/",
  },
  {
    id: "darryl-bergstresser-banner",
    slot: "banner",
    image: darrylBergstresserBanner,
    name: "Darryl Bergstresser — Barrett Financial Group",
    alt: "Darryl Bergstresser, Mr. Mortgage — Barrett Financial Group. Call (918) 313-3851. NMLS #224307.",
    href: "https://www.barrettfinancial.com/",
    countyKeys: [
      "oklahoma/tulsa",
      "oklahoma/rogers",
      "oklahoma/oklahoma",
      "texas/potter",
      "texas/randall",
      "texas/midland",
      "texas/ector",
    ],
  },
  bookAd("men-who-held-the-oars", "banner"),
  {
    id: "texas-sharia-watch-banner",
    slot: "banner",
    image: texasShariaWatchBanner,
    name: "Texas Sharia Watch",
    alt: TEXAS_SHARIA_WATCH_ALT,
    href: TEXAS_SHARIA_WATCH_URL,
    stateSlugs: ["texas"],
    mastheadSponsor: false,
  },
  bookAd("operation-show-up", "banner"),
  bookAd("women-who-guarded-the-bridge", "banner"),
];

// Sponsors that present a feed and are listed on the partner pages, but stay out
// of the ad rotation and the county masthead sponsor.
export const feedOnlySponsors: AdCreative[] = [
  {
    id: DIGNITY_MEMORIAL_AD_ID,
    slot: "inline",
    image: dignityMemorialWordmark,
    sponsorImage: dignityMemorialLogo,
    name: "Dignity Memorial",
    alt: "Dignity Memorial",
    href: "https://www.dignitymemorial.com/",
    stateSlugs: ["texas"],
  },
];
