import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { SubmissionForm } from "./components/SubmissionForm";
import { NewsFeedSection } from "./components/NewsFeedSection";
import { TopTicker } from "./components/TopTicker";
import { getCounty, getCountiesForState, getCountyMarketCities, getCountyMarketCity, searchCounties } from "./data/counties";
import { site } from "./data/site";
import { getStateBySlug, searchStates, states } from "./data/states";
import { buildCountyFallbackFeedUrls, buildNationalFallbackFeedUrls, buildStateFallbackFeedUrls } from "./lib/fallback-feed-urls";
import { fetchNewsApiPage, isNewsApiConfigured, type NewsFeedItem } from "./lib/news-api";
import "./index.css";

type TopicFeedKind = "general" | "sports" | "politics" | "economy" | "crime" | "obituaries" | "opinion";

const topicSections: { kind: TopicFeedKind; title: string; kicker: string }[] = [
  { kind: "sports", title: "Sports", kicker: "Scores & highlights" },
  { kind: "politics", title: "Politics", kicker: "Civic desk" },
  { kind: "economy", title: "Economy & business", kicker: "Markets" },
  { kind: "crime", title: "Crime & courts", kicker: "Public safety" },
  { kind: "obituaries", title: "Obituaries & public notices", kicker: "Community records" },
  { kind: "opinion", title: "Opinion & op-eds", kicker: "Columns & analysis" },
];

const pageTopicSections = ["general", ...topicSections.map((section) => section.kind)] as const;
const countyPageSections = ["localNews", "localSports", "politics", "economy", "crime", "obituaries", "opinion"] as const;
const PAGE_PREFETCH_LIMIT = 96;

type NewsPageState = {
  status: "idle" | "loading" | "loaded" | "error";
  error: string;
  sections: Record<string, NewsFeedItem[]>;
};

function nationalApiPath(kind: TopicFeedKind) {
  return `/v1/feeds/national/${kind}`;
}

function stateApiPath(stateSlug: string, kind: TopicFeedKind) {
  return `/v1/feeds/states/${stateSlug}/${kind}`;
}

function countyApiPath(stateSlug: string, countySlug: string, kind: TopicFeedKind) {
  return `/v1/feeds/counties/${stateSlug}/${countySlug}/${kind}`;
}

function nationalPageApiPath() {
  return "/v1/pages/national";
}

function statePageApiPath(stateSlug: string) {
  return `/v1/pages/states/${stateSlug}`;
}

function countyPageApiPath(stateSlug: string, countySlug: string) {
  return `/v1/pages/counties/${stateSlug}/${countySlug}`;
}

function useNewsPage(apiPath: string | undefined, sections: readonly string[], limit = PAGE_PREFETCH_LIMIT): NewsPageState {
  const sectionsKey = sections.join(",");
  const [state, setState] = useState<NewsPageState>({ status: apiPath ? "loading" : "idle", error: "", sections: {} });

  useEffect(() => {
    let cancelled = false;
    if (!apiPath) {
      setState({ status: "idle", error: "", sections: {} });
      return;
    }
    if (!isNewsApiConfigured()) {
      setState({ status: "error", error: "News API is not configured. Set VITE_NEWS_API_URL.", sections: {} });
      return;
    }

    setState({ status: "loading", error: "", sections: {} });
    fetchNewsApiPage(apiPath, sectionsKey.split(",").filter(Boolean), limit)
      .then((page) => {
        if (cancelled) return;
        const nextSections = Object.fromEntries(
          Object.entries(page.sections || {}).map(([key, section]) => [key, section.items || []]),
        );
        setState({ status: "loaded", error: "", sections: nextSections });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Unable to load news from the API.",
          sections: {},
        });
      });

    return () => {
      cancelled = true;
    };
  }, [apiPath, limit, sectionsKey]);

  return state;
}

function pageSectionProps(page: NewsPageState, section: string) {
  return {
    initialError: page.error,
    initialItems: page.status === "loaded" ? page.sections[section] || [] : undefined,
    initialStatus: page.status,
    initialSource: page.status === "loaded" ? ("api" as const) : undefined,
  };
}

