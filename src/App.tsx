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
import { AtlasDomainNav } from "./components/AtlasDomainNav";
import { atlasDomainLabels } from "./lib/atlas-domain-labels";
import { EditionMap } from "./components/EditionMap";
import { TopTicker } from "./components/TopTicker";
import { ads, countyAdKey, getSportsFeedSponsorId, isCarouselOnlyAd } from "./data/ads";
import { getCounty, getCountiesForState, searchCounties } from "./data/counties";
import { site } from "./data/site";
import { getStateBySlug, searchStates, states } from "./data/states";
import { buildCountyFallbackFeedUrls, buildNationalFallbackFeedUrls, buildStateFallbackFeedUrls } from "./lib/fallback-feed-urls";
import { countyAtlasDomains, type CountyAtlasDomain } from "./lib/county-atlas-api";
import { fetchNewsApiPage, isNewsApiConfigured, type NewsFeedItem, type Topic } from "./lib/news-api";
import countyPostLogo from "../county-post-logo.png";
import "./index.css";

const LazyCountyDataAtlasHub = lazy(() =>
  import("./components/CountyDataAtlas").then((module) => ({ default: module.CountyDataAtlasHub })),
);
const LazyCountyAtlasDomainPage = lazy(() =>
  import("./components/CountyDataAtlas").then((module) => ({ default: module.CountyAtlasDomainPage })),
);

type TopicFeedKind = Topic;
type SubjectPageBase = { kind: TopicFeedKind; slug: string; title: string; kicker: string; description: string };
type SubjectGroup = { slug: string; title: string; kicker: string; description: string; subjects: SubjectPageBase[] };
type SubjectPage = SubjectPageBase & { categorySlug: string; categoryTitle: string };

const topicSections: { kind: TopicFeedKind; title: string; kicker: string }[] = [
  { kind: "sports", title: "Sports", kicker: "Scores & highlights" },
  { kind: "obituaries", title: "Obituaries & public notices", kicker: "Community records" },
  { kind: "politics", title: "Politics", kicker: "Civic desk" },
  { kind: "economy", title: "Economy & business", kicker: "Markets" },
  { kind: "crime", title: "Crime & courts", kicker: "Public safety" },
  { kind: "opinion", title: "Opinion & op-eds", kicker: "Columns & analysis" },
];

const subjectGroups: SubjectGroup[] = [
  {
    slug: "economy-markets",
    title: "Economy & Markets",
    kicker: "Markets desk",
    description: "Coverage of money, markets, jobs, local business, and the economic forces shaping county life.",
    subjects: [
      {
        kind: "monetary-policy",
        slug: "monetary-policy",
        title: "Monetary Policy",
        kicker: "Money desk",
        description: "Coverage of inflation, interest rates, the Federal Reserve, currency policy, and local economic impacts.",
      },
      {
        kind: "markets-investing",
        slug: "markets-investing",
        title: "Markets & Investing",
        kicker: "Market watch",
        description: "Coverage of commodities, stocks, bonds, investing, and market moves that matter outside Wall Street.",
      },
      {
        kind: "jobs-business",
        slug: "jobs-business",
        title: "Jobs & Business",
        kicker: "Business desk",
        description: "Coverage of employers, small businesses, hiring, industry, and local economic development.",
      },
    ],
  },
  {
    slug: "taxes-public-finance",
    title: "Taxes & Public Finance",
    kicker: "Public finance",
    description: "Coverage of taxes, public budgets, bonds, levies, school finance, and local government spending.",
    subjects: [
      {
        kind: "property-taxes",
        slug: "property-taxes",
        title: "Property Taxes",
        kicker: "Tax desk",
        description: "Coverage of property taxes, appraisals, assessments, tax levies, and homestead exemptions.",
      },
      {
        kind: "municipal-bonds",
        slug: "municipal-bonds",
        title: "Municipal Bonds",
        kicker: "Public debt",
        description: "Coverage of municipal bonds, school bonds, bond elections, public debt, and borrowing proposals.",
      },
      {
        kind: "budgets-levies",
        slug: "budgets-levies",
        title: "Budgets & Levies",
        kicker: "Budget desk",
        description: "Coverage of county, city, and school budgets, tax rates, levies, and public finance decisions.",
      },
    ],
  },
  {
    slug: "elections-transparency",
    title: "Elections & Transparency",
    kicker: "Civic records",
    description: "Coverage of elections, public records, open government, audits, recounts, and election administration.",
    subjects: [
      {
        kind: "voting-systems",
        slug: "voting-systems",
        title: "Voting Systems",
        kicker: "Election systems",
        description: "Coverage of voting equipment, ballot processing, certification, and election technology.",
      },
      {
        kind: "election-administration",
        slug: "election-administration",
        title: "Election Administration",
        kicker: "Election desk",
        description: "Coverage of election offices, polling places, voter registration, ballot access, and election calendars.",
      },
      {
        kind: "audits-recounts",
        slug: "audits-recounts",
        title: "Audits & Recounts",
        kicker: "Results desk",
        description: "Coverage of election audits, recounts, canvassing, post-election reviews, and certification disputes.",
      },
      {
        kind: "open-records",
        slug: "open-records",
        title: "Open Records",
        kicker: "Transparency desk",
        description: "Coverage of public records, FOIA requests, open meetings, and government transparency.",
      },
    ],
  },
];

