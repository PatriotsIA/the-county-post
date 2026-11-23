import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { adRel, CLASSIFIEDS_FEED_AD_EVERY, CLASSIFIEDS_SQUARE_AD_ID, DIGNITY_MEMORIAL_AD_ID, getClassifiedsFeedAd, getFeedSponsor, getInFeedAdRotation, type AdCreative } from "../data/ads";
import { useAdHref } from "../lib/useClassifiedsLink";
import { useAdEditionKey } from "../lib/useAdEditionKey";
import { SponsorVideo } from "./SponsorVideo";
import { featuredCountyPostOpEds, prependFeaturedCountyPostOpEds } from "../data/county-post-op-eds";
import { filterApiItemsByLocality, matchesLocality, type LocalityScope } from "../lib/feed-locality";
import { fetchNewsApiFeed, isNewsApiConfigured, type NewsFeedItem, type Topic } from "../lib/news-api";
import { registerVisibleFeed } from "../lib/fetch-visible-feeds";
import { fetchNewsFeeds } from "../lib/rss";
import { LoadingIndicator } from "./LoadingIndicator";

type FeedKind = Topic;

type Props = {
  title: string;
  apiPath?: string;
  fallbackFeedUrls?: string[];
  initialError?: string;
  initialItems?: NewsFeedItem[];
  initialHasMore?: boolean;
  initialStatus?: "idle" | "loading" | "loaded" | "error";
  initialSource?: FeedSource;
  /** Towns the API scoped a prefetched page to, mirroring the feed response. */
  initialPlaces?: string[];
  initialDatelinePlaces?: string[];
  initialTrustedHosts?: string[];
  initialCountyNameDistinctive?: boolean;
  kicker?: string;
  pageSize?: number;
  pageStep?: number;
  kind?: FeedKind;
  sponsorId?: string;
  locality?: LocalityScope;
  actionLink?: {
    to: string;
    label: string;
  };
  loadEnabled?: boolean;
  onLoadSettled?: () => void;
};

// Matches the API's own ceiling. The old value of 200 quietly capped how much
// of a county's coverage a reader could ever scroll to.
const MAX_REQUESTED_ITEMS = 600;
type FeedSource = "api" | "fallback";

const NO_SCOPE: string[] = [];