function App() {
  const activeCounty = useActiveCounty();
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  return (
    <div className="page">
      <TopTicker county={activeCounty} />
      <header className="masthead">
        <div>
          <p className="masthead-kicker masthead-kicker-row">
            <span>Established 2026</span>
            <span>Today Is: {todayLabel}</span>
          </p>
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
          <NavLink to="/op-eds" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Op-Eds
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            About
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
          <Route path="/op-eds" element={<OpEdPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/:stateSlug/:countySlug" element={<CountyPage />} />
          <Route path="/:stateSlug/:countySlug/op-eds" element={<CountyOpEdPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <footer className="footer">
        <p>
          {site.name} • County-by-county newswire • Contact the desk:{" "}
          <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
        </p>
        <div className="footer-links">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </div>
      </footer>
    </div>
  );
}

function useActiveCounty() {
  const { pathname } = useLocation();
  const [stateSlug, countySlug] = pathname.split("/").filter(Boolean);
  if (!stateSlug || !countySlug || stateSlug === "states") return undefined;
  return getCounty(stateSlug, countySlug);
}

function HomePage() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const nationalPage = useNewsPage(nationalPageApiPath(), pageTopicSections);
  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;
  const matches = useMemo(() => (hasQuery ? searchCounties(query, 24) : []), [hasQuery, query]);
  const stateMatches = useMemo(() => (hasQuery ? searchStates(query, 15) : []), [hasQuery, query]);

  const bestCounty = matches[0];
  const bestState = stateMatches[0];
  const combinedResults = [...stateMatches.slice(0, 6).map((s) => ({ type: "state" as const, state: s })), ...matches.slice(0, 10).map((c) => ({ type: "county" as const, county: c }))];

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
            if (!hasQuery) return;
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
        {hasQuery ? (
          <div className="results-list single">
            {combinedResults.map((item) =>
              item.type === "state" ? (
                <Link key={item.state.slug} to={`/states/${item.state.slug}`} className="result-link">
                  <span className="result-name">{item.state.name}</span>
                  <span className="result-meta">State • {item.state.abbr}</span>
                </Link>
              ) : (
                <Link key={item.county.fips} to={`/${item.county.state.slug}/${item.county.slug}`} className="result-link">
                  <span className="result-name">{item.county.displayName}</span>
                  <span className="result-meta">County • {item.county.state.name}</span>
                </Link>
              ),
            )}
            {!combinedResults.length ? <p className="muted">No places match that search yet.</p> : null}
          </div>
        ) : null}
      </section>

      <NewsFeedSection
        title="National briefing"
        kicker="Top of the hour"
        apiPath={nationalApiPath("general")}
        fallbackFeedUrls={buildNationalFallbackFeedUrls("general")}
        {...pageSectionProps(nationalPage, "general")}
      />
      {topicSections.map((section) => (
        <NewsFeedSection
          key={section.kind}
          title={section.title}
          kicker={section.kicker}
          apiPath={nationalApiPath(section.kind)}
          fallbackFeedUrls={buildNationalFallbackFeedUrls(section.kind)}
          {...pageSectionProps(nationalPage, section.kind)}
          kind={section.kind}
        />
      ))}

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
        <p className="lead">Browse all states, then jump into the county editions from each state page.</p>
      </section>
      <section className="card">
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

function StatePage() {
  const { stateSlug } = useParams<{ stateSlug: string }>();
  const state = getStateBySlug(stateSlug);
  const [countyQuery, setCountyQuery] = useState("");
  const statePage = useNewsPage(state ? statePageApiPath(state.slug) : undefined, pageTopicSections);
  const counties = useMemo(() => (state ? getCountiesForState(state.slug) : []), [state]);
  const filteredCounties = useMemo(() => {
    const normalized = countyQuery.trim().toLowerCase();
    if (!normalized) return counties;
    return counties.filter(
      (county) =>
        county.displayName.toLowerCase().includes(normalized) ||
        county.slug.includes(normalized) ||
        (county.primaryCity || "").toLowerCase().includes(normalized),
    );
  }, [counties, countyQuery]);

  if (!state) {
    return <NotFound />;
  }

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

      <section className="card">
        <header className="section-heading">
          <div className="section-heading-rule" aria-hidden />
          <div>
            <p className="kicker">Counties</p>
            <h2>Local editions</h2>
          </div>
          <div className="section-heading-rule" aria-hidden />
        </header>
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <input
            value={countyQuery}
            onChange={(event) => setCountyQuery(event.target.value)}
            placeholder="Filter counties in this state (name or city)"
            aria-label="Filter counties in this state"
          />
          <button type="submit">Filter</button>
        </form>
        <div className="state-counties">
          {filteredCounties.map((county) => (
            <Link key={county.fips} to={`/${state.slug}/${county.slug}`} className="county-chip">
              {county.displayName}
            </Link>
          ))}
          {!filteredCounties.length ? <p className="muted">No counties match that filter.</p> : null}
        </div>
      </section>

      <NewsFeedSection
        title="State headlines"
        kicker="State desk"
        apiPath={stateApiPath(state.slug, "general")}
        fallbackFeedUrls={buildStateFallbackFeedUrls(state, "general")}
        {...pageSectionProps(statePage, "general")}
        locality={{ stateName: state.name, stateAbbr: state.abbr, strict: true }}
      />
      {topicSections.map((section) => (
        <NewsFeedSection
          key={section.kind}
          title={section.title}
          kicker={section.kicker}
          apiPath={stateApiPath(state.slug, section.kind)}
          fallbackFeedUrls={buildStateFallbackFeedUrls(state, section.kind)}
          {...pageSectionProps(statePage, section.kind)}
          kind={section.kind}
          locality={{ stateName: state.name, stateAbbr: state.abbr, strict: true }}
        />
      ))}
      <NewsFeedSection
        title="National briefing"
        kicker="Context"
        apiPath={nationalApiPath("general")}
        fallbackFeedUrls={buildNationalFallbackFeedUrls("general")}
      />
    </div>
  );
}

function CountyPage() {
  const { stateSlug, countySlug } = useParams<{ stateSlug: string; countySlug: string }>();
  const county = getCounty(stateSlug, countySlug);
  const countyPage = useNewsPage(county ? countyPageApiPath(county.state.slug, county.slug) : undefined, countyPageSections);

  if (!county) {
    return <NotFound />;
  }

  const marketCities = getCountyMarketCities(county, 3);
  const fallbackCity = marketCities[0] || getCountyMarketCity(county);
  const localCities = Array.from(new Set([fallbackCity, ...marketCities.slice(1), ...(county.localCities || [])]));
  const expandedLabel = localCities.length > 1 ? `nearby markets including ${localCities.join(" and ")}` : `${fallbackCity}, ${county.state.abbr}`;
  const locality = {
    countyName: county.name,
    stateName: county.state.name,
    stateAbbr: county.state.abbr,
    cities: localCities,
    strict: true,
  };

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
        apiPath={countyApiPath(county.state.slug, county.slug, "general")}
        fallbackFeedUrls={buildCountyFallbackFeedUrls(county, "general")}
        {...pageSectionProps(countyPage, "localNews")}
        expandedLabel={expandedLabel}
        pageSize={16}
        kind="general"
        locality={locality}
      />
      <NewsFeedSection
        title="Local sports"
        kicker="Scores & highlights"
        apiPath={countyApiPath(county.state.slug, county.slug, "sports")}
        fallbackFeedUrls={buildCountyFallbackFeedUrls(county, "sports")}
        {...pageSectionProps(countyPage, "localSports")}
        expandedLabel={expandedLabel}
        pageSize={12}
        kind="sports"
        locality={locality}
      />
      <NewsFeedSection
        title="Politics"
        kicker="Civic desk"
        apiPath={countyApiPath(county.state.slug, county.slug, "politics")}
        fallbackFeedUrls={buildCountyFallbackFeedUrls(county, "politics")}
        {...pageSectionProps(countyPage, "politics")}
        expandedLabel={expandedLabel}
        pageSize={12}
        kind="politics"
        locality={locality}
      />
      <NewsFeedSection
        title="Economy & business"
        kicker="Markets"
        apiPath={countyApiPath(county.state.slug, county.slug, "economy")}
        fallbackFeedUrls={buildCountyFallbackFeedUrls(county, "economy")}
        {...pageSectionProps(countyPage, "economy")}
        expandedLabel={expandedLabel}
        pageSize={12}
        kind="economy"
        locality={locality}
      />
      <NewsFeedSection
        title="Crime & courts"
        kicker="Public safety"
        apiPath={countyApiPath(county.state.slug, county.slug, "crime")}
        fallbackFeedUrls={buildCountyFallbackFeedUrls(county, "crime")}
        {...pageSectionProps(countyPage, "crime")}
        expandedLabel={expandedLabel}
        pageSize={12}
        kind="crime"
        locality={locality}
      />
      <NewsFeedSection
        title="Obituaries & public notices"
        kicker="Community records"
        apiPath={countyApiPath(county.state.slug, county.slug, "obituaries")}
        fallbackFeedUrls={buildCountyFallbackFeedUrls(county, "obituaries")}
        {...pageSectionProps(countyPage, "obituaries")}
        expandedLabel={expandedLabel}
        pageSize={12}
        kind="obituaries"
        locality={locality}
      />
      <NewsFeedSection
        title="Opinion & op-eds"
        kicker="Local voices"
        apiPath={countyApiPath(county.state.slug, county.slug, "opinion")}
        fallbackFeedUrls={buildCountyFallbackFeedUrls(county, "opinion")}
        {...pageSectionProps(countyPage, "opinion")}
        expandedLabel={expandedLabel}
        kind="opinion"
        locality={locality}
      />
      <NewsFeedSection
        title={`${county.state.name} headlines`}
        kicker="State desk"
        apiPath={stateApiPath(county.state.slug, "general")}
        fallbackFeedUrls={buildStateFallbackFeedUrls(county.state, "general")}
        pageSize={12}
        locality={{ stateName: county.state.name, stateAbbr: county.state.abbr, cities: [], strict: true }}
        actionLink={{ to: `/states/${county.state.slug}`, label: `View ${county.state.name} page` }}
      />
      <NewsFeedSection
        title="National briefing"
        kicker="Context"
        apiPath={nationalApiPath("general")}
        fallbackFeedUrls={buildNationalFallbackFeedUrls("general")}
        pageSize={12}
        actionLink={{ to: "/", label: "View national page" }}
      />

      <SubmissionForm county={county} />

      <Link to={`/${county.state.slug}/${county.slug}/op-eds`} className="button-link">
        View county op-eds
      </Link>
    </div>
  );
}

