import { useMemo, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { SubmissionForm } from "./components/SubmissionForm";
import { NewsFeedSection } from "./components/NewsFeedSection";
import { getCounty, getCountiesForState, searchCounties } from "./data/counties";
import { site } from "./data/site";
import { getStateBySlug, searchStates, states } from "./data/states";
import { buildMarketFeedUrl } from "./lib/county-feed-urls";
import { buildStateFeedUrl } from "./lib/state-feed-urls";
import "./index.css";

function App() {
  return (
    <div className="page">
      <header className="masthead">
        <div>
          <p className="masthead-kicker">Established 2026</p>
          <Link to="/" className="wordmark">
            <span className="wordmark-main">{site.name}</span>
            <span className="wordmark-sub">{site.tagline}</span>
          </Link>
        </div>
        <nav className="nav">
          <NavLink to="/" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Front Page
          </NavLink>
          <NavLink to="/states" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            States & Counties
          </NavLink>
          <a className="nav-link" href="mailto:submissions@thecountypost.com">
            Submit Tips
          </a>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/states" element={<StateDirectory />} />
          <Route path="/states/:stateSlug" element={<StatePage />} />
          <Route path="/:stateSlug/:countySlug" element={<CountyPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <footer className="footer">
        <p>
          {site.name} • County-by-county newswire • Contact the desk:{" "}
          <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
        </p>
      </footer>
    </div>
  );
}

function HomePage() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const matches = useMemo(() => searchCounties(query, 24), [query]);
  const stateMatches = useMemo(() => searchStates(query, 15), [query]);

  const bestCounty = matches[0];
  const bestState = stateMatches[0];

  return (
    <div className="layout-grid">
      <section className="hero-card">
        <p className="kicker">Front Page</p>
        <h1>The County Post</h1>
        <p className="lead">
          National desk with top stories across the United States. Browse every U.S. county to see local headlines,
          sports scores, obituaries, and state-level context pulled straight from live news wires.
        </p>
        <p className="muted">
          Find your county below, or explore all states. Every county page includes a newsroom submission form powered by
          EmailJS for reader reporting, op-eds, and public notices.
        </p>
      </section>

      <NewsFeedSection title="National briefing" kicker="Top of the hour" feedUrl={site.links.nationalNews} />

      <section className="card">
        <header className="section-heading">
          <div className="section-heading-rule" aria-hidden />
          <div>
            <p className="kicker">Find a county</p>
            <h2>Search the map</h2>
          </div>
          <div className="section-heading-rule" aria-hidden />
        </header>
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!query.trim()) return;
            if (bestCounty) {
              navigate(`/${bestCounty.state.slug}/${bestCounty.slug}`);
              return;
            }
            if (bestState) {
              navigate(`/states/${bestState.slug}`);
            }
          }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by county or state (e.g., Orange, TX)"
            aria-label="Search for a county or state"
          />
          <button type="submit">Go</button>
        </form>
        <div className="results-columns">
          <div className="result-group">
            <p className="kicker">States</p>
            <div className="results-list">
              {stateMatches.map((state) => (
                <Link key={state.slug} to={`/states/${state.slug}`} className="result-link">
                  <span className="result-name">{state.name}</span>
                  <span className="result-meta">{state.abbr}</span>
                </Link>
              ))}
              {!stateMatches.length ? <p className="muted">No states match that search yet.</p> : null}
            </div>
          </div>
          <div className="result-group">
            <p className="kicker">Counties</p>
            <div className="results-list">
              {matches.map((county) => (
                <Link key={county.fips} to={`/${county.state.slug}/${county.slug}`} className="result-link">
                  <span className="result-name">{county.displayName}</span>
                  <span className="result-meta">{county.state.name}</span>
                </Link>
              ))}
              {!matches.length ? <p className="muted">No counties match that search yet.</p> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <header className="section-heading">
          <div className="section-heading-rule" aria-hidden />
          <div>
            <p className="kicker">Browse</p>
            <h2>States directory</h2>
          </div>
          <div className="section-heading-rule" aria-hidden />
        </header>
        <div className="state-grid">
          {states.map((state) => (
            <Link key={state.slug} to={`/states/${state.slug}`} className="state-tile">
              <span>{state.name}</span>
              <span className="state-meta">{state.abbr}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function StateDirectory() {
  return (
    <div className="layout-grid">
      <section className="hero-card">
        <p className="kicker">Directory</p>
        <h1>States & Counties</h1>
        <p className="lead">Every U.S. county is covered with live feeds and a submission desk.</p>
      </section>
      {states.map((state) => (
        <section key={state.slug} id={state.slug} className="card">
          <header className="section-heading">
            <div className="section-heading-rule" aria-hidden />
            <div>
              <p className="kicker">State</p>
              <h2>
                {state.name} ({state.abbr})
              </h2>
            </div>
            <div className="section-heading-rule" aria-hidden />
          </header>
          <div className="state-counties">
            {getCountiesForState(state.slug).map((county) => (
              <Link key={county.fips} to={`/${state.slug}/${county.slug}`} className="county-chip">
                {county.displayName}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function StatePage() {
  const { stateSlug } = useParams<{ stateSlug: string }>();
  const state = getStateBySlug(stateSlug);

  if (!state) {
    return <NotFound />;
  }

  const counties = getCountiesForState(state.slug);

  return (
    <div className="layout-grid">
      <section className="hero-card">
        <p className="kicker">State Edition</p>
        <h1>
          {state.name} <span className="muted">({state.abbr})</span>
        </h1>
        <p className="lead">
          State-level desk with top headlines, politics, and regional context. Jump straight to any county edition below.
        </p>
        <div className="meta-grid">
          <div>
            <p className="meta-label">National lens</p>
            <p className="meta-value">Balanced, non-partisan aggregation</p>
          </div>
          <div>
            <p className="meta-label">Counties covered</p>
            <p className="meta-value">{counties.length}</p>
          </div>
        </div>
      </section>

      <NewsFeedSection title="State headlines" kicker="State desk" feedUrl={buildStateFeedUrl(state)} />
      <NewsFeedSection title="National briefing" kicker="Context" feedUrl={site.links.nationalNews} />

      <section className="card">
        <header className="section-heading">
          <div className="section-heading-rule" aria-hidden />
          <div>
            <p className="kicker">Counties</p>
            <h2>Local editions</h2>
          </div>
          <div className="section-heading-rule" aria-hidden />
        </header>
        <div className="state-counties">
          {counties.map((county) => (
            <Link key={county.fips} to={`/${state.slug}/${county.slug}`} className="county-chip">
              {county.displayName}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function CountyPage() {
  const { stateSlug, countySlug } = useParams<{ stateSlug: string; countySlug: string }>();
  const county = getCounty(stateSlug, countySlug);

  if (!county) {
    return <NotFound />;
  }

  const fallbackCity = county.primaryCity || county.name;

  return (
    <div className="layout-grid">
      <section className="hero-card">
        <p className="kicker">Local Edition</p>
        <h1>
          {county.displayName} <span className="muted">({county.state.abbr})</span>
        </h1>
        <p className="lead">{county.description}</p>
        <p className="muted">
          Live feeds refresh on page load. The submission desk below uses EmailJS to route reader tips and op-eds directly
          to editors.
        </p>
        <div className="meta-grid">
          <div>
            <p className="meta-label">Primary market</p>
            <p className="meta-value">{fallbackCity}, {county.state.abbr}</p>
          </div>
          <div>
            <p className="meta-label">FIPS</p>
            <p className="meta-value">{county.fips}</p>
          </div>
          <div>
            <p className="meta-label">National lens</p>
            <p className="meta-value">Balanced, non-partisan aggregation</p>
          </div>
        </div>
      </section>

      <NewsFeedSection
        title="Local headlines"
        kicker="County desk"
        feedUrl={county.feeds.localNewsUrl}
        fallbackUrl={buildMarketFeedUrl("localNews", fallbackCity, county.state)}
      />
      <NewsFeedSection
        title="Local sports"
        kicker="Scores & highlights"
        feedUrl={county.feeds.localSportsUrl}
        fallbackUrl={buildMarketFeedUrl("localSports", fallbackCity, county.state)}
      />
      <NewsFeedSection
        title="Obituaries & public notices"
        kicker="Community records"
        feedUrl={county.feeds.obituariesUrl}
        fallbackUrl={buildMarketFeedUrl("obituaries", fallbackCity, county.state)}
      />
      <NewsFeedSection title="National briefing" kicker="Context" feedUrl={county.feeds.nationalNewsUrl} />

      <SubmissionForm county={county} />
    </div>
  );
}

function NotFound() {
  return (
    <section className="hero-card">
      <p className="kicker">404</p>
      <h1>We could not find that page.</h1>
      <p className="lead">Try returning to the front page or searching for your county.</p>
      <Link to="/" className="button-link">
        Return to the front page
      </Link>
    </section>
  );
}

export default App;
