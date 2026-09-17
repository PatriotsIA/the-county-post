import { Link } from "react-router-dom";
import type { CountySite } from "../data/counties";
import { panhandleLegendsEpisodes, texasLegendsLinks, TEXAS_LEGENDS_DESCRIPTION, TEXAS_LEGENDS_PATH, texasLegendsPath } from "../data/panhandle-legends";
import { absoluteUrl, collectionPageLd, countyCrumbs, jsonLdGraph } from "../lib/seo";
import { Seo } from "./Seo";
import "./TexasLegends.css";

export function TexasLegends({ county }: { county?: CountySite }) {
  const promo = panhandleLegendsEpisodes.find((episode) => episode.id === "promo")!;
  const profiles = panhandleLegendsEpisodes.filter((episode) => episode.id !== "promo");
  const episodes = [promo, ...profiles];
  const crumbs = county
    ? countyCrumbs(county, { name: "Texas Legends", slug: "texas-legends" })
    : [{ name: "United States", path: "/" }, { name: "Texas", path: "/texas" }, { name: "Texas Legends", path: TEXAS_LEGENDS_PATH }];

  return (
    <div className="legends-page">
      <Seo
        title="Texas Legends — The Panhandle Legends Video Collection"
        description={TEXAS_LEGENDS_DESCRIPTION}
        policy="editorial"
        canonicalPath={TEXAS_LEGENDS_PATH}
        jsonLd={jsonLdGraph(
          collectionPageLd({ path: TEXAS_LEGENDS_PATH, name: "Texas Legends — Panhandle Legends", description: TEXAS_LEGENDS_DESCRIPTION, crumbs }),
          {
            "@type": "ItemList",
            name: "Panhandle Legends videos",
            numberOfItems: episodes.length,
            itemListElement: episodes.map((episode, index) => ({
              "@type": "ListItem", position: index + 1, name: episode.title,
              url: `https://vimeo.com/${episode.vimeoId}`, image: absoluteUrl(episode.image),
            })),
          },
        )}
      />

      <section className="legends-hero" aria-labelledby="legends-title">
        <div className="legends-intro">
          <p className="kicker">Texas history · The Panhandle Legends collection</p>
          <h1 id="legends-title">Texas Legends</h1>
          <p className="legends-deck">The people who shaped the Texas Panhandle.</p>
          <p>Discover the lives behind the names. Panhandle Legends tells the stories of the people whose creativity, courage, and community spirit left a mark on Amarillo and the surrounding region.</p>
          <a className="legends-button" href="#legends-videos">Explore all {episodes.length} videos <span aria-hidden="true">↓</span></a>
          <p className="legends-edition">{county ? `From your ${county.displayName} edition` : "From The County Post’s Texas edition"}</p>
        </div>
        <a className="legends-feature" href={`https://vimeo.com/${promo.vimeoId}`} target="_blank" rel="noreferrer sponsored" aria-label="Watch the Panhandle Legends introduction on Vimeo (15 seconds)">
          <img src={promo.image} alt="Panhandle Legends series introduction" width="640" height="360" />
          <span className="legends-feature-caption"><span className="legends-play" aria-hidden="true">▶</span><span>Start with the introduction<small>15 seconds · Watch on Vimeo ↗</small></span></span>
        </a>
      </section>

      <section className="legends-about" aria-labelledby="legends-about-title">
        <div><p className="kicker">About the series</p><h2 id="legends-about-title">A little history.<br />A lasting legacy.</h2></div>
        <div>
          <p>Panhandle Legends is a series of short video portraits celebrating the history, heritage, and notable people of the Texas Panhandle. These stories connect viewers with the region’s past and offer an accessible starting point for families, classrooms, and anyone curious about local history.</p>
          <p>Created by historian King Hill in collaboration with KAMR Local 4 News and Patriots in Action.</p>
          <p className="legends-source"><a href="https://www.aol.com/articles/panhandle-legends-series-honored-city-090135000.html" target="_blank" rel="noreferrer">Read about the series and its educational mission ↗</a></p>
        </div>
      </section>

      <section id="legends-videos" className="legends-videos" aria-labelledby="legends-videos-title">
        <header className="legends-section-heading"><div><p className="kicker">The video collection</p><h2 id="legends-videos-title">Meet the legends</h2></div><p>Eight one-minute stories. One short introduction.</p></header>
        <div className="legends-video-grid">
          {episodes.map((episode, index) => (
            <article className="legends-video-card" key={episode.id}>
              <a href={`https://vimeo.com/${episode.vimeoId}`} target="_blank" rel="noreferrer sponsored" aria-label={`Watch ${episode.title} on Vimeo`}>
                <div className="legends-thumbnail"><img src={episode.image} alt="" loading="lazy" width="640" height="360" /><span className="legends-play" aria-hidden="true">▶</span><span className="legends-duration">{episode.id === "promo" ? "0:15" : "1:00"}</span></div>
                <div className="legends-video-copy"><p className="kicker">{index === 0 ? "Start here" : `Portrait ${String(index).padStart(2, "0")}`}</p><h3>{episode.title}</h3><span className="legends-watch">Watch on Vimeo <span aria-hidden="true">↗</span></span></div>
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="legends-connect" aria-labelledby="legends-connect-title">
        <header className="legends-section-heading"><div><p className="kicker">Keep exploring</p><h2 id="legends-connect-title">Watch. Follow. Connect.</h2></div><p>The series collection, its publishers, and their social channels.</p></header>
        <div className="legends-link-grid">{texasLegendsLinks.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noreferrer sponsored" className="legends-resource"><span className="kicker">{link.kind}</span><h3>{link.label} <span aria-hidden="true">↗</span></h3><p>{link.detail}</p></a>
        ))}</div>
      </section>

      <div className="legends-return"><Link to={county ? `/texas/${county.slug}` : "/texas"}>← Back to {county ? county.displayName : "Texas"} news</Link><Link to={county ? `/texas/${county.slug}/partners` : "/partners"}>Meet our partners</Link>{county ? <Link to={texasLegendsPath()}>Texas collection</Link> : null}</div>
    </div>
  );
}