function CountyOpEdPage() {
  const { stateSlug, countySlug } = useParams<{ stateSlug: string; countySlug: string }>();
  const county = getCounty(stateSlug, countySlug);

  if (!county) {
    return <NotFound />;
  }

  const marketCities = getCountyMarketCities(county, 3);
  const fallbackCity = marketCities[0] || getCountyMarketCity(county);
  const localCities = Array.from(new Set([fallbackCity, ...marketCities.slice(1), ...(county.localCities || [])]));

  return (
    <div className="layout-grid">
      <section className="hero-card">
        <p className="kicker">Opinion</p>
        <h1>
          Op-eds for {county.displayName} <span className="muted">({county.state.abbr})</span>
        </h1>
        <p className="lead">Local columns, editorials, and letters to the editor.</p>
      </section>
      <NewsFeedSection
        title="Local opinion"
        kicker="County op-eds"
        apiPath={countyApiPath(county.state.slug, county.slug, "opinion")}
        fallbackFeedUrls={buildCountyFallbackFeedUrls(county, "opinion")}
        expandedLabel={`nearby markets including ${localCities.join(" and ")}`}
        pageSize={16}
        kind="opinion"
        locality={{
          countyName: county.name,
          stateName: county.state.name,
          stateAbbr: county.state.abbr,
          cities: localCities,
          strict: true,
        }}
      />
    </div>
  );
}

