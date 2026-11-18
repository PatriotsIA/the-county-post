import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getExactSearchState, searchCounties, searchStates } from "../data/place-search";

const stateHomePath = (state: { slug: string }) => `/${state.slug}`;
const countyPath = (county: { slug: string; state: { slug: string } }) => `/${county.state.slug}/${county.slug}`;

/**
 * The red Find A County search, wherever it appears: the front page, the
 * state directory, the corner menu. Typing lists matching states and counties;
 * Search goes to the best match (an exact state name first), and any listed
 * place can be chosen directly. `onNavigate` runs after either, so a menu can
 * close itself even when the reader picks the page they are already on.
 */
export function CountySearch({ id, className, heading, onNavigate }: {
  id?: string;
  className?: string;
  heading: ReactNode;
  onNavigate?: () => void;
}) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const hasQuery = query.trim().length > 0;
  const countyMatches = useMemo(() => (hasQuery ? searchCounties(query) : []), [hasQuery, query]);
  const stateMatches = useMemo(() => (hasQuery ? searchStates(query) : []), [hasQuery, query]);
  const bestCounty = countyMatches[0];
  const bestState = getExactSearchState(query) || stateMatches[0];
  const results = [
    ...stateMatches.map((state) => ({ type: "state" as const, state })),
    ...countyMatches.map((county) => ({ type: "county" as const, county })),
  ];

  return (
    <section id={id} className={`card county-finder${className ? ` ${className}` : ""}`}>
      {heading}
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault();
          const destination = bestState ? stateHomePath(bestState) : bestCounty ? countyPath(bestCounty) : undefined;
          if (!destination) return;
          navigate(destination);
          onNavigate?.();
        }}
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by county or state (e.g., Orange, TX)"
          aria-label="Search for a county or state"
        />
        <button type="submit" disabled={!results.length}>
          Search
        </button>
      </form>
      {hasQuery ? (
        <div key={query} className="results-list single county-search-results" role="region" aria-label="County and state search results" tabIndex={0}>
          {results.map((item) =>
            item.type === "state" ? (
              <Link key={item.state.slug} to={stateHomePath(item.state)} className="result-link" onClick={onNavigate}>
                <span className="result-name">{item.state.name}</span>
                <span className="result-meta">State • {item.state.abbr}</span>
              </Link>
            ) : (
              <Link key={item.county.fips} to={countyPath(item.county)} className="result-link" onClick={onNavigate}>
                <span className="result-name">{item.county.displayName}</span>
                <span className="result-meta">County • {item.county.state.name}</span>
              </Link>
            ),
          )}
          {!results.length ? <p className="muted">No places match that search yet.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
