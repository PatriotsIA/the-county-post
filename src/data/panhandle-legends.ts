import quanahParker from "../../ad-assets/panhandle-legends-quanah-parker.jpg";
import georgiaOKeeffe from "../../ad-assets/panhandle-legends-georgia-okeeffe.jpg";
import goodnights from "../../ad-assets/panhandle-legends-goodnights.jpg";
import type { AdCreative } from "./ads";

// Published Panhandle Legends episodes from https://vimeo.com/patriotsinactiontv.
// Keep the shared partner name so all episodes produce one directory listing.
const episodes = [
  { id: "quanah-parker", vimeoId: "1215218560", title: "Quanah Parker", image: quanahParker },
  { id: "georgia-okeeffe", vimeoId: "1206153465", title: "Georgia O’Keeffe", image: georgiaOKeeffe },
  { id: "goodnights", vimeoId: "1189445279", title: "Charles & Mary Ann Goodnight", image: goodnights },
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