const subjectPages: SubjectPage[] = subjectGroups.flatMap((group) =>
  group.subjects.map((subject) => ({
    ...subject,
    categorySlug: group.slug,
    categoryTitle: group.title,
  })),
);

const legacySubjectGroups: Record<string, SubjectGroup["slug"]> = {
  "sound-money": "economy-markets",
  "paper-elections": "elections-transparency",
  "bond-issues": "taxes-public-finance",
};

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

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/topics/:subjectSlug" element={<NationalSubjectPage />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/states" element={<StateDirectory />} />
          <Route path="/states/:stateSlug/*" element={<LegacyStateRedirect />} />
          <Route path="/partners" element={<GlobalPartnerDirectory />} />
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

  return (
    <div className="layout-grid">
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
  return (
    <div className="layout-grid">
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

  return (
    <div className="layout-grid">
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

  return (
    <div className="layout-grid">
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

  return (
    <div className="layout-grid">
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
  return <CountyEconomicData county={county} />;
}

function CountyWeatherRoute() {
  const { stateSlug, countySlug } = useParams<{ stateSlug: string; countySlug: string }>();
  const county = getCounty(stateSlug, countySlug);
  if (!county) return <NotFound />;
  return <CountyWeatherPage county={county} />;
}

function CountyDataAtlasPage() {
  const { stateSlug, countySlug } = useParams<{ stateSlug: string; countySlug: string }>();
  const county = getCounty(stateSlug, countySlug);
  if (!county) return <NotFound />;
  return (
    <Suspense fallback={<AtlasRouteLoading />}>
      <LazyCountyDataAtlasHub county={county} />
    </Suspense>
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
  return (
    <Suspense fallback={<AtlasRouteLoading />}>
      <LazyCountyAtlasDomainPage county={county} domain={domain} />
    </Suspense>
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

  return (
    <div className="layout-grid compact-county-stack">
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
          title={
            <>
              {county.displayName} <span className="muted">({county.state.abbr})</span>
            </>
          }
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
        title={
          <>
            {county.displayName} <span className="muted">({county.state.abbr})</span>
          </>
        }
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

  return (
    <div className="layout-grid">
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

  return (
    <div className="layout-grid">
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

  return <CountyPartnerDirectory county={county} />;
}

function CountyLocalSourcesPage() {
  const { stateSlug, countySlug } = useParams<{ stateSlug: string; countySlug: string }>();
  const county = getCounty(stateSlug, countySlug);
  if (!county) return <NotFound />;

  return <CountyLocalSourcesDirectory county={county} />;
}

function CountyOpEdPage() {
  const { stateSlug, countySlug } = useParams<{ stateSlug: string; countySlug: string }>();
  const county = getCounty(stateSlug, countySlug);

  if (!county) {
    return <NotFound />;
  }

  return (
    <div className="layout-grid">
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

  return (
    <div className="layout-grid">
      <SubmissionForm county={county} />
    </div>
  );
}

function CountyClassifiedsPage() {
  const { stateSlug, countySlug } = useParams<{ stateSlug: string; countySlug: string }>();
  const county = getCounty(stateSlug, countySlug);
  if (!county) return <NotFound />;

  return (
    <div className="layout-grid">
      <ClassifiedSubmissionForm county={county} />
    </div>
  );
}

function OpEdPage() {
  return (
    <div className="layout-grid">
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

  return (
    <div className="layout-grid">
      <SubmissionForm state={state} />
    </div>
  );
}

function getSubjectPage(subjectSlug?: string) {
  return subjectPages.find((subject) => subject.slug === subjectSlug);
}

function getSubjectGroup(subjectSlug?: string) {
  return subjectGroups.find((group) => group.slug === subjectSlug);
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
      <section className="hero-card">
        <p className="kicker">Privacy</p>
        <h1>Privacy Policy</h1>
        <p className="lead">We use the County Post News API for news aggregation. No behavioral tracking or ad tech.</p>
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