function OpEdPage() {
  return (
    <div className="layout-grid">
      <section className="hero-card">
        <p className="kicker">Opinion</p>
        <h1>National Op-Ed Desk</h1>
        <p className="lead">Columns and analysis across the United States.</p>
      </section>
      <NewsFeedSection
        title="National opinion"
        kicker="Columns & analysis"
        apiPath={nationalApiPath("opinion")}
        fallbackFeedUrls={buildNationalFallbackFeedUrls("opinion")}
        pageSize={18}
        kind="opinion"
      />
    </div>
  );
}

function AboutPage() {
  return (
    <div className="layout-grid">
      <section className="hero-card">
        <p className="kicker">About</p>
        <h1>The County Post</h1>
        <p className="lead">County-by-county newswire built for context, speed, and transparency.</p>
        <p className="muted">
          We aggregate local headlines, sports, obituaries, op-eds, and national briefs so every county has a single front page.
          Reader submissions flow through EmailJS to reach editors quickly.
        </p>
      </section>
    </div>
  );
}

function PrivacyPage() {
  return (
    <div className="layout-grid">
      <section className="hero-card">
        <p className="kicker">Privacy</p>
        <h1>Privacy Policy</h1>
        <p className="lead">We use the County Post News API for news aggregation and EmailJS for submissions. No behavioral tracking or ad tech.</p>
      </section>
    </div>
  );
}

function TermsPage() {
  return (
    <div className="layout-grid">
      <section className="hero-card">
        <p className="kicker">Terms</p>
        <h1>Terms of Service</h1>
        <p className="lead">Content is aggregated through the County Post News API. Links open to original publishers. Submissions are subject to editorial review.</p>
      </section>
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
