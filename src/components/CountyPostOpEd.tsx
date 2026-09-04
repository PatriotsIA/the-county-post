import { Seo } from "./Seo";
import { jsonLdGraph, newsArticleLd, breadcrumbLd } from "../lib/seo";
import { Link } from "react-router-dom";
import { dataCentersOpEd } from "../data/county-post-op-eds";

export function DataCentersOpEdPage() {
  return (
    <div className="layout-grid">
      <Seo
        title={dataCentersOpEd.title}
        description={dataCentersOpEd.deck}
        policy="editorial"
        type="article"
        publishedTime={dataCentersOpEd.publishedAt}
        jsonLd={jsonLdGraph(
          newsArticleLd({
            path: dataCentersOpEd.path,
            headline: dataCentersOpEd.title,
            description: dataCentersOpEd.deck,
            publishedAt: dataCentersOpEd.publishedAt,
            authorName: dataCentersOpEd.byline.replace(/^By\s+/, "").replace(/,\s*The County Post$/, ""),
            section: dataCentersOpEd.category,
            body: dataCentersOpEd.paragraphs.join("\n\n"),
          }),
          breadcrumbLd([
            { name: "United States", path: "/" },
            { name: "Op-Eds", path: "/op-eds" },
            { name: dataCentersOpEd.title, path: dataCentersOpEd.path },
          ]),
        )}
      />
      <article className="card editorial-op-ed">
        <header className="editorial-op-ed-header">
          <p className="kicker">{dataCentersOpEd.category}</p>
          <h1>{dataCentersOpEd.title}</h1>
          <p className="editorial-op-ed-deck">{dataCentersOpEd.deck}</p>
          <p className="editorial-op-ed-byline">{dataCentersOpEd.byline}</p>
        </header>

        <div className="editorial-op-ed-body">
          {dataCentersOpEd.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <p className="editorial-op-ed-author">{dataCentersOpEd.authorBio}</p>
        </div>

        <Link className="button-link editorial-op-ed-back" to="/op-eds">
          Return to National Op-Eds
        </Link>
      </article>
    </div>
  );
}
