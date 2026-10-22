import { Seo } from "./Seo";
import { jsonLdGraph, newsArticleLd, breadcrumbLd } from "../lib/seo";
import { Link } from "react-router-dom";
import type { CountyPostOpEd } from "../data/county-post-op-eds";

// Paragraphs mark the author's emphasis with **double asterisks**.
function withEmphasis(paragraph: string) {
  return paragraph.split(/\*\*(.+?)\*\*/g).map((part, index) => (index % 2 ? <strong key={index}>{part}</strong> : part));
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
            body: article.paragraphs.join("\n\n").replace(/\*\*/g, ""),
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
          {article.paragraphs.map((paragraph) => (
            <p key={paragraph}>{withEmphasis(paragraph)}</p>
          ))}
          <p className="editorial-op-ed-author">{article.authorBio}</p>
        </div>

        <Link className="button-link editorial-op-ed-back" to="/op-eds">
          Return to National Op-Eds
        </Link>
      </article>
    </div>
  );
}
