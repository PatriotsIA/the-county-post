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

// All nine videos in https://vimeo.com/showcase/12112279, verified 2026-09-14
// against https://vimeo.com/api/v2/album/12112279/videos.json.
// Keep the shared partner name so all episodes produce one directory listing.
const episodes = [
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

export const panhandleLegendsAds: AdCreative[] = episodes.map((episode) => ({
  id: `panhandle-legends-${episode.id}`,
  slot: "inline",
  image: episode.image,
  name: "Panhandle Legends",
  alt: `Panhandle Legends — ${episode.title}`,
  href: "https://shop.patriotsinaction.com/collections/texas-panhandle-legends",
  stateSlugs: ["texas"],
  video: {
    title: episode.title,
    embedUrl: `https://player.vimeo.com/video/${episode.vimeoId}?autoplay=1&dnt=1&title=0&byline=0&portrait=0`,
    watchUrl: `https://vimeo.com/${episode.vimeoId}`,
  },
}));