export function NewsFeedSection({
  title,
  apiPath,
  fallbackFeedUrls = [],
  initialError,
  initialItems,
  initialHasMore,
  initialStatus = "idle",
  initialSource,
  initialPlaces,
  initialDatelinePlaces,
  initialTrustedHosts,
  initialCountyNameDistinctive,
  kicker,
  pageSize = 12,
  pageStep = 16,
  kind = "general",
  sponsorId,
  locality,
  actionLink,
  loadEnabled = true,
  onLoadSettled,
}: Props) {
  const editionKey = useAdEditionKey();
  const adHref = useAdHref("feed-ad", editionKey);
  const inFeedAdRotation = useMemo(() => getInFeedAdRotation(editionKey), [editionKey]);
  const classifiedsFeedAd = useMemo(() => getClassifiedsFeedAd(editionKey), [editionKey]);
  const [loadedPath, setLoadedPath] = useState<string>();
  const [items, setItems] = useState<NewsFeedItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [source, setSource] = useState<FeedSource | undefined>(initialSource);
  // Towns the API scoped this feed to. Empty until a response arrives, and
  // empty for the RSS fallback, which has no server-side scoping.
  const [scopedPlaces, setScopedPlaces] = useState<string[]>(initialPlaces ?? []);
  const [scopedDatelinePlaces, setScopedDatelinePlaces] = useState<string[]>(initialDatelinePlaces ?? []);
  const [scopedTrustedHosts, setScopedTrustedHosts] = useState<string[]>(initialTrustedHosts ?? []);
  const [countyNameDistinctive, setCountyNameDistinctive] = useState(Boolean(initialCountyNameDistinctive));

  // useState only reads its initial value on the first render, and the county
  // page's prefetch resolves after that — so a section fed by the prefetch kept
  // the empty arrays it started with and filtered nearly everything out. The
  // props win whenever this component has not fetched its own scope yet.
  // NO_SCOPE is shared so an absent prop does not hand the filter memo a new array every render.
  const effectivePlaces = scopedPlaces.length ? scopedPlaces : (initialPlaces ?? NO_SCOPE);
  const effectiveDatelinePlaces = scopedDatelinePlaces.length ? scopedDatelinePlaces : (initialDatelinePlaces ?? NO_SCOPE);
  const effectiveTrustedHosts = scopedTrustedHosts.length ? scopedTrustedHosts : (initialTrustedHosts ?? NO_SCOPE);
  const effectiveCountyDistinctive = countyNameDistinctive || Boolean(initialCountyNameDistinctive);
  // What the API says about whether more pages exist, which is more reliable
  // than inferring it from how many items survived the client-side filter.
  const [apiHasMore, setApiHasMore] = useState<boolean | undefined>(initialHasMore);
  const [requestedCount, setRequestedCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const onLoadSettledRef = useRef(onLoadSettled);
  const [gridColumns, setGridColumns] = useState(1);
  const [isOpen, setIsOpen] = useState(true);
  const panelId = useId();
  const fallbackFeedUrlsKey = fallbackFeedUrls.join("\n");
  const stableFallbackFeedUrls = useMemo(() => fallbackFeedUrlsKey.split("\n").filter(Boolean), [fallbackFeedUrlsKey]);
  const hasInitialPageData = initialItems !== undefined || initialStatus === "loading" || initialStatus === "error";
  const filteredItems = useMemo(() => {
    const scopedItems =
      source === "api"
        ? filterApiItemsByLocality(
            items,
            locality,
            effectivePlaces,
            effectiveDatelinePlaces,
            effectiveTrustedHosts,
            effectiveCountyDistinctive,
          )
        : filterFeedItems(items, kind, locality);
    return dedupeTitles(kind === "opinion" ? prependFeaturedCountyPostOpEds(scopedItems) : scopedItems);
  }, [effectiveCountyDistinctive, effectiveDatelinePlaces, effectivePlaces, effectiveTrustedHosts, items, kind, locality, source]);
  useEffect(() => {
    if ((import.meta.env.DEV || import.meta.env.VITE_FETCH_PREVIEW === "true") && apiPath && apiPath === loadedPath)
      return registerVisibleFeed(apiPath, filteredItems);
  }, [apiPath, loadedPath, filteredItems]);
  const feedEntries = useMemo(
    () => createFeedEntries(filteredItems, `${title}-${kind}-${editionKey || "national"}`, gridColumns, inFeedAdRotation, classifiedsFeedAd),
    [filteredItems, gridColumns, kind, editionKey, title, inFeedAdRotation, classifiedsFeedAd],
  );
  // The API reports whether more pages exist. Falling back to comparing what
  // survived the client filter against what was asked for meant a feed whose
  // items were being over-filtered could never request the next page.
  const canRequestMore =
    requestedCount < MAX_REQUESTED_ITEMS &&
    filteredItems.length < MAX_REQUESTED_ITEMS &&
    // Previously this required source === "fallback", so scrolling only ever
    // loaded more on the RSS fallback path — never on an API-backed feed, which
    // is every county desk. For API feeds the server says whether more exists;
    // before the first direct fetch (sections arrive prefetched with the page)
    // a full page of items stands in as the signal that there is more to get.
    (source === "api" ? (apiHasMore ?? (filteredItems.length >= requestedCount)) : filteredItems.length >= requestedCount);

  useEffect(() => {
    onLoadSettledRef.current = onLoadSettled;
  }, [onLoadSettled]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!loadEnabled && !hasInitialPageData) {
        setStatus("loading");
        setError("");
        return;
      }
      setStatus("loading");
      setError("");
      try {
        if (hasInitialPageData && initialStatus === "loading" && requestedCount <= pageSize) {
          return;
        }
        if (hasInitialPageData && initialStatus === "error" && requestedCount <= pageSize) {
          const fallbackItems = await loadFallbackItems(
            requestedCount,
            stableFallbackFeedUrls,
            Boolean(locality?.countyName && kind === "general"),
          );
          if (!cancelled) {
            setLoadedPath(apiPath);
            setItems(fallbackItems);
            setSource("fallback");
            setStatus("loaded");
            setError("");
            onLoadSettledRef.current?.();
          }
          return;
        }
        if (hasInitialPageData && initialStatus === "loaded" && requestedCount <= Math.max(pageSize, initialItems?.length || 0)) {
          if (!cancelled) {
            setLoadedPath(apiPath);
            setItems(initialItems || []);
            setSource(initialSource || "api");
            setStatus("loaded");
          }
          return;
        }

        if (apiPath && isNewsApiConfigured()) {
          try {
            const feed = await fetchNewsApiFeed(apiPath, requestedCount);
            const apiItems = feed.items;
            if (!cancelled) {
              setScopedPlaces(feed.places);
              setScopedDatelinePlaces(feed.datelinePlaces);
              setScopedTrustedHosts(feed.trustedHosts);
              setCountyNameDistinctive(feed.countyNameDistinctive);
              setApiHasMore(feed.hasMore);
              setLoadedPath(apiPath);
              setItems(apiItems);
              setSource("api");
              setStatus("loaded");
            onLoadSettledRef.current?.();
            }
            return;
          } catch {
            // Fall through to RSS so deployments can keep articles while the API is offline.
          }
        }

        const fallbackItems = await loadFallbackItems(
          requestedCount,
          stableFallbackFeedUrls,
          Boolean(locality?.countyName && kind === "general"),
        );
        if (!cancelled) {
          setLoadedPath(apiPath);
          setItems(fallbackItems);
          setSource("fallback");
          setStatus("loaded");
          onLoadSettledRef.current?.();
        }
      } catch (reason) {
        if (!cancelled) {
          setStatus("error");
          setError(reason instanceof Error ? reason.message : "Unable to load this feed right now.");
          onLoadSettledRef.current?.();
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [
    apiPath,
    fallbackFeedUrlsKey,
    hasInitialPageData,
    initialItems,
    initialSource,
    initialStatus,
    kind,
    loadEnabled,
    locality?.countyName,
    pageSize,
    requestedCount,
    stableFallbackFeedUrls,
  ]);

  useEffect(() => {
    setLoadedPath(apiPath);
    setItems(initialItems || []);
    setApiHasMore(initialHasMore);
    setStatus(initialStatus === "loaded" || initialItems ? "loaded" : initialStatus);
    setSource(initialStatus === "loaded" || initialItems ? initialSource || "api" : undefined);
    setError(initialStatus === "error" ? initialError || "Unable to load this section from the News API." : "");
    setRequestedCount(Math.max(pageSize, initialItems?.length || 0));
    const container = containerRef.current;
    if (container) container.scrollTop = 0;
  }, [apiPath, initialError, initialItems, initialHasMore, initialSource, initialStatus, pageSize]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = containerRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && canRequestMore) {
          setRequestedCount((count) => Math.min(MAX_REQUESTED_ITEMS, count + pageStep));
        }
      },
      { root: container || null, rootMargin: "320px 0px 320px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canRequestMore, pageStep]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      if (canRequestMore && container.scrollTop + container.clientHeight >= container.scrollHeight - 240) {
        setRequestedCount((count) => Math.min(MAX_REQUESTED_ITEMS, count + pageStep));
      }
    };
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, [canRequestMore, pageStep]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const updateColumnCount = () => {
      const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length;
      setGridColumns(Math.max(1, columns));
    };

    updateColumnCount();
    // Only a width change can change the column count, and the count is read in
    // the next frame. Updating state inside the observer callback re-rendered the
    // grid during the observer's own layout pass, and every height change from
    // loading stories did so again: the browser reported each as a
    // "ResizeObserver loop completed with undelivered notifications" error.
    let frame = 0;
    let observedWidth: number | undefined;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width === observedWidth) return;
      observedWidth = width;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateColumnCount);
    });
    observer.observe(grid);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (status === "loaded" && canRequestMore && filteredItems.length < pageSize) {
      setRequestedCount((count) => Math.min(MAX_REQUESTED_ITEMS, count + pageStep));
    }
  }, [canRequestMore, filteredItems.length, pageSize, pageStep, status]);

  return (
    <section className="section" id={`desk-${kind}`} data-page-jump={title}>
      <header className="section-heading">
        <div className="section-heading-rule" aria-hidden />
        <div>
          {kicker ? <p className="kicker">{kicker}</p> : null}
          <h2>{title}</h2>
          <button
            type="button"
            className="feed-collapse-toggle"
            aria-controls={panelId}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((open) => !open)}
          >
            {isOpen ? "Hide stories" : "Show stories"} <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
          </button>
          <FeedSponsor kind={kind} sponsorId={sponsorId} editionKey={editionKey} />
          {actionLink ? (
            <Link to={actionLink.to} className="section-action">
              {actionLink.label}
            </Link>
          ) : null}
        </div>
        <div className="section-heading-rule" aria-hidden />
      </header>
      <div id={panelId} hidden={!isOpen}>
        {status === "error" ? <p className="muted">{error}</p> : null}
        {status === "loading" && !items.length ? (
          <LoadingIndicator
            className="feed-loading"
            label="Please Wait 20 Seconds As We Fetch The News"
          />
        ) : null}
        {status === "loaded" && source ? <p className="feed-source">Fetching articles via {source === "api" ? "County News API" : "Fallback RSS"}</p> : null}
        <div className="feed-scroll" ref={containerRef}>
          <div className="feed-grid" ref={gridRef}>
            {feedEntries.map((entry) =>
              entry.type === "ad" ? entry.ad.video ? (
                <div key={`ad-${entry.ad.id}-${entry.position}`} className="feed-card feed-ad-card feed-video-card" aria-label={`Advertisement: ${entry.ad.name}`}>
                  <SponsorVideo ad={entry.ad} />
                </div>
              ) : (
                <a
                  key={`ad-${entry.ad.id}-${entry.position}`}
                  className="feed-card feed-ad-card"
                  href={adHref(entry.ad)}
                  target="_blank"
                  rel={adRel(entry.ad)}
                  aria-label={`Advertisement: ${entry.ad.name}`}
                >
                  <img className="feed-ad-image" src={entry.ad.image} alt={entry.ad.alt} />
                  <span className="feed-ad-label">Advertisement</span>
                </a>
              ) : (
                <ArticleCard key={entry.item.id} item={entry.item} locality={locality} />
              ),
            )}
          </div>
          <div ref={sentinelRef} aria-hidden style={{ height: "48px" }} />
          {status === "loading" && items.length ? (
            <LoadingIndicator label="Loading more stories…" size="small" />
          ) : null}
        </div>
        {!filteredItems.length && status === "loaded" ? (
          <p className="muted">
            {locality?.countyName
              ? `No verified ${locality.countyName} County stories are available yet. If news is happening in your county, help create the record and share it with The County Post.`
              : "No matching stories available yet."}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * One story card.
 *
 * The publisher is stated first, on its own line, and the outbound link names
 * the destination — The County Post aggregates most of what it shows, and a card
 * that buries the source reads as though this paper wrote the story. Google News
 * weighs clear dates, bylines, and publisher information, and readers deserve
 * the same clarity, so attribution is unconditional rather than shown only when
 * some other field happens to be populated.
 *
 * The County Post's own reporting is labelled as such and links internally.
 * Aggregated stories deliberately carry no Article structured data: claiming
 * authorship of another publisher's work in machine-readable form would be the
 * same misrepresentation as hiding the byline.
 */
function ArticleCard({ item, locality }: { item: NewsFeedItem; locality?: LocalityScope }) {
  const isOriginal = item.source === "The County Post";
  const publisher = publisherName(item);
  const published = formatDate(item.publishedAt);
  const isInternal = item.link.startsWith("/");

  return (
    <article className="feed-card">
      <ArticleMedia item={item} locality={locality} />
      <div className="feed-card-body">
        {isOriginal || publisher ? (
          <p className={isOriginal ? "feed-publisher feed-publisher-original" : "feed-publisher"}>
            {isOriginal ? "The County Post · Original reporting" : publisher}
          </p>
        ) : null}

        {isInternal ? (
          <Link to={item.link} className="feed-title">
            {item.title}
          </Link>
        ) : (
          <a href={item.link} target="_blank" rel="noreferrer" className="feed-title">
            {item.title}
          </a>
        )}

        {item.publishedAt ? (
          <p className="feed-meta">
            Published <time dateTime={item.publishedAt}>{published}</time>
          </p>
        ) : null}

        {isInternal ? (
          <Link to={item.link} className="feed-origin-link">
            Read the full story on The County Post <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <a href={item.link} target="_blank" rel="noreferrer" className="feed-origin-link">
            {publisher ? `View original story at ${publisher}` : "View the original story"} <span aria-hidden="true">→</span>
          </a>
        )}
      </div>
    </article>
  );
}

/**
 * The story's publisher, or undefined when the feed gave us nothing usable.
 *
 * Aggregator feeds sometimes report the query that produced them — literally
 * `("Potter County" "Texas") (local news OR community news) - BingNews` — in
 * the source field. Printing that where the byline goes is worse than printing
 * nothing, so implausible values are rejected in favour of the article's own
 * hostname, which is at least true.
 */
function publisherName(item: NewsFeedItem): string | undefined {
  const source = item.source?.trim();
  if (source && isPlausiblePublisher(source)) return source;
  try {
    return new URL(item.link).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/** Real mastheads have no quotes, parentheses, or boolean operators in them. */
function isPlausiblePublisher(value: string) {
  if (value.length > 48) return false;
  if (/["\u201c\u201d()]/.test(value)) return false;
  if (/\s(?:OR|AND)\s/.test(value)) return false;
  return !/^https?:/i.test(value);
}

/**
 * Thumbnail text when no publisher is known. Deliberately generic — it labels
 * the desk the story appears on, and never implies The County Post wrote it.
 */
function genericNewsLabel(locality?: LocalityScope) {
  if (locality?.countyName) return `${locality.countyName} County News`;
  if (locality?.stateName) return `${locality.stateName} News`;
  return "News";
}

type FeedEntry = { type: "article"; item: NewsFeedItem } | { type: "ad"; ad: AdCreative; position: number };

// A one-column feed (phones) would otherwise put an ad after every story.
const SINGLE_COLUMN_ARTICLES_PER_AD = 5;

function createFeedEntries(items: NewsFeedItem[], feedIdentity: string, gridColumns: number, inFeedAdRotation: AdCreative[], classifiedsAd?: AdCreative): FeedEntry[] {
  const entries: FeedEntry[] = [];
  const seed = hashFeedIdentity(feedIdentity);
  const singleColumn = gridColumns <= 1;
  const articlesPerAd = singleColumn ? SINGLE_COLUMN_ARTICLES_PER_AD : gridColumns * 2 - 1;
  // Paying advertisers advance only on their own slots, so a Classifieds slot never skips one.
  let paidPosition = 0;

  for (let start = 0, adPosition = 0; start < items.length; start += articlesPerAd, adPosition += 1) {
    const chunk = items.slice(start, start + articlesPerAd);
    // On a multi-column grid one ad follows every two rows of articles. Its
    // column changes per feed and insertion, but a full article-only row always
    // separates ad rows. A single column shows five stories between ads.
    const adIndex = singleColumn ? articlesPerAd : gridColumns + ((seed + adPosition) % gridColumns);
    entries.push(...chunk.slice(0, adIndex).map((item) => ({ type: "article" as const, item })));

    const classifiedsSlot = Boolean(classifiedsAd) && (seed + adPosition) % CLASSIFIEDS_FEED_AD_EVERY === CLASSIFIEDS_FEED_AD_EVERY - 1;
    const ad = classifiedsSlot ? classifiedsAd : inFeedAdRotation.length ? inFeedAdRotation[(seed + paidPosition) % inFeedAdRotation.length] : undefined;
    if (chunk.length && ad) {
      entries.push({ type: "ad", ad, position: adPosition });
      if (!classifiedsSlot) paidPosition += 1;
    }

    entries.push(...chunk.slice(adIndex).map((item) => ({ type: "article" as const, item })));
  }

  return entries;
}

function hashFeedIdentity(value: string) {
  return Array.from(value).reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 0);
}

// Listed in order of preference; Dignity Memorial presents obituaries in Texas editions.
const feedSponsorIds: Partial<Record<FeedKind, string[]>> = {
  general: ["guerrilla-gear-inline"],
  sports: ["lemc-inline"],
  economy: ["plains-bank-inline"],
  obituaries: [DIGNITY_MEMORIAL_AD_ID, "pia-events-inline"],
  "jobs-business": ["plains-bank-inline"],
  "budgets-levies": ["lawyers-title-inline"],
  "audits-recounts": ["amberwood-brush-inline"],
  // The County Post Classifieds presents Opinion & op-eds in every edition.
  opinion: [CLASSIFIEDS_SQUARE_AD_ID],
};

function FeedSponsor({ kind, sponsorId, editionKey }: { kind: FeedKind; sponsorId?: string; editionKey?: string }) {
  const sponsor = getFeedSponsor(sponsorId ? [sponsorId] : feedSponsorIds[kind] ?? [], editionKey);
  const sponsorHref = useAdHref("feed-sponsor", editionKey);
  if (!sponsor) return null;

  return (
    <>
    <p className="feed-presented-by">Presented by</p>
    <a className="feed-sponsor" href={sponsorHref(sponsor)} target="_blank" rel={adRel(sponsor)}>
      <img src={sponsor.sponsorImage ?? sponsor.image} alt={sponsor.house ? sponsor.name : sponsor.alt} />
    </a>
    </>
  );
}

function ArticleMedia({ item, locality }: { item: NewsFeedItem; locality?: LocalityScope }) {
  const [imageAvailable, setImageAvailable] = useState(Boolean(item.imageUrl));

  useEffect(() => {
    setImageAvailable(Boolean(item.imageUrl));
  }, [item.imageUrl]);

  if (!imageAvailable || !item.imageUrl) {
    // The placeholder names the story's own publisher. It used to fall back to
    // "County Post News" or the county desk's name, which put this paper's
    // branding on top of another outlet's reporting — the same
    // misattribution the card body is careful to avoid.
    const isOriginal = item.source === "The County Post";
    const label = isOriginal ? "The County Post" : (publisherName(item) ?? genericNewsLabel(locality));
    return (
      <div className={isOriginal ? "feed-source-mark feed-source-mark-original" : "feed-source-mark"} aria-label={label}>
        {label}
      </div>
    );
  }

  return (
    <a href={item.link} target="_blank" rel="noreferrer" className="feed-image-link" tabIndex={-1} aria-hidden="true">
      <img
        className="feed-image"
        src={item.imageUrl}
        alt=""
        loading="lazy"
        // Publishers' hotlink rules refuse their photos to other sites' pages; sent without a referrer they load.
        referrerPolicy="no-referrer"
        onError={() => setImageAvailable(false)}
      />
    </a>
  );
}

async function loadFallbackItems(
  requestedCount: number,
  fallbackFeedUrls: string[],
  balancePublishers: boolean,
) {
  if (!fallbackFeedUrls.length) throw new Error("No fallback RSS feeds are configured for this section.");
  const items = await fetchNewsFeeds(fallbackFeedUrls, requestedCount, { balancePublishers });
  if (!items.length) throw new Error("Unable to load this feed from the News API or fallback RSS.");
  return items;
}

const obituaryTerms = [
  "obituary",
  "obituaries",
  "death notice",
  "funeral",
  "memorial service",
  "celebration of life",
  "passed away",
  "died",
];

const sportsTerms = ["sports", "football", "basketball", "baseball", "softball", "volleyball", "soccer", "athletics", "score"];

const categoryRules: Record<FeedKind, { include?: string[]; exclude?: string[] }> = {
  general: {
    exclude: [...obituaryTerms, ...sportsTerms],
  },
  weather: {
    include: [
      "weather",
      "forecast",
      "national weather service",
      "storm",
      "flood",
      "tornado",
      "hurricane",
      "snow",
      "ice",
      "heat",
      "drought",
    ],
    exclude: obituaryTerms,
  },
  sports: {
    include: sportsTerms,
    exclude: obituaryTerms,
  },
  politics: {
    include: ["politics", "election", "council", "commission", "ballot", "mayor", "governor", "legislature", "congress"],
    exclude: [...obituaryTerms, ...sportsTerms],
  },
  economy: {
    include: ["economy", "business", "jobs", "unemployment", "housing", "development", "market", "employer", "industry"],
    exclude: [...obituaryTerms, ...sportsTerms],
  },
  crime: {
    include: ["crime", "police", "sheriff", "court", "arrest", "charged", "indicted", "trial", "sentenced"],
    exclude: obituaryTerms,
  },
  obituaries: {
    include: obituaryTerms,
    exclude: ["arrest", "charged", "crime", "police", "sheriff", "election", "sports", "football", "basketball"],
  },
  opinion: {
    include: ["opinion", "editorial", "column", "letter to the editor", "commentary", "op-ed", "op ed"],
    exclude: obituaryTerms,
  },
  "monetary-policy": {
    include: ["inflation", "interest rate", "federal reserve", "central bank", "currency", "monetary policy"],
    exclude: obituaryTerms,
  },
  "markets-investing": {
    include: ["market", "markets", "commodity", "commodities", "stock", "stocks", "bond", "bonds", "investing"],
    exclude: obituaryTerms,
  },
  "jobs-business": {
    include: ["job", "jobs", "employment", "employer", "business", "industry", "economic development"],
    exclude: obituaryTerms,
  },
  "property-taxes": {
    include: ["property tax", "property taxes", "appraisal", "tax levy", "homestead exemption", "tax assessor"],
    exclude: obituaryTerms,
  },
  "municipal-bonds": {
    include: ["municipal bond", "school bond", "bond election", "bond proposal", "public debt"],
    exclude: obituaryTerms,
  },
  "budgets-levies": {
    include: ["public budget", "county budget", "city budget", "school budget", "tax rate", "public finance"],
    exclude: obituaryTerms,
  },
  "voting-systems": {
    include: ["voting system", "ballot processing", "voting equipment", "ballot certification", "election technology"],
    exclude: obituaryTerms,
  },
  "election-administration": {
    include: ["election administration", "election office", "polling place", "voter registration", "election date"],
    exclude: obituaryTerms,
  },
  "audits-recounts": {
    include: ["election audit", "recount", "canvass", "post-election review", "election results certification"],
    exclude: obituaryTerms,
  },
  "open-records": {
    include: ["public records", "open records", "freedom of information", "foia", "government transparency"],
    exclude: obituaryTerms,
  },
};

function filterFeedItems(items: NewsFeedItem[], kind: FeedKind, locality?: LocalityScope) {
  const rules = categoryRules[kind];
  return items.filter((item) => {
    const contentHaystack = `${item.title} ${item.description || ""} ${(item.categories || []).join(" ")}`.toLowerCase();
    const haystack = `${contentHaystack} ${item.source || ""}`.toLowerCase();
    if (rules.exclude?.some((term) => haystack.includes(term))) return false;
    if (rules.include?.length && !rules.include.some((term) => haystack.includes(term))) return false;
    return matchesLocality(item, contentHaystack, haystack, locality);
  });
}

// County Post op-eds are distinct pieces even when their headlines share a subject.
const pinnedOpEdIds = new Set(featuredCountyPostOpEds.map((article) => article.id));

function dedupeTitles(items: NewsFeedItem[]) {
  const accepted: Array<{ title: string; image: string; item: NewsFeedItem }> = [];
  return items.filter((item) => {
    const title = normalizeDuplicateTitle(item.title, item.source);
    const image = normalizeImageKey(item.imageUrl);
    if (!title || (!pinnedOpEdIds.has(item.id) && accepted.some((existing) => (image && existing.image === image) || isNearDuplicate(item, title, existing.item, existing.title)))) return false;
    accepted.push({ title, image, item });
    return true;
  });
}

function normalizeDuplicateTitle(value: string, source?: string) {
  const sourceSuffix = source ? ` - ${source}`.toLowerCase() : "";
  const withoutSource = sourceSuffix && value.toLowerCase().endsWith(sourceSuffix) ? value.slice(0, -sourceSuffix.length) : value;
  const headline = withoutSource.split(/\s[-–—]\s/)[0] || withoutSource;
  return headline.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function isNearDuplicate(item: NewsFeedItem, title: string, existingItem: NewsFeedItem, existingTitle: string) {
  if (isDistinctRecurringEdition(item, title, existingItem, existingTitle)) return false;
  if (title === existingTitle || title.includes(existingTitle) || existingTitle.includes(title)) return true;
  if (tokenSimilarity(title, existingTitle) >= 0.82) return true;
  if (samePublisher(item, existingItem) && sharesEventContext(title, existingTitle)) return true;

  if (!isDvidsItem(item) || !isDvidsItem(existingItem)) return false;
  const description = normalizeDuplicateTitle(item.description || "");
  const existingDescription = normalizeDuplicateTitle(existingItem.description || "");
  return description.length >= 36 && existingDescription.length >= 36 && tokenSimilarity(description, existingDescription) >= 0.72;
}

function tokenSimilarity(left: string, right: string) {
  const leftTokens = new Set(left.split(" ").filter((token) => token.length > 2));
  const rightTokens = new Set(right.split(" ").filter((token) => token.length > 2));
  if (!leftTokens.size || !rightTokens.size) return 0;

  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return shared / (leftTokens.size + rightTokens.size - shared);
}

function sharesEventContext(left: string, right: string) {
  const leftTokens = new Set(left.split(" ").map(stemToken).filter((token) => token.length > 2));
  const rightTokens = new Set(right.split(" ").map(stemToken).filter((token) => token.length > 2));
  const shared = [...leftTokens].filter((token) => rightTokens.has(token));
  return shared.length >= 3 && shared.some((token) => !genericStoryTokens.has(token));
}

function stemToken(token: string) {
  if (token.startsWith("escape")) return "escape";
  return token.replace(/(ing|ed|es|s)$/u, "");
}

const genericStoryTokens = new Set(["county", "local", "news", "official", "officials", "report", "update", "today"]);
const recurringSeriesTokens = new Set(["report", "reports", "log", "logs", "blotter", "briefing", "roundup"]);

function isDistinctRecurringEdition(
  item: NewsFeedItem,
  title: string,
  existingItem: NewsFeedItem,
  existingTitle: string,
) {
  if (!samePublisher(item, existingItem)) return false;
  const publishedAt = publicationTimestamp(item.publishedAt);
  const existingPublishedAt = publicationTimestamp(existingItem.publishedAt);
  if (publishedAt === undefined || existingPublishedAt === undefined) return false;
  if (Math.abs(publishedAt - existingPublishedAt) < 48 * 60 * 60 * 1000) return false;

  const titleTokens = title.split(" ");
  const existingTitleTokens = existingTitle.split(" ");
  return (
    title === existingTitle ||
    [...recurringSeriesTokens].some(
      (token) => titleTokens.includes(token) && existingTitleTokens.includes(token),
    )
  );
}

function samePublisher(left: NewsFeedItem, right: NewsFeedItem) {
  const leftPublisher = publisherKey(left.source);
  const rightPublisher = publisherKey(right.source);
  return Boolean(leftPublisher && leftPublisher === rightPublisher);
}

function publisherKey(value?: string) {
  const normalized = (value || "")
    .toLowerCase()
    .replace(/\b(the|north|south|east|west|northeast|northwest|southeast|southwest)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (normalized.includes("my pulse news")) return "mypulsenews.com";
  return normalized;
}

function publicationTimestamp(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? undefined : parsed;
}

function isDvidsItem(item: NewsFeedItem) {
  return Boolean(item.source?.toLowerCase().includes("dvids") || item.link.toLowerCase().includes("dvidshub.net"));
}

function normalizeImageKey(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (/(logo|masthead|favicon|placeholder|default[-_]?image|site[-_]?icon)/.test(url.pathname.toLowerCase())) {
      return "";
    }
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.toLowerCase().replace(/\s+/g, "");
  }
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
