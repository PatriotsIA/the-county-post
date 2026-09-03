import { Link } from "react-router-dom";
import { dataCentersOpEd } from "../data/county-post-op-eds";

export function DataCentersOpEdPage() {
  return (
    <div className="layout-grid">
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
