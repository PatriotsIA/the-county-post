import { Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { SubmissionForm } from "./components/SubmissionForm";
import { ClassifiedSubmissionForm } from "./components/ClassifiedSubmissionForm";
import { AdSlot } from "./components/AdSlot";
import { HardAssetsFeed } from "./components/HardAssetsFeed";
import { NewsFeedSection } from "./components/NewsFeedSection";
import { CountyEconomicData, CountyEconomicSnapshot } from "./components/CountyEconomicData";
import { CountyWeatherPage } from "./components/CountyWeather";
import { CountyDataSnapshot } from "./components/CountyDataSnapshot";
import { CountyShowUpMeter } from "./components/CountyShowUpMeter";
import { CountyPartnerDirectory, GlobalPartnerDirectory } from "./components/PartnerDirectory";
import { CountyLocalSourcesDirectory } from "./components/LocalSourcesDirectory";
import { DataCentersOpEdPage } from "./components/CountyPostOpEd";
import { AtlasDomainNav } from "./components/AtlasDomainNav";
import { atlasDomainLabels } from "./lib/atlas-domain-labels";
import { EditionMap } from "./components/EditionMap";
import { TopTicker } from "./components/TopTicker";
import { ads, countyAdKey, getSportsFeedSponsorId, isCarouselOnlyAd } from "./data/ads";
import { getCounty, getCountiesForState, searchCounties } from "./data/counties";
import { site } from "./data/site";
import { Seo } from "./components/Seo";
import {
  breadcrumbLd,
  collectionPageLd,
  countyClassifiedsSeo,
  countyCrumbs,
  countyDataSeo,
  countyAtlasDomainSeo,
  countyEconomicSeo,
  countyLabel,
  countyLocalSourcesSeo,
  countyOpEdsSeo,
  countyPartnersSeo,
  countyPlaceLd,
  countyWeatherSeo,
  crumbTrail,
  countySeo,
  countySubjectSeo,
  datasetLd,
  homeSeo,
  jsonLdGraph,
  organizationLd,
  stateDirectorySeo,
  stateSeo,
  stateSubjectSeo,
  submitSeo,
  topicSeo,
  webPageLd,
  webSiteLd,
} from "./lib/seo";
import {
  getSubjectGroup,
  getSubjectPage,
  legacySubjectGroups,
  subjectGroups,
  topicSections,
  type SubjectGroup,
  type TopicFeedKind,
} from "./data/subjects";
import { getStateBySlug, searchStates, states, type StateSite } from "./data/states";
import { buildCountyFallbackFeedUrls, buildNationalFallbackFeedUrls, buildStateFallbackFeedUrls } from "./lib/fallback-feed-urls";
import { countyAtlasDomains, type CountyAtlasDomain } from "./lib/county-atlas-api";
import { fetchNewsApiPage, isNewsApiConfigured, scopePlaces, type NewsFeedItem } from "./lib/news-api";
import countyPostLogo from "./assets/county-post-logo.png";
import "./index.css";

const LazyCountyDataAtlasHub = lazy(() =>
  import("./components/CountyDataAtlas").then((module) => ({ default: module.CountyDataAtlasHub })),
);
const LazyCountyAtlasDomainPage = lazy(() =>
  import("./components/CountyDataAtlas").then((module) => ({ default: module.CountyAtlasDomainPage })),
);

const pageLeadSections = ["general"] as const;
const pageBackgroundSections = ["sports", "obituaries", "politics", "economy", "crime", "opinion"] as const;
const countyLeadSections = ["localNews"] as const;
const countyBackgroundSections = ["localSports", "obituaries", "politics", "economy", "crime", "opinion"] as const;
const LEAD_PREFETCH_LIMIT = 32;
const COUNTY_LEAD_PREFETCH_LIMIT = 50;
const PAGE_PREFETCH_LIMIT = 96;

type NewsPageState = {
  status: "idle" | "loading" | "loaded" | "error";
  error: string;
  sections: Record<string, NewsFeedItem[]>;
  /** Towns the API scoped this county page to, passed on to each feed section. */
  places: string[];
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
  const [state, setState] = useState<NewsPageState>({ status: apiPath ? "loading" : "idle", error: "", sections: {}, places: [] });

  useEffect(() => {
    let cancelled = false;
    if (!apiPath) {
      setState({ status: "idle", error: "", sections: {}, places: [] });
      return;
    }
    if (!isNewsApiConfigured()) {
      setState({ status: "error", error: "News API is not configured. Set VITE_NEWS_API_URL.", sections: {}, places: [] });
      return;
    }

    setState({ status: "loading", error: "", sections: {}, places: [] });
    fetchNewsApiPage(apiPath, sectionsKey.split(",").filter(Boolean), limit)
      .then((page) => {
        if (cancelled) return;
        const nextSections = Object.fromEntries(
          Object.entries(page.sections || {}).map(([key, section]) => [key, section.items || []]),
        );
        setState({ status: "loaded", error: "", sections: nextSections, places: scopePlaces(page.scope) });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Unable to load news from the API.",
          sections: {},
          places: [],
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
    initialPlaces: page.places,
  };
}

function canLoadBackgroundPage(page: NewsPageState) {
  return page.status === "loaded" || page.status === "error";
}

function useSequentialFeedLoader(enabled: boolean, itemCount: number, resetKey: string) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [itemCount, resetKey]);

  const markSettled = useCallback(
    (index: number) => {
      if (!enabled) return;
      setActiveIndex((current) => (current === index ? Math.min(itemCount, current + 1) : current));
    },
    [enabled, itemCount],
  );

  const isEnabled = useCallback((index: number) => enabled && index <= activeIndex, [activeIndex, enabled]);

  return { isEnabled, markSettled };
}

function App() {
  const activeCounty = useActiveCounty();
  const activeState = useActiveState(activeCounty);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const { hash, pathname } = useLocation();
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

  useEffect(() => {
    if (hash !== "#find-a-county") return;
    requestAnimationFrame(() => document.getElementById("find-a-county")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [hash]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const updateScrollTopVisibility = () => setShowScrollTop(window.scrollY > 420);
    updateScrollTopVisibility();
    window.addEventListener("scroll", updateScrollTopVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollTopVisibility);
  }, []);

  const showEditionChrome = isEditionChromePath(pathname, activeCounty, activeState);
  const isHomeEdition = isEditionHomePath(pathname, activeCounty, activeState);

  return (
    <div className="page">
      <header className={`masthead${showEditionChrome ? " masthead-has-hero" : ""}${isHomeEdition ? " masthead-home" : ""}`}>
        <p className="masthead-kicker masthead-kicker-row">
          <span>Established 2026</span>
          <span>Today Is: {todayLabel}</span>
        </p>
        {showEditionChrome ? (
          <div className="masthead-stage">
            <MastheadWordmark />
            <MastheadHeroCopy pathname={pathname} county={activeCounty} state={activeState} />
            <EditionMap county={activeCounty} state={activeState} />
          </div>
        ) : (
          <MastheadWordmark />
        )}
        <button
          type="button"
          className="menu-toggle"
          aria-controls="primary-navigation"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">☰</span> Menu
        </button>
        <nav id="primary-navigation" className={`nav${mobileMenuOpen ? " nav-open" : ""}`} aria-label="Primary navigation">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")} onClick={() => setMobileMenuOpen(false)}>
          Front Page
        </NavLink>
        <NavLink
          to="/states"
          className={({ isActive }) => (isActive ? "nav-link nav-link-directory active" : "nav-link nav-link-directory")}
          onClick={() => setMobileMenuOpen(false)}
        >
          Find Your State & County News
        </NavLink>
        <NavLink to="/op-eds" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")} onClick={() => setMobileMenuOpen(false)}>
          Op-Eds
        </NavLink>
        <NavLink to="/partners" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")} onClick={() => setMobileMenuOpen(false)}>
          Partners
        </NavLink>
        <NavLink to="/about" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")} onClick={() => setMobileMenuOpen(false)}>
          About
        </NavLink>
        <NavLink
          to={submitStoryPath(activeCounty, activeState)}
          className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          onClick={() => setMobileMenuOpen(false)}
        >
          Submit A Story
        </NavLink>
        </nav>
      </header>
      <ContextNav county={activeCounty} state={activeState} />
      {activeCounty && isCountyDataPath(pathname, activeCounty) ? <AtlasDomainNav county={activeCounty} /> : null}
      {pathname === "/" ? (
        <div className="top-county-finder">
          <CountyDirectorySearch id="find-a-county" />
        </div>
      ) : null}
      <TopTicker county={activeCounty} defaultOpen={isEditionHomePath(pathname, activeCounty, activeState)} />
      <button
        type="button"
        className={`scroll-top${showScrollTop ? " scroll-top-visible" : ""}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Scroll to the top of the page"
      >
        <span aria-hidden="true">↑</span>
        <span>Top</span>
      </button>

      <Breadcrumbs county={activeCounty} state={activeState} />

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/topics/:subjectSlug" element={<NationalSubjectPage />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/states" element={<StateDirectory />} />
          <Route path="/states/:stateSlug/*" element={<LegacyStateRedirect />} />
          <Route path="/partners" element={<GlobalPartnerDirectory />} />
          <Route path="/op-eds/the-data-centers-and-the-rest-of-us" element={<DataCentersOpEdPage />} />
          <Route path="/op-eds" element={<OpEdPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/:stateSlug/:countySlug/weather" element={<CountyWeatherRoute />} />
          <Route path="/:stateSlug/:countySlug/data" element={<CountyDataAtlasPage />} />
          <Route path="/:stateSlug/:countySlug/data/:domain" element={<CountyDataAtlasDomainRoute />} />
          <Route path="/:stateSlug/:countySlug/economic-data" element={<CountyEconomicDataPage />} />
          <Route path="/:stateSlug/:countySlug/op-eds" element={<CountyOpEdPage />} />
          <Route path="/:stateSlug/:countySlug/partners" element={<CountyPartnersPage />} />
          <Route path="/:stateSlug/:countySlug/local-sources" element={<CountyLocalSourcesPage />} />
          <Route path="/:stateSlug/:countySlug/submit" element={<CountySubmitPage />} />
          <Route path="/:stateSlug/:countySlug/classifieds" element={<CountyClassifiedsPage />} />
          <Route path="/:stateSlug/:countySlug/:subjectSlug" element={<CountySubjectPage />} />
          <Route path="/:stateSlug/submit" element={<SubmitPage />} />
          <Route path="/:stateSlug/:countySlug" element={<CountyOrStateDesk />} />
          <Route path="/:stateSlug" element={<StatePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <AdSlot slot="banner" limit={4} />
      <footer className="footer">
        <img className="footer-logo" src={countyPostLogo} alt={site.name} />
        <p>
          {site.name} • County-by-county newswire • Contact the desk:{" "}
          <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
        </p>
        <div className="footer-links">
          <Link to="/partners">Partners</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </div>
      </footer>
    </div>
  );
}

function stateHomePath(state: { slug: string }) {
  return `/${state.slug}`;
}

function LegacyStateRedirect() {
  const { stateSlug, "*": rest } = useParams<{ stateSlug: string; "*": string }>();
  if (!stateSlug) return <Navigate to="/states" replace />;
  return <Navigate to={rest ? `/${stateSlug}/${rest}` : `/${stateSlug}`} replace />;
}

function CountyOrStateDesk() {
  const { stateSlug, countySlug } = useParams<{ stateSlug: string; countySlug: string }>();
  if (getCounty(stateSlug, countySlug)) return <CountyPage />;
  if (getStateBySlug(stateSlug)) return <StateSubjectPage />;
  return <NotFound />;
}

function useActiveCounty() {
  const { pathname } = useLocation();
  const [stateSlug, countySlug] = pathname.split("/").filter(Boolean);
  if (!stateSlug || !countySlug || stateSlug === "states") return undefined;
  return getCounty(stateSlug, countySlug);
}

function useActiveState(county?: ReturnType<typeof getCounty>) {
  const { pathname } = useLocation();
  if (county) return county.state;
  const [first, second] = pathname.split("/").filter(Boolean);
  const state = getStateBySlug(first);
  if (!state) return undefined;
  if (!second || !getCounty(first, second)) return state;
  return undefined;
}

/**
 * Visible breadcrumb trail: United States › Texas › Lubbock County › Weather.
 *
 * Rendered once in the page chrome rather than per route, from the same
 * `crumbTrail` builder that feeds BreadcrumbList JSON-LD, so what a reader sees
 * and what a crawler parses can never disagree. Hidden on the front page, where
 * the trail would be a single self-referencing crumb.
 */
function Breadcrumbs({ county, state }: { county?: ReturnType<typeof getCounty>; state?: ReturnType<typeof getStateBySlug> }) {
  const { pathname } = useLocation();
  const trail = crumbTrail(pathname, county, state);
  if (trail.length < 2) return null;

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {trail.map((crumb, index) =>
          index === trail.length - 1 ? (
            <li key={crumb.path}>
              <span aria-current="page">{crumb.name}</span>
            </li>
          ) : (
            <li key={crumb.path}>
              <Link to={crumb.path}>{crumb.name}</Link>
            </li>
          ),
        )}
      </ol>
    </nav>
  );
}

function ContextNav({ county, state }: { county?: NonNullable<ReturnType<typeof getCounty>>; state?: ReturnType<typeof getStateBySlug> }) {
  const links = contextLinks(county, state);
  if (!links.length) return null;

  const label = county ? `${county.displayName} pages` : state ? `${state.name} pages` : "National pages";

  return (
    <nav className="context-nav" aria-label={label}>
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => (isActive ? "context-link active" : "context-link")}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

type ContextLink = { to: string; label: string; end?: boolean };

function contextLinks(county?: NonNullable<ReturnType<typeof getCounty>>, state?: ReturnType<typeof getStateBySlug>): ContextLink[] {
  if (county) {
    const base = `/${county.state.slug}/${county.slug}`;
    return [
      { to: base, label: "County Home", end: true },
      { to: `${base}/weather`, label: "Weather" },
      { to: `${base}/data`, label: "County Data" },
      { to: `${base}/economic-data`, label: "Economic Data" },
      ...subjectGroups.map((group) => ({ to: `${base}/${group.slug}`, label: group.title })),
      { to: `${base}/op-eds`, label: "County Op-Eds" },
      { to: `${base}/local-sources`, label: "Local Sources" },
      { to: `${base}/partners`, label: "Partners" },
      { to: `${base}/classifieds`, label: "Classifieds" },
      { to: `${base}/submit`, label: "Submit A Story" },
    ];
  }

  if (state) {
    const base = stateHomePath(state);
    return [
      { to: base, label: "State Home", end: true },
      ...subjectGroups.map((group) => ({ to: `${base}/${group.slug}`, label: group.title })),
      { to: `${base}/op-eds`, label: "State Op-Eds" },
      { to: `${base}/submit`, label: "Submit A Story" },
    ];
  }

  return [
    { to: "/", label: "National Home", end: true },
    ...subjectGroups.map((group) => ({ to: `/topics/${group.slug}`, label: group.title })),
    { to: "/op-eds", label: "National Op-Eds" },
    { to: "/submit", label: "Submit A Story" },
  ];
}

function isCountyHomePath(pathname: string, county?: ReturnType<typeof getCounty>) {
  return Boolean(county && pathname === `/${county.state.slug}/${county.slug}`);
}

function isCountyDataPath(pathname: string, county?: ReturnType<typeof getCounty>) {
  if (!county) return false;
  const base = `/${county.state.slug}/${county.slug}/data`;
  return pathname === base || pathname.startsWith(`${base}/`);
}

function isEditionChromePath(
  pathname: string,
  county?: ReturnType<typeof getCounty>,
  state?: ReturnType<typeof getStateBySlug>,
) {
  if (county || state) return true;
  return pathname === "/" || pathname === "/states" || pathname === "/op-eds" || pathname === "/partners" || pathname === "/submit" || pathname.startsWith("/topics/");
}

function pathAfter(pathname: string, prefix: string) {
  if (pathname === prefix) return "";
  if (!pathname.startsWith(`${prefix}/`)) return "";
  return pathname.slice(prefix.length + 1);
}

function isEditionHomePath(
  pathname: string,
  county?: ReturnType<typeof getCounty>,
  state?: ReturnType<typeof getStateBySlug>,
) {
  if (pathname === "/") return true;
  if (isCountyHomePath(pathname, county)) return true;
  return Boolean(state && pathname === stateHomePath(state));
}

function submitStoryPath(county?: NonNullable<ReturnType<typeof getCounty>>, state?: ReturnType<typeof getStateBySlug>) {
  if (county) return `/${county.state.slug}/${county.slug}/submit`;
  if (state) return `${stateHomePath(state)}/submit`;
  return "/submit";
}

function CountyDirectorySearch({ id }: { id?: string }) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;
  const countyMatches = useMemo(() => (hasQuery ? searchCounties(query, 24) : []), [hasQuery, query]);
  const stateMatches = useMemo(() => (hasQuery ? searchStates(query, 15) : []), [hasQuery, query]);
  const bestCounty = countyMatches[0];
  const bestState = stateMatches[0];
  const results = [
    ...stateMatches.slice(0, 6).map((state) => ({ type: "state" as const, state })),
    ...countyMatches.slice(0, 10).map((county) => ({ type: "county" as const, county })),
  ];

  return (
    <section id={id} className="card county-finder">
      <header className="section-heading">
        <div className="section-heading-rule" aria-hidden />
        <div>
          <h2>Find A County</h2>
        </div>
        <div className="section-heading-rule" aria-hidden />
      </header>
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (bestCounty) {
            navigate(`/${bestCounty.state.slug}/${bestCounty.slug}`);
          } else if (bestState) {
            navigate(stateHomePath(bestState));
          }
        }}
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by county or state (e.g., Orange, TX)"
          aria-label="Search for a county or state"
        />
        <button type="submit" disabled={!hasQuery}>
          Search
        </button>
      </form>
      {hasQuery ? (
        <div className="results-list single">
          {results.map((item) =>
            item.type === "state" ? (
              <Link key={item.state.slug} to={stateHomePath(item.state)} className="result-link">
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
          {!results.length ? <p className="muted">No places match that search yet.</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function HomePage() {
  const nationalLeadPage = useNewsPage(nationalPageApiPath(), pageLeadSections, LEAD_PREFETCH_LIMIT);
  const loadNationalBackground = canLoadBackgroundPage(nationalLeadPage);
  const nationalBackgroundLoader = useSequentialFeedLoader(loadNationalBackground, pageBackgroundSections.length, "national");

  const seo = homeSeo();

  return (
    <div className="layout-grid">
      <Seo
        title={seo.title}
        description={seo.description}
        policy="home"
        jsonLd={jsonLdGraph(organizationLd(), webSiteLd())}
      />
      <h1 className="visually-hidden">The County Post — local news for every U.S. county</h1>
      <NewsFeedSection
        title="National briefing"
        kicker="Top of the hour"
        apiPath={nationalApiPath("general")}
        fallbackFeedUrls={buildNationalFallbackFeedUrls("general")}
        {...pageSectionProps(nationalLeadPage, "general")}
      />
      {topicSections.map((section, index) => (
        <Fragment key={section.kind}>
          <NewsFeedSection
            title={section.title}
            kicker={section.kicker}
            apiPath={nationalApiPath(section.kind)}
            fallbackFeedUrls={buildNationalFallbackFeedUrls(section.kind)}
            kind={section.kind}
            loadEnabled={nationalBackgroundLoader.isEnabled(index)}
            onLoadSettled={() => nationalBackgroundLoader.markSettled(index)}
          />
          {section.kind === "obituaries" ? <AdSlot slot="inline" /> : null}
        </Fragment>
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
            <Link key={state.slug} to={stateHomePath(state)} className="state-tile">
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
  const seo = stateDirectorySeo();

  return (
    <div className="layout-grid">
      <Seo
        title={seo.title}
        description={seo.description}
        policy="stateDirectory"
        jsonLd={jsonLdGraph(
          collectionPageLd({
            path: "/states",
            name: seo.title,
            description: seo.description,
            crumbs: [
              { name: "United States", path: "/" },
              { name: "States & Counties", path: "/states" },
            ],
          }),
        )}
      />
      <CountyDirectorySearch />
      <section className="card">
        <div className="state-grid">
          {states.map((state) => (
            <Link key={state.slug} to={stateHomePath(state)} className="state-tile">
              <span>{state.name}</span>
              <span className="state-meta">{state.abbr}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * A browsable, alphabetical index of every county desk in the state.
 *
 * A search box is not a crawl path — Googlebot cannot type into one — and before
 * this existed no `<a href>` anywhere on the site pointed at any of the 3,143
 * county desks. They were orphans, reachable only by a sitemap entry, which
 * Google treats as a hint about existence rather than a route to follow.
 * Rendering the full list keeps every county three clicks from the front page:
 * `/` -> `/states` -> `/:state` -> `/:state/:county`.
 */
function StateCountyIndex({ state }: { state: StateSite }) {
  const stateCounties = useMemo(
    () => [...getCountiesForState(state.slug)].sort((a, b) => a.name.localeCompare(b.name)),
    [state.slug],
  );

  if (!stateCounties.length) return null;

  return (
    <section className="card county-index">
      <header className="section-heading">
        <div className="section-heading-rule" aria-hidden />
        <div>
          <p className="kicker">Every county</p>
          <h2>
            All {stateCounties.length} {state.name} County Desks
          </h2>
        </div>
        <div className="section-heading-rule" aria-hidden />
      </header>
      <ul className="county-index-list">
        {stateCounties.map((county) => (
          <li key={county.fips}>
            <Link to={`/${county.state.slug}/${county.slug}`}>
              <span className="county-index-name">{county.displayName}</span>
              {county.primaryCity ? <span className="county-index-city">{county.primaryCity}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatePage() {
  const { stateSlug } = useParams<{ stateSlug: string }>();
  const state = getStateBySlug(stateSlug);
  const navigate = useNavigate();
  const [countyQuery, setCountyQuery] = useState("");
  const stateLeadPage = useNewsPage(state ? statePageApiPath(state.slug) : undefined, pageLeadSections, LEAD_PREFETCH_LIMIT);
  const loadStateBackground = canLoadBackgroundPage(stateLeadPage);
  const stateBackgroundLoader = useSequentialFeedLoader(loadStateBackground, pageBackgroundSections.length + 1, state?.slug || "");
  const counties = useMemo(() => (state ? getCountiesForState(state.slug) : []), [state]);
  const trimmedQuery = countyQuery.trim();
  const countyMatches = useMemo(() => {
    const normalized = trimmedQuery.toLowerCase();
    if (!normalized) return [];
    return counties.filter(
      (county) =>
        county.displayName.toLowerCase().includes(normalized) ||
        county.slug.includes(normalized) ||
        (county.primaryCity || "").toLowerCase().includes(normalized),
    ).slice(0, 12);
  }, [counties, trimmedQuery]);

  if (!state) {
    return <NotFound />;
  }

  const seo = stateSeo(state, counties.length);

  return (
    <div className="layout-grid">
      <Seo
        title={seo.title}
        description={seo.description}
        policy="state"
        jsonLd={jsonLdGraph(
          collectionPageLd({
            path: `/${state.slug}`,
            name: seo.title,
            description: seo.description,
            crumbs: [
              { name: "United States", path: "/" },
              { name: "States & Counties", path: "/states" },
              { name: state.name, path: `/${state.slug}` },
            ],
          }),
        )}
      />
      <section className="card county-finder">
        <header className="section-heading">
          <div className="section-heading-rule" aria-hidden />
          <div>
            <h2>Find A County</h2>
          </div>
          <div className="section-heading-rule" aria-hidden />
        </header>
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            const match = countyMatches[0];
            if (match) navigate(`/${match.state.slug}/${match.slug}`);
          }}
        >
          <input
            value={countyQuery}
            onChange={(event) => setCountyQuery(event.target.value)}
            placeholder={`Search ${state.name} counties`}
            aria-label={`Search ${state.name} counties`}
          />
          <button type="submit" disabled={!trimmedQuery}>
            Search
          </button>
        </form>
        {trimmedQuery ? (
          <div className="results-list single">
            {countyMatches.map((county) => (
              <Link key={county.fips} to={`/${county.state.slug}/${county.slug}`} className="result-link">
                <span className="result-name">{county.displayName}</span>
                <span className="result-meta">County • {state.name}</span>
              </Link>
            ))}
            {!countyMatches.length ? <p className="muted">No {state.name} counties match that search.</p> : null}
          </div>
        ) : null}
      </section>

      <StateCountyIndex state={state} />

      <NewsFeedSection
        title="State headlines"
        kicker="State desk"
        apiPath={stateApiPath(state.slug, "general")}
        fallbackFeedUrls={buildStateFallbackFeedUrls(state, "general")}
        {...pageSectionProps(stateLeadPage, "general")}
        locality={{ stateName: state.name, stateAbbr: state.abbr, strict: true }}
      />
      {topicSections.map((section, index) => (
        <Fragment key={section.kind}>
          <NewsFeedSection
            title={section.title}
            kicker={section.kicker}
            apiPath={stateApiPath(state.slug, section.kind)}
            fallbackFeedUrls={buildStateFallbackFeedUrls(state, section.kind)}
            kind={section.kind}
            locality={{ stateName: state.name, stateAbbr: state.abbr, strict: true }}
            loadEnabled={stateBackgroundLoader.isEnabled(index)}
            onLoadSettled={() => stateBackgroundLoader.markSettled(index)}
          />
          {section.kind === "obituaries" ? <AdSlot slot="inline" /> : null}
        </Fragment>
      ))}
      <NewsFeedSection
        title="National briefing"
        kicker="Context"
        apiPath={nationalApiPath("general")}
        fallbackFeedUrls={buildNationalFallbackFeedUrls("general")}
        sponsorId="amberwood-brush-inline"
        loadEnabled={stateBackgroundLoader.isEnabled(6)}
        onLoadSettled={() => stateBackgroundLoader.markSettled(6)}
      />
    </div>
  );
}

function NationalSubjectPage() {
  const { subjectSlug } = useParams<{ subjectSlug: string }>();
  const legacySubjectGroup = legacySubjectGroups[subjectSlug || ""];
  if (legacySubjectGroup) return <Navigate to={`/topics/${legacySubjectGroup}`} replace />;

  const group = getSubjectGroup(subjectSlug);
  if (group) return <NationalSubjectGroupPage group={group} />;

  const subject = getSubjectPage(subjectSlug);
  if (!subject) return <NotFound />;

  return (
    <div className="layout-grid">
      <Seo
        title={topicSeo(subject.title, subject.description).title}
        description={subject.description}
        policy="topic"
        jsonLd={jsonLdGraph(
          collectionPageLd({
            path: `/topics/${subject.slug}`,
            name: subject.title,
            description: subject.description,
            crumbs: [
              { name: "United States", path: "/" },
              { name: subject.categoryTitle, path: `/topics/${subject.categorySlug}` },
              { name: subject.title, path: `/topics/${subject.slug}` },
            ],
          }),
        )}
      />
      <NewsFeedSection
        title={`${subject.title} headlines`}
        kicker="National desk"
        apiPath={nationalApiPath(subject.kind)}
        fallbackFeedUrls={buildNationalFallbackFeedUrls(subject.kind)}
        pageSize={18}
        kind={subject.kind}
      />
    </div>
  );
}

function NationalSubjectGroupPage({ group }: { group: SubjectGroup }) {
  const loader = useSequentialFeedLoader(true, group.subjects.length, `national:${group.slug}`);

  return (
    <div className="layout-grid">
      <Seo
        title={group.title}
        description={group.description}
        policy="topic"
        jsonLd={jsonLdGraph(
          collectionPageLd({
            path: `/topics/${group.slug}`,
            name: group.title,
            description: group.description,
            crumbs: [
              { name: "United States", path: "/" },
              { name: group.title, path: `/topics/${group.slug}` },
            ],
          }),
        )}
      />
      {group.slug === "economy-markets" ? <HardAssetsFeed /> : null}
      {group.subjects.map((subject, index) => (
        <NewsFeedSection
          key={subject.slug}
          title={subject.title}
          kicker={subject.kicker}
          apiPath={nationalApiPath(subject.kind)}
          fallbackFeedUrls={buildNationalFallbackFeedUrls(subject.kind)}
          pageSize={14}
          kind={subject.kind}
          actionLink={{ to: `/topics/${subject.slug}`, label: "Open subcategory" }}
          loadEnabled={loader.isEnabled(index)}
          onLoadSettled={() => loader.markSettled(index)}
        />
      ))}
    </div>
  );
}

function StateSubjectPage() {
  const { stateSlug, subjectSlug, countySlug } = useParams<{ stateSlug: string; subjectSlug?: string; countySlug?: string }>();
  const deskSlug = subjectSlug || countySlug;
  const state = getStateBySlug(stateSlug);
  if (!state) return <NotFound />;

  const legacySubjectGroup = legacySubjectGroups[deskSlug || ""];
  if (legacySubjectGroup) return <Navigate to={`${stateHomePath(state)}/${legacySubjectGroup}`} replace />;

  const group = getSubjectGroup(deskSlug);
  if (group) return <StateSubjectGroupPage state={state} group={group} />;

  const subject =
    deskSlug === "op-eds"
      ? { kind: "opinion" as TopicFeedKind, title: "State Op-Eds", kicker: "Opinion", description: `Columns, editorials, and opinion coverage for ${state.name}.` }
      : getSubjectPage(deskSlug);
  if (!subject) return <NotFound />;

  const seo = stateSubjectSeo(state, subject.title, subject.description);

  return (
    <div className="layout-grid">
      <Seo
        title={seo.title}
        description={seo.description}
        policy="stateSubject"
        jsonLd={jsonLdGraph(
          collectionPageLd({
            path: `${stateHomePath(state)}/${deskSlug}`,
            name: seo.title,
            description: seo.description,
            crumbs: [
              { name: "United States", path: "/" },
              { name: state.name, path: stateHomePath(state) },
              { name: subject.title, path: `${stateHomePath(state)}/${deskSlug}` },
            ],
          }),
        )}
      />
      <NewsFeedSection
        title={`${state.name} ${subject.title}`}
        kicker="State desk"
        apiPath={stateApiPath(state.slug, subject.kind)}
        fallbackFeedUrls={buildStateFallbackFeedUrls(state, subject.kind)}
        pageSize={18}
        kind={subject.kind}
        locality={{ stateName: state.name, stateAbbr: state.abbr, strict: true }}
      />
    </div>
  );
}

function StateSubjectGroupPage({ state, group }: { state: NonNullable<ReturnType<typeof getStateBySlug>>; group: SubjectGroup }) {
  const loader = useSequentialFeedLoader(true, group.subjects.length, `${state.slug}:${group.slug}`);

  const seo = stateSubjectSeo(state, group.title, group.description);

  return (
    <div className="layout-grid">
      <Seo
        title={seo.title}
        description={seo.description}
        policy="stateSubject"
        jsonLd={jsonLdGraph(
          collectionPageLd({
            path: `${stateHomePath(state)}/${group.slug}`,
            name: seo.title,
            description: seo.description,
            crumbs: [
              { name: "United States", path: "/" },
              { name: state.name, path: stateHomePath(state) },
              { name: group.title, path: `${stateHomePath(state)}/${group.slug}` },
            ],
          }),
        )}
      />
      {group.slug === "economy-markets" ? <HardAssetsFeed /> : null}
      {group.subjects.map((subject, index) => (
        <NewsFeedSection
          key={subject.slug}
          title={`${state.name} ${subject.title}`}
          kicker={subject.kicker}
          apiPath={stateApiPath(state.slug, subject.kind)}
          fallbackFeedUrls={buildStateFallbackFeedUrls(state, subject.kind)}
          pageSize={14}
          kind={subject.kind}
          locality={{ stateName: state.name, stateAbbr: state.abbr, strict: true }}
          actionLink={{ to: `${stateHomePath(state)}/${subject.slug}`, label: "Open subcategory" }}
          loadEnabled={loader.isEnabled(index)}
          onLoadSettled={() => loader.markSettled(index)}
        />
      ))}
    </div>
  );
}

function CountyEconomicDataPage() {
  const { stateSlug, countySlug } = useParams<{ stateSlug: string; countySlug: string }>();
  const county = getCounty(stateSlug, countySlug);
  if (!county) return <NotFound />;

  const seo = countyEconomicSeo(county);
  return (
    <>
      <Seo
        title={seo.title}
        description={seo.description}
        policy="countyEconomicData"
        jsonLd={jsonLdGraph(
          datasetLd({
            path: `/${county.state.slug}/${county.slug}/economic-data`,
            name: `${countyLabel(county)} economic indicators`,
            description: seo.description,
            county,
            keywords: ["unemployment rate", "per capita personal income", "gross domestic product", county.displayName],
          }),
          breadcrumbLd(countyCrumbs(county, { name: "Economic Data", slug: "economic-data" })),
        )}
      />
      <CountyEconomicData county={county} />
    </>
  );
}

function CountyWeatherRoute() {
  const { stateSlug, countySlug } = useParams<{ stateSlug: string; countySlug: string }>();
  const county = getCounty(stateSlug, countySlug);
  if (!county) return <NotFound />;

  const seo = countyWeatherSeo(county);
  return (
    <>
      <Seo
        title={seo.title}
        description={seo.description}
        policy="countyWeather"
        jsonLd={jsonLdGraph(
          webPageLd({
            path: `/${county.state.slug}/${county.slug}/weather`,
            name: seo.title,
            description: seo.description,
          }),
          breadcrumbLd(countyCrumbs(county, { name: "Weather", slug: "weather" })),
        )}
      />
      <CountyWeatherPage county={county} />
    </>
  );
}

function CountyDataAtlasPage() {
  const { stateSlug, countySlug } = useParams<{ stateSlug: string; countySlug: string }>();
  const county = getCounty(stateSlug, countySlug);
  if (!county) return <NotFound />;

  const seo = countyDataSeo(county);
  return (
    <>
      <Seo
        title={seo.title}
        description={seo.description}
        policy="countyData"
        jsonLd={jsonLdGraph(
          datasetLd({
            path: `/${county.state.slug}/${county.slug}/data`,
            name: `${countyLabel(county)} County Data Atlas`,
            description: seo.description,
            county,
            keywords: Object.values(atlasDomainLabels),
          }),
          breadcrumbLd(countyCrumbs(county, { name: "County Data", slug: "data" })),
        )}
      />
      <Suspense fallback={<AtlasRouteLoading />}>
        <LazyCountyDataAtlasHub county={county} />
      </Suspense>
    </>
  );
}

function CountyDataAtlasDomainRoute() {
  const { stateSlug, countySlug, domain } = useParams<{
    stateSlug: string;
    countySlug: string;
    domain: string;
  }>();
  const county = getCounty(stateSlug, countySlug);
  if (!county || !isCountyAtlasDomain(domain)) return <NotFound />;

  const domainLabel = atlasDomainLabels[domain];
  const seo = countyAtlasDomainSeo(county, domainLabel);
  return (
    <>
      <Seo
        title={seo.title}
        description={seo.description}
        policy="countyAtlasDomain"
        jsonLd={jsonLdGraph(
          datasetLd({
            path: `/${county.state.slug}/${county.slug}/data/${domain}`,
            name: `${domainLabel} — ${countyLabel(county)}`,
            description: seo.description,
            county,
            keywords: [domainLabel, county.displayName, county.state.name],
          }),
          breadcrumbLd([
            ...countyCrumbs(county, { name: "County Data", slug: "data" }),
            { name: domainLabel, path: `/${county.state.slug}/${county.slug}/data/${domain}` },
          ]),
        )}
      />
      <Suspense fallback={<AtlasRouteLoading />}>
        <LazyCountyAtlasDomainPage county={county} domain={domain} />
      </Suspense>
    </>
  );
}

function AtlasRouteLoading() {
  return (
    <section className="card atlas-status" aria-live="polite">
      <p className="kicker">County Data Atlas</p>
      <h1>Opening the county data desk…</h1>
    </section>
  );
}

function CountyPage() {
  const { stateSlug, countySlug } = useParams<{ stateSlug: string; countySlug: string }>();
  const county = getCounty(stateSlug, countySlug);
  const countyLeadPage = useNewsPage(
    county ? countyPageApiPath(county.state.slug, county.slug) : undefined,
    countyLeadSections,
    COUNTY_LEAD_PREFETCH_LIMIT,
  );
  const loadCountyBackground = canLoadBackgroundPage(countyLeadPage);
  const countyBackgroundLoader = useSequentialFeedLoader(loadCountyBackground, countyBackgroundSections.length + 2, county?.fips || "");

  if (!county) {
    return <NotFound />;
  }

  const locality = {
    countyName: county.name,
    stateName: county.state.name,
    stateAbbr: county.state.abbr,
    strict: true,
  };
  const countyKey = countyAdKey(county.state.slug, county.slug);
  const sportsSponsorId = getSportsFeedSponsorId(countyKey);

  const seo = countySeo(county);

  return (
    <div className="layout-grid compact-county-stack">
      <Seo
        title={seo.title}
        description={seo.description}
        policy="county"
        jsonLd={jsonLdGraph(
          collectionPageLd({
            path: `/${county.state.slug}/${county.slug}`,
            name: `${countyLabel(county)} news`,
            description: seo.description,
            crumbs: countyCrumbs(county),
          }),
          countyPlaceLd(county),
        )}
      />
      <CountyDataSnapshot county={county} />

      <NewsFeedSection
        title="Local headlines"
        kicker="County desk"
        apiPath={countyApiPath(county.state.slug, county.slug, "general")}
        fallbackFeedUrls={buildCountyFallbackFeedUrls(county, "general")}
        {...pageSectionProps(countyLeadPage, "localNews")}
        pageSize={16}
        kind="general"
        locality={locality}
      />
      <NewsFeedSection
        title="Local sports"
        kicker="Scores & highlights"
        apiPath={countyApiPath(county.state.slug, county.slug, "sports")}
        fallbackFeedUrls={buildCountyFallbackFeedUrls(county, "sports")}
        pageSize={12}
        kind="sports"
        sponsorId={sportsSponsorId}
        locality={locality}
        loadEnabled={countyBackgroundLoader.isEnabled(0)}
        onLoadSettled={() => countyBackgroundLoader.markSettled(0)}
      />
      <NewsFeedSection
        title="Obituaries & public notices"
        kicker="Community records"
        apiPath={countyApiPath(county.state.slug, county.slug, "obituaries")}
        fallbackFeedUrls={buildCountyFallbackFeedUrls(county, "obituaries")}
        pageSize={12}
        kind="obituaries"
        locality={locality}
        loadEnabled={countyBackgroundLoader.isEnabled(1)}
        onLoadSettled={() => countyBackgroundLoader.markSettled(1)}
      />
      <CountyShowUpMeter county={county} />
      <NewsFeedSection
        title="Politics"
        kicker="Civic desk"
        apiPath={countyApiPath(county.state.slug, county.slug, "politics")}
        fallbackFeedUrls={buildCountyFallbackFeedUrls(county, "politics")}
        pageSize={12}
        kind="politics"
        locality={locality}
        actionLink={{ to: `/${county.state.slug}/${county.slug}/data/civic-elections`, label: "View county civic data" }}
        loadEnabled={countyBackgroundLoader.isEnabled(2)}
        onLoadSettled={() => countyBackgroundLoader.markSettled(2)}
      />
      <NewsFeedSection
        title="Economy & business"
        kicker="Markets"
        apiPath={countyApiPath(county.state.slug, county.slug, "economy")}
        fallbackFeedUrls={buildCountyFallbackFeedUrls(county, "economy")}
        pageSize={12}
        kind="economy"
        locality={locality}
        actionLink={{ to: `/${county.state.slug}/${county.slug}/data/economy`, label: "View county economic data" }}
        loadEnabled={countyBackgroundLoader.isEnabled(3)}
        onLoadSettled={() => countyBackgroundLoader.markSettled(3)}
      />
      <NewsFeedSection
        title="Crime & courts"
        kicker="Public safety"
        apiPath={countyApiPath(county.state.slug, county.slug, "crime")}
        fallbackFeedUrls={buildCountyFallbackFeedUrls(county, "crime")}
        pageSize={12}
        kind="crime"
        locality={locality}
        actionLink={{ to: `/${county.state.slug}/${county.slug}/data/public-safety`, label: "View county safety data" }}
        loadEnabled={countyBackgroundLoader.isEnabled(4)}
        onLoadSettled={() => countyBackgroundLoader.markSettled(4)}
      />
      <AdSlot slot="inline" countyKey={countyKey} />
      <NewsFeedSection
        title="Opinion & op-eds"
        kicker="Local voices"
        apiPath={countyApiPath(county.state.slug, county.slug, "opinion")}
        fallbackFeedUrls={buildCountyFallbackFeedUrls(county, "opinion")}
        kind="opinion"
        locality={locality}
        loadEnabled={countyBackgroundLoader.isEnabled(5)}
        onLoadSettled={() => countyBackgroundLoader.markSettled(5)}
      />
      <NewsFeedSection
        title={`${county.state.name} headlines`}
        kicker="State desk"
        apiPath={stateApiPath(county.state.slug, "general")}
        fallbackFeedUrls={buildStateFallbackFeedUrls(county.state, "general")}
        pageSize={12}
        locality={{ stateName: county.state.name, stateAbbr: county.state.abbr, cities: [], strict: true }}
        actionLink={{ to: stateHomePath(county.state), label: `View ${county.state.name} page` }}
        loadEnabled={countyBackgroundLoader.isEnabled(6)}
        onLoadSettled={() => countyBackgroundLoader.markSettled(6)}
      />
      <NewsFeedSection
        title="National briefing"
        kicker="Context"
        apiPath={nationalApiPath("general")}
        fallbackFeedUrls={buildNationalFallbackFeedUrls("general")}
        pageSize={12}
        sponsorId="amberwood-brush-inline"
        actionLink={{ to: "/", label: "View national page" }}
        loadEnabled={countyBackgroundLoader.isEnabled(7)}
        onLoadSettled={() => countyBackgroundLoader.markSettled(7)}
      />

      <SubmissionForm county={county} />

      <Link to={`/${county.state.slug}/${county.slug}/op-eds`} className="button-link">
        View county op-eds
      </Link>
      <Link to={`/${county.state.slug}/${county.slug}/partners`} className="button-link">
        View county partners
      </Link>
      <Link to={`/${county.state.slug}/${county.slug}/local-sources`} className="button-link">
        View local news sources
      </Link>
    </div>
  );
}

function MastheadWordmark() {
  return (
    <Link to="/" className="wordmark">
      <img className="wordmark-logo" src={countyPostLogo} alt={`${site.name} — Every county. Every community. One nation.`} />
      <span className="wordmark-tagline">Every County - Every Community. One Nation</span>
    </Link>
  );
}

function MastheadHeroText({
  kicker,
  title,
  lead,
  muted,
  className,
  children,
}: {
  kicker: string;
  title: ReactNode;
  lead: string;
  muted?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={className ? `masthead-hero ${className}` : "masthead-hero"}>
      <p className="kicker">{kicker}</p>
      <h1>{title}</h1>
      <p className="lead">{lead}</p>
      {muted ? <p className="muted">{muted}</p> : null}
      {children}
    </section>
  );
}

function MastheadHeroCopy({
  pathname,
  county,
  state,
}: {
  pathname: string;
  county?: ReturnType<typeof getCounty>;
  state?: ReturnType<typeof getStateBySlug>;
}) {
  if (county) {
    const rest = pathAfter(pathname, `/${county.state.slug}/${county.slug}`);
    if (!rest) {
      return (
        <MastheadHeroText
          className="county-edition-hero"
          kicker="Local Edition"
          title={county.pageName}
          lead={county.description}
        >
          <div className="county-edition-hero-copy">
            <div className="meta-grid">
              <div>
                <p className="meta-label">Local focus</p>
                <p className="meta-value">County stories only</p>
              </div>
              <div>
                <p className="meta-label">National lens</p>
                <p className="meta-value">Every source. One place.</p>
              </div>
              <div>
                <p className="meta-label">County Sponsored By:</p>
                <CountySponsor county={county} />
              </div>
            </div>
          </div>
        </MastheadHeroText>
      );
    }

    if (rest === "weather") {
      return (
        <MastheadHeroText
          kicker="National Weather Service desk"
          title={
            <>
              {county.displayName} Weather <span className="muted">({county.state.abbr})</span>
            </>
          }
          lead={`Current conditions, active alerts, and the local National Weather Service forecast for ${county.state.name}.`}
        />
      );
    }

    if (rest === "data" || rest.startsWith("data/")) {
      const domainSlug = rest.slice("data/".length);
      const domain = isCountyAtlasDomain(domainSlug) ? domainSlug : undefined;
      return (
        <MastheadHeroText
          kicker="County Data Atlas"
          title={
            <>
              {county.displayName} {domain ? atlasDomainLabels[domain] : "Data Atlas"}{" "}
              <span className="muted">({county.state.abbr})</span>
            </>
          }
          lead={
            domain
              ? "County measures with provenance, vintages, coverage notes, and comparisons."
              : "A concise, sourced view of county people, economy, housing, public life, health, safety, land, government, and infrastructure."
          }
        />
      );
    }

    if (rest === "economic-data") {
      return (
        <MastheadHeroText
          kicker="County economy · Federal Reserve data"
          title={
            <>
              {county.displayName} Economic Data <span className="muted">({county.state.abbr})</span>
            </>
          }
          lead="A nonpartisan county economic profile using official series distributed by FRED, including employment, household income, personal income, and county production."
        />
      );
    }

    if (rest === "op-eds") {
      return (
        <MastheadHeroText
          kicker="Opinion"
          title={
            <>
              Op-eds for {county.displayName} <span className="muted">({county.state.abbr})</span>
            </>
          }
          lead="Local columns, editorials, and letters to the editor."
        />
      );
    }

    if (rest === "partners") {
      return (
        <MastheadHeroText
          kicker="Advertiser directory"
          title={
            <>
              {county.displayName} Partners <span className="muted">({county.state.abbr})</span>
            </>
          }
          lead="Local and sitewide partners supporting The County Post in this community."
        />
      );
    }

    if (rest === "local-sources") {
      return (
        <MastheadHeroText
          kicker="Local media directory"
          title={
            <>
              {county.displayName} Local Sources <span className="muted">({county.state.abbr})</span>
            </>
          }
          lead="Reviewed newspapers, radio stations, television stations, and digital newsrooms serving this county."
        />
      );
    }

    if (rest === "submit") {
      return (
        <MastheadHeroText
          kicker="Submit"
          title={
            <>
              Submit A Story to {county.displayName} <span className="muted">({county.state.abbr})</span>
            </>
          }
          lead="Send op-eds, story leads, documents, public notices, and local reporting to the county desk."
        />
      );
    }

    if (rest === "classifieds") {
      return (
        <MastheadHeroText
          kicker="County classifieds"
          title={
            <>
              {county.displayName} Classifieds <span className="muted">({county.state.abbr})</span>
            </>
          }
          lead="Buy, sell, hire, announce, and connect with your local community."
        />
      );
    }

    const countyDesk = getSubjectGroup(rest) || getSubjectPage(rest);
    if (countyDesk) {
      return (
        <MastheadHeroText
          kicker={countyDesk.kicker}
          title={
            <>
              {county.displayName} {countyDesk.title} <span className="muted">({county.state.abbr})</span>
            </>
          }
          lead={countyDesk.description}
        />
      );
    }

    return (
      <MastheadHeroText
        kicker="Local Edition"
        title={county.pageName}
        lead={county.description}
      />
    );
  }

  if (state) {
    const rest = pathAfter(pathname, stateHomePath(state));
    if (!rest) {
      return (
        <MastheadHeroText
          kicker="State Edition"
          title={
            <>
              {state.name} <span className="muted">({state.abbr})</span>
            </>
          }
          lead="State-level desk with top headlines, politics, and regional context. Jump straight to any county edition below."
        >
          <div className="meta-grid">
            <div>
              <p className="meta-label">National lens</p>
              <p className="meta-value">Every source. One place.</p>
            </div>
            <div>
              <p className="meta-label">Counties covered</p>
              <p className="meta-value">{getCountiesForState(state.slug).length}</p>
            </div>
          </div>
        </MastheadHeroText>
      );
    }

    if (rest === "submit") {
      return (
        <MastheadHeroText
          kicker="Submit"
          title={
            <>
              Submit A Story <span className="muted">({state.abbr})</span>
            </>
          }
          lead={`Send op-eds, story leads, documents, public notices, and reporting to the ${state.name} desk.`}
        />
      );
    }

    const stateDesk =
      rest === "op-eds"
        ? { kicker: "Opinion", title: "State Op-Eds", description: `Columns, editorials, and opinion coverage for ${state.name}.` }
        : getSubjectGroup(rest) || getSubjectPage(rest);
    if (stateDesk) {
      return (
        <MastheadHeroText
          kicker={stateDesk.kicker}
          title={
            <>
              {state.name} {stateDesk.title} <span className="muted">({state.abbr})</span>
            </>
          }
          lead={stateDesk.description}
        />
      );
    }

    return (
      <MastheadHeroText
        kicker="State Edition"
        title={
          <>
            {state.name} <span className="muted">({state.abbr})</span>
          </>
        }
        lead="State-level desk with top headlines, politics, and regional context."
      />
    );
  }

  if (pathname === "/states") {
    return (
      <MastheadHeroText
        kicker="Directory"
        title="Find Your State & County News"
        lead="Search every U.S. county and state, or browse the complete state directory below."
      />
    );
  }

  if (pathname === "/op-eds") {
    return (
      <MastheadHeroText
        kicker="Opinion"
        title="National Op-Ed Desk"
        lead="Columns and analysis across the United States."
      />
    );
  }

  if (pathname === "/partners") {
    return (
      <MastheadHeroText
        kicker="Advertiser directory"
        title="Our Partners"
        lead="Businesses and organizations supporting The County Post across every edition."
      />
    );
  }

  if (pathname === "/submit") {
    return (
      <MastheadHeroText
        kicker="Submit"
        title="Submit A Story"
        lead="Send op-eds, story leads, documents, public notices, and reporting to the national desk."
      />
    );
  }

  if (pathname.startsWith("/topics/")) {
    const slug = pathAfter(pathname, "/topics");
    const desk = getSubjectGroup(slug) || getSubjectPage(slug);
    if (desk) {
      return <MastheadHeroText kicker={desk.kicker} title={desk.title} lead={desk.description} />;
    }
  }

  return (
    <MastheadHeroText
      kicker="Front Page"
      title="The County Post"
      lead="National desk with top stories across the United States. Browse every U.S. county to see local headlines, sports scores, obituaries, and state-level context pulled straight from live news wires."
      muted="Find your county below, or explore all states. Every county page includes a newsroom submission form for reader reporting, op-eds, and public notices."
    />
  );
}

function CountySponsor({ county }: { county: NonNullable<ReturnType<typeof getCounty>> }) {
  const sponsorAds = ads.filter((ad) => ad.slot === "inline" && ad.id !== "guerrilla-gear-inline" && !isCarouselOnlyAd(ad.id));
  const seed = county.fips || `${county.state.slug}/${county.slug}`;
  const hash = Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0);
  const sponsor = sponsorAds[hash % sponsorAds.length];
  if (!sponsor) return null;

  return (
    <a className="county-sponsor" href={sponsor.href} target="_blank" rel="noreferrer sponsored">
      <img src={sponsor.image} alt={sponsor.alt} />
    </a>
  );
}

function CountySubjectPage() {
  const { stateSlug, countySlug, subjectSlug } = useParams<{ stateSlug: string; countySlug: string; subjectSlug: string }>();
  const county = getCounty(stateSlug, countySlug);
  if (!county) return <NotFound />;

  const legacySubjectGroup = legacySubjectGroups[subjectSlug || ""];
  if (legacySubjectGroup) return <Navigate to={`/${county.state.slug}/${county.slug}/${legacySubjectGroup}`} replace />;

  const group = getSubjectGroup(subjectSlug);
  if (group) return <CountySubjectGroupPage county={county} group={group} />;

  const subject = getSubjectPage(subjectSlug);
  if (!subject) return <NotFound />;

  const seo = countySubjectSeo(county, subject.title, subject.description);

  return (
    <div className="layout-grid">
      <Seo
        title={seo.title}
        description={seo.description}
        policy="countySubject"
        jsonLd={jsonLdGraph(
          breadcrumbLd([
            ...countyCrumbs(county),
            { name: subject.title, path: `/${county.state.slug}/${county.slug}/${subject.slug}` },
          ]),
        )}
      />
      <NewsFeedSection
        title={`${county.displayName} ${subject.title}`}
        kicker="County desk"
        apiPath={countyApiPath(county.state.slug, county.slug, subject.kind)}
        fallbackFeedUrls={buildCountyFallbackFeedUrls(county, subject.kind)}
        pageSize={18}
        kind={subject.kind}
        locality={{
          countyName: county.name,
          stateName: county.state.name,
          stateAbbr: county.state.abbr,
          strict: true,
        }}
        actionLink={
          atlasDomainForTopic(subject.kind)
            ? {
                to: `/${county.state.slug}/${county.slug}/data/${atlasDomainForTopic(subject.kind)}`,
                label: `View related county data`,
              }
            : undefined
        }
      />
    </div>
  );
}

function CountySubjectGroupPage({ county, group }: { county: NonNullable<ReturnType<typeof getCounty>>; group: SubjectGroup }) {
  const loader = useSequentialFeedLoader(true, group.subjects.length, `${county.fips || county.slug}:${group.slug}`);

  const seo = countySubjectSeo(county, group.title, group.description);

  return (
    <div className="layout-grid">
      <Seo
        title={seo.title}
        description={seo.description}
        policy="countySubject"
        jsonLd={jsonLdGraph(
          breadcrumbLd([
            ...countyCrumbs(county),
            { name: group.title, path: `/${county.state.slug}/${county.slug}/${group.slug}` },
          ]),
        )}
      />
      {group.slug === "elections-transparency" ? <CountyShowUpMeter county={county} /> : null}
      {atlasDomainForGroup(group.slug) ? (
        <aside className="atlas-desk-link">
          <span>Reporting context</span>
          <Link to={`/${county.state.slug}/${county.slug}/data/${atlasDomainForGroup(group.slug)}`}>
            Open related county data
          </Link>
        </aside>
      ) : null}
      {group.slug === "economy-markets" ? <CountyEconomicSnapshot county={county} /> : null}
      {group.slug === "economy-markets" ? <HardAssetsFeed /> : null}
      {group.subjects.map((subject, index) => (
        <NewsFeedSection
          key={subject.slug}
          title={`${county.displayName} ${subject.title}`}
          kicker={subject.kicker}
          apiPath={countyApiPath(county.state.slug, county.slug, subject.kind)}
          fallbackFeedUrls={buildCountyFallbackFeedUrls(county, subject.kind)}
          pageSize={14}
          kind={subject.kind}
          locality={{
            countyName: county.name,
            stateName: county.state.name,
            stateAbbr: county.state.abbr,
            strict: true,
          }}
          actionLink={{ to: `/${county.state.slug}/${county.slug}/${subject.slug}`, label: "Open subcategory" }}
          loadEnabled={loader.isEnabled(index)}
          onLoadSettled={() => loader.markSettled(index)}
        />
      ))}
    </div>
  );
}

function CountyPartnersPage() {
  const { stateSlug, countySlug } = useParams<{ stateSlug: string; countySlug: string }>();
  const county = getCounty(stateSlug, countySlug);
  if (!county) return <NotFound />;

  const seo = countyPartnersSeo(county);
  return (
    <>
      <Seo
        title={seo.title}
        description={seo.description}
        policy="countyPartners"
        jsonLd={jsonLdGraph(breadcrumbLd(countyCrumbs(county, { name: "Partners", slug: "partners" })))}
      />
      <CountyPartnerDirectory county={county} />
    </>
  );
}

function CountyLocalSourcesPage() {
  const { stateSlug, countySlug } = useParams<{ stateSlug: string; countySlug: string }>();
  const county = getCounty(stateSlug, countySlug);
  if (!county) return <NotFound />;

  const seo = countyLocalSourcesSeo(county);
  return (
    <>
      <Seo
        title={seo.title}
        description={seo.description}
        policy="countyLocalSources"
        jsonLd={jsonLdGraph(
          collectionPageLd({
            path: `/${county.state.slug}/${county.slug}/local-sources`,
            name: seo.title,
            description: seo.description,
            crumbs: countyCrumbs(county, { name: "Local Sources", slug: "local-sources" }),
          }),
        )}
      />
      <CountyLocalSourcesDirectory county={county} />
    </>
  );
}

function CountyOpEdPage() {
  const { stateSlug, countySlug } = useParams<{ stateSlug: string; countySlug: string }>();
  const county = getCounty(stateSlug, countySlug);

  if (!county) {
    return <NotFound />;
  }

  const seo = countyOpEdsSeo(county);

  return (
    <div className="layout-grid">
      <Seo
        title={seo.title}
        description={seo.description}
        policy="countyOpEds"
        jsonLd={jsonLdGraph(breadcrumbLd(countyCrumbs(county, { name: "Op-Eds", slug: "op-eds" })))}
      />
      <NewsFeedSection
        title="Local opinion"
        kicker="County op-eds"
        apiPath={countyApiPath(county.state.slug, county.slug, "opinion")}
        fallbackFeedUrls={buildCountyFallbackFeedUrls(county, "opinion")}
        pageSize={16}
        kind="opinion"
        locality={{
          countyName: county.name,
          stateName: county.state.name,
          stateAbbr: county.state.abbr,
          strict: true,
        }}
      />
    </div>
  );
}

function CountySubmitPage() {
  const { stateSlug, countySlug } = useParams<{ stateSlug: string; countySlug: string }>();
  const county = getCounty(stateSlug, countySlug);
  if (!county) return <NotFound />;

  const seo = submitSeo(countyLabel(county));

  return (
    <div className="layout-grid">
      <Seo title={seo.title} description={seo.description} policy="countySubmit" />
      <SubmissionForm county={county} />
    </div>
  );
}

function CountyClassifiedsPage() {
  const { stateSlug, countySlug } = useParams<{ stateSlug: string; countySlug: string }>();
  const county = getCounty(stateSlug, countySlug);
  if (!county) return <NotFound />;

  const seo = countyClassifiedsSeo(county);

  return (
    <div className="layout-grid">
      <Seo title={seo.title} description={seo.description} policy="classifieds" />
      <ClassifiedSubmissionForm county={county} />
    </div>
  );
}

function OpEdPage() {
  return (
    <div className="layout-grid">
      <Seo
        title="Opinion & Op-Eds"
        description="Columns, editorials, and analysis from The County Post and opinion desks across the country."
        policy="editorial"
        jsonLd={jsonLdGraph(
          collectionPageLd({
            path: "/op-eds",
            name: "Opinion & Op-Eds",
            description: "Columns, editorials, and analysis from The County Post and opinion desks across the country.",
            crumbs: [
              { name: "United States", path: "/" },
              { name: "Op-Eds", path: "/op-eds" },
            ],
          }),
        )}
      />
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

function SubmitPage() {
  const { stateSlug } = useParams<{ stateSlug?: string }>();
  const state = getStateBySlug(stateSlug);
  if (stateSlug && !state) return <NotFound />;

  const seo = submitSeo(state?.name);

  return (
    <div className="layout-grid">
      <Seo title={seo.title} description={seo.description} policy="submit" />
      <SubmissionForm state={state} />
    </div>
  );
}

function isCountyAtlasDomain(value?: string): value is CountyAtlasDomain {
  return Boolean(value && (countyAtlasDomains as readonly string[]).includes(value));
}

function atlasDomainForTopic(topic: TopicFeedKind): CountyAtlasDomain | undefined {
  const domainByTopic: Partial<Record<TopicFeedKind, CountyAtlasDomain>> = {
    economy: "economy",
    "monetary-policy": "economy",
    "markets-investing": "economy",
    "jobs-business": "jobs-business",
    crime: "public-safety",
    politics: "civic-elections",
    "voting-systems": "civic-elections",
    "election-administration": "civic-elections",
    "audits-recounts": "civic-elections",
    "open-records": "civic-elections",
    "property-taxes": "government-finance",
    "municipal-bonds": "government-finance",
    "budgets-levies": "government-finance",
  };
  return domainByTopic[topic];
}

function atlasDomainForGroup(groupSlug: string): CountyAtlasDomain | undefined {
  if (groupSlug === "economy-markets") return "economy";
  if (groupSlug === "taxes-public-finance") return "government-finance";
  if (groupSlug === "elections-transparency") return "civic-elections";
  return undefined;
}

function AboutPage() {
  return (
    <div className="layout-grid">
      <Seo
        title="About The County Post"
        description="How The County Post works: a local news discovery platform that aggregates and credits county-level reporting from local publishers, alongside its own original community journalism."
        policy="editorial"
        jsonLd={jsonLdGraph(
          organizationLd(),
          webPageLd({
            path: "/about",
            name: "About The County Post",
            description: "How The County Post works, who publishes it, and how to reach the editors.",
            crumbs: [
              { name: "United States", path: "/" },
              { name: "About", path: "/about" },
            ],
          }),
        )}
      />
      <section className="hero-card">
        <p className="kicker">About</p>
        <h1>The County Post</h1>
        <p className="lead">County-by-county newswire built for context, speed, and transparency.</p>
        <p className="muted">
          We aggregate local headlines, sports, obituaries, op-eds, and national briefs so every county has a single front page.
          Reader submissions reach editors for review.
        </p>
      </section>
    </div>
  );
}

function PrivacyPage() {
  return (
    <div className="layout-grid">
      <Seo
        title="Privacy Policy"
        description="How The County Post handles reader data, analytics, and information submitted through its story and classified forms."
        policy="legal"
      />
      <section className="hero-card">
        <p className="kicker">Privacy</p>
        <h1>Privacy Policy</h1>
        <p className="lead">
          The County Post collects the minimum information needed to operate a county news desk and to understand how
          readers use it. By continuing to use this site, you consent to the practices described below.
        </p>
      </section>

      <section className="card legal-copy">
        <h2>Analytics</h2>
        <p>
          We use Google Analytics to measure how the site is used. Google Analytics sets cookies and collects usage
          information including the pages you view, the approximate geographic region derived from your IP address, your
          device and browser type, and the site that referred you. We use this information in aggregate to understand
          which county desks readers rely on and where coverage should improve. By using this site, you consent to this
          collection.
        </p>
        <p>
          You may opt out at any time by installing the{" "}
          <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noreferrer">
            Google Analytics Opt-out Browser Add-on
          </a>
          , by blocking cookies in your browser, or by using a browser or extension that blocks analytics scripts. The
          site remains fully functional if you do.
        </p>

        <h2>Reader submissions</h2>
        <p>
          When you send a story, op-ed, obituary, public notice, or classified listing, the information you enter in the
          form — including your name, email address, and the details of your submission — is transmitted to our editors
          through EmailJS, a third-party delivery service. We use it to review your submission and to contact you about
          it. We do not add submitters to a mailing list without their request, and we do not sell reader information to
          anyone.
        </p>

        <h2>Third-party content</h2>
        <p>
          Some pages embed content served by other companies, which may set their own cookies and receive your IP
          address when that content loads. These are the market tickers supplied by TradingView and LiveCoinWatch,
          video embedded from YouTube using its privacy-enhanced no-cookie domain, and, when our own news service is
          unavailable, a fallback article loader operated by rss2json. Headlines throughout the site link to the
          publishers who reported them; once you follow a link, that publisher&rsquo;s own privacy policy governs.
        </p>

        <h2>What we do not do</h2>
        <p>
          We do not sell or rent reader data. We do not run behavioral advertising or third-party ad networks;
          the sponsorships on this site are served directly by us and do not track you across other websites. We do not
          attempt to identify individual readers from analytics data.
        </p>

        <h2>Questions</h2>
        <p>
          Write to <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a> with any question about this policy
          or any request regarding information you have sent us.
        </p>
      </section>
    </div>
  );
}

function TermsPage() {
  return (
    <div className="layout-grid">
      <Seo
        title="Terms of Service"
        description="Terms covering use of The County Post, aggregated third-party headlines, and reader submissions."
        policy="legal"
      />
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
      <Seo
        title="Page Not Found"
        description="That page is not part of The County Post. Return to the front page or find your county desk."
        policy="notFound"
      />
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
