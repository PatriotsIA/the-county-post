import { Seo } from "./Seo";
import { jsonLdGraph, newsArticleLd, breadcrumbLd } from "../lib/seo";
import { Link } from "react-router-dom";
import type { CountyPostOpEd } from "../data/county-post-op-eds";

// Paragraphs mark the author's emphasis with **double asterisks**.
function withEmphasis(paragraph: string) {
  return paragraph.split(/\*\*(.+?)\*\*/g).map((part, index) => (index % 2 ? <strong key={index}>{part}</strong> : part));
}

// Link the supplied publication and polling-location addresses without accepting HTML.
function withLinks(paragraph: string) {
  return paragraph.split(/(https:\/\/theballotbox\.com|TheCountyPost\.com)/g).map((part, index) =>
    part === "https://theballotbox.com" || part === "TheCountyPost.com"
      ? <a key={index} href={part === "TheCountyPost.com" ? "https://thecountypost.com" : part}>{part}</a>
      : <span key={index}>{withEmphasis(part)}</span>,
  );
}

export function CountyPostOpEdPage({ article }: { article: CountyPostOpEd }) {
  return (
    <div className="layout-grid">
      <Seo
        title={article.title}
        description={article.deck}
        policy="editorial"
        type="article"
        publishedTime={article.publishedAt}
        jsonLd={jsonLdGraph(
          newsArticleLd({
            path: article.path,
            headline: article.title,
            description: article.deck,
            publishedAt: article.publishedAt,
            authorName: article.byline.replace(/^By\s+/, "").replace(/,\s*The County Post$/, ""),
            section: article.category,
            body: article.paragraphs.join("\n\n").replace(/\*\*/g, "").replace(/^## /gm, ""),
          }),
          breadcrumbLd([
            { name: "United States", path: "/" },
            { name: "Op-Eds", path: "/op-eds" },
            { name: article.title, path: article.path },
          ]),
        )}
      />
      <article className="card editorial-op-ed">
        <header className="editorial-op-ed-header">
          <p className="kicker">{article.category}</p>
          <h1>{article.title}</h1>
          <p className="editorial-op-ed-deck">{article.deck}</p>
          <p className="editorial-op-ed-byline">{article.byline}</p>
        </header>

        <div className="editorial-op-ed-body">
          {article.video && (
            <figure className="editorial-op-ed-video">
              <video controls playsInline preload="none" poster={article.video.poster} aria-label={article.video.label}>
                <source src={article.video.src} type="video/mp4" />
                Your browser does not support embedded video. <a href={article.video.src}>Watch the full recording</a>.
              </video>
              <figcaption>{article.video.caption} <a href={article.video.src}>Open the full video</a>.</figcaption>
              {article.video.moreUrl && (
                <a className="button-link editorial-op-ed-video-more" href={article.video.moreUrl}>
                  Watch the full video and learn more
                </a>
              )}
            </figure>
          )}
          {article.paragraphs.map((paragraph) => paragraph.startsWith("## ")
            ? <h2 key={paragraph}>{withEmphasis(paragraph.slice(3))}</h2>
            : <p key={paragraph}>{withLinks(paragraph)}</p>,
          )}
          <p className="editorial-op-ed-author">{withLinks(article.authorBio)}</p>
        </div>

        <Link className="button-link editorial-op-ed-back" to="/op-eds">
          Return to National Op-Eds
        </Link>
        {article.footerAd && (
          <aside className="editorial-op-ed-ad" aria-label={`${article.footerAd.name} advertisement`}>
            <p className="ad-slot-label">Advertisement</p>
            <a href={article.footerAd.href} target="_blank" rel="noreferrer sponsored">
              <img src={article.footerAd.image} alt={article.footerAd.alt} width="600" height="600" loading="lazy" />
            </a>
          </aside>
        )}
      </article>
    </div>
  );
}
