import quanahParker from "../../ad-assets/panhandle-legends-quanah-parker.jpg";
import georgiaOKeeffe from "../../ad-assets/panhandle-legends-georgia-okeeffe.jpg";
import rickHusband from "../../ad-assets/panhandle-legends-rick-husband.jpg";
import promo from "../../ad-assets/panhandle-legends-promo.jpg";
import melissaEakle from "../../ad-assets/panhandle-legends-melissa-eakle.jpg";
import joeFortenberry from "../../ad-assets/panhandle-legends-joe-fortenberry.jpg";
import frenchyMcCormick from "../../ad-assets/panhandle-legends-frenchy-mccormick.jpg";
import frayPadilla from "../../ad-assets/panhandle-legends-fray-padilla.jpg";
import bonesHooks from "../../ad-assets/panhandle-legends-bones-hooks.jpg";
import type { AdCreative } from "./ads";

export const PANHANDLE_LEGENDS_PATH = "/legends";
export const PANHANDLE_LEGENDS_TITLE = "Panhandle Legends — Texas Statewide Sponsor";
export const PANHANDLE_LEGENDS_DESCRIPTION = "Explore Panhandle Legends, a Texas statewide sponsor of The County Post. Watch nine short videos celebrating the people and history of the Texas Panhandle.";
export const PANHANDLE_LEGENDS_SHOP_URL = "https://shop.patriotsinaction.com/collections/texas-panhandle-legends";

// Publisher identity and video durations verified against Vimeo's public
// showcase catalog; other sources are recorded in docs/texas-legends.md.
export const panhandleLegendsLinks = [
  { label: "The complete Vimeo collection", detail: "All Panhandle Legends videos in one showcase.", href: "https://vimeo.com/showcase/12112279", kind: "Watch" },
  { label: "Patriots in Action TV", detail: "Follow the series publisher on Vimeo.", href: "https://vimeo.com/patriotsinactiontv", kind: "Follow" },
  { label: "Patriots in Action", detail: "Visit the website of a series collaborator.", href: "https://patriotsinaction.com/", kind: "Website" },
  { label: "Patriots in Action community", detail: "Connect with the Patriots in Action community.", href: "https://community.patriotsinaction.com/", kind: "Community" },
  { label: "KAMR Local 4 News", detail: "News and stories from the series’ television producer.", href: "https://www.myhighplains.com/", kind: "Website" },
  { label: "KAMR on Facebook", detail: "Follow KAMR Local 4 News on Facebook.", href: "https://www.facebook.com/KAMRLOCAL4NEWS/", kind: "Social" },
  { label: "KAMR on X", detail: "Follow KAMR Local 4 News on X / Twitter.", href: "https://twitter.com/KAMRLocal4News", kind: "Social" },
  { label: "Texas Panhandle Legends merchandise", detail: "Explore the series collection at Patriot Merch.", href: PANHANDLE_LEGENDS_SHOP_URL, kind: "Shop" },
];

// All nine videos in https://vimeo.com/showcase/12112279, verified 2026-09-14
// against https://vimeo.com/api/v2/album/12112279/videos.json.
// Keep the shared partner name so all episodes produce one directory listing.
export const panhandleLegendsEpisodes = [
  { id: "quanah-parker", vimeoId: "1215218560", title: "Quanah Parker", image: quanahParker },
  { id: "georgia-okeeffe", vimeoId: "1206153465", title: "Georgia O’Keeffe", image: georgiaOKeeffe },
  { id: "rick-husband", vimeoId: "1165499745", title: "Rick Husband", image: rickHusband },
  { id: "promo", vimeoId: "1165499670", title: "Panhandle Legends Promo", image: promo },
  { id: "melissa-eakle", vimeoId: "1165499251", title: "Melissa Eakle", image: melissaEakle },
  { id: "joe-fortenberry", vimeoId: "1165499027", title: "Joe Fortenberry", image: joeFortenberry },
  { id: "frenchy-mccormick", vimeoId: "1165498956", title: "Frenchy McCormick", image: frenchyMcCormick },
  { id: "fray-padilla", vimeoId: "1165498523", title: "Fray Padilla", image: frayPadilla },
  { id: "bones-hooks", vimeoId: "1165498343", title: "Bones Hooks", image: bonesHooks },
];

export const panhandleLegendsAds: AdCreative[] = panhandleLegendsEpisodes.map((episode) => ({
  id: `panhandle-legends-${episode.id}`,
  slot: "inline",
  image: episode.image,
  name: "Panhandle Legends",
  alt: `Panhandle Legends — ${episode.title}`,
  href: PANHANDLE_LEGENDS_SHOP_URL,
  stateSlugs: ["texas"],
  video: {
    title: episode.title,
    embedUrl: `https://player.vimeo.com/video/${episode.vimeoId}?autoplay=1&dnt=1&title=0&byline=0&portrait=0`,
    watchUrl: `https://vimeo.com/${episode.vimeoId}`,
  },
}));
