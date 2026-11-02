import type { ReactNode } from "react";
import { Seo } from "./Seo";
import { jsonLdGraph, newsArticleLd, breadcrumbLd } from "../lib/seo";
import { Link } from "react-router-dom";
import type { CountyPostOpEd } from "../data/county-post-op-eds";

// Paragraphs mark **bold**, _italic_ and [link text](https://…) without accepting HTML.
// Italic marks sit at word edges, so underscores inside link URLs (utm_source) are not marks.
const MARKUP = /(\[[^\]]+\]\(https:\/\/[^)\s]+\)|\*\*.+?\*\*|(?<!\w)_(?=\S).+?(?<=\S)_(?!\w))/g;

function withMarkup(paragraph: string, autolink = true): ReactNode[] {
  return paragraph.split(MARKUP).map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/);
    if (link) return <a key={index} href={link[2]}>{withMarkup(link[1], false)}</a>;
    if (/^\*\*.+\*\*$/.test(part)) return <strong key={index}>{withMarkup(part.slice(2, -2), autolink)}</strong>;
    if (/^_\S(.*\S)?_$/.test(part)) return <em key={index}>{withMarkup(part.slice(1, -1), autolink)}</em>;
    return autolink ? <span key={index}>{withAddressLinks(part)}</span> : part;
  });
}

// Link the supplied publication and polling-location addresses where they appear bare.
function withAddressLinks(text: string) {
  return text.split(/(https:\/\/theballotbox\.com|TheCountyPost\.com)/g).map((part, index) =>
    part === "https://theballotbox.com" || part === "TheCountyPost.com"
      ? <a key={index} href={part === "TheCountyPost.com" ? "https://thecountypost.com" : part}>{part}</a>
      : part,
  );
}

function plainText(paragraph: string) {
  return paragraph.replace(/^## /, "").replace(/\[([^\]]+)\]\(https:\/\/[^)\s]+\)/g, "$1").replace(/\*\*/g, "").replace(/(?<!\w)_(?=\S)(.+?)(?<=\S)_(?!\w)/g, "$1");
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
            authorName: article.authorName ?? article.byline.replace(/^By\s+/, "").replace(/,\s*The County Post$/, ""),
            section: article.category,
            body: article.paragraphs.map(plainText).join("\n\n"),
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
          {article.authorLink && (
            <Link className="button-link editorial-op-ed-author-link" to={article.authorLink.path}>
              {article.authorLink.label}
            </Link>
          )}
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
            ? <h2 key={paragraph}>{withMarkup(paragraph.slice(3), false)}</h2>
            : <p key={paragraph}>{withMarkup(paragraph)}</p>,
          )}
          <p className="editorial-op-ed-author">{withMarkup(article.authorBio)}</p>
          {article.authorLink && (
            <Link className="button-link editorial-op-ed-author-link" to={article.authorLink.path}>
              {article.authorLink.label}
            </Link>
          )}
        </div>

        <Link className="button-link editorial-op-ed-back" to="/op-eds">
          Return to National Op-Eds
        </Link>
      </article>
    </div>
  );
}
