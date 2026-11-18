import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useMediaDock } from "../lib/media-dock";
import { onAir, useFeaturedVideos, useWatchStatus } from "../lib/featured-videos";
import { MediaStatus, WatchPanel } from "./WatchPanel";
import { CountySearch } from "./CountySearch";
import { stickyHeaderOffset } from "../lib/scroll";
import countyPostLogo from "../assets/county-post-logo.webp";
import "./PageJumpMenu.css";

export type JumpLink = { to: string; label: string; end?: boolean; external?: boolean; newTab?: boolean; icon?: string };
export type JumpLinkGroup = { label: string; links: JumpLink[] };

type FeedTarget = { element: HTMLElement; label: string };

const PHONE_QUERY = "(max-width: 720px)";

/**
 * The corner button, on every page and at every size. It opens the jump menu:
 * back to top, every news feed on the page, the page's own navigation, and a
 * Watch section that steers the pop-out player and lists the live streams and
 * recent videos to play in it. Phones get a sheet from the bottom of the
 * screen; desktops a two-column panel above the button, Watch beside Navigate,
 * with the red Find Your County search at the top of Navigate. The County Post
 * logo closes the menu at the bottom: on the left on desktops, centred on phones.
 *
 * Feeds are read from the rendered page (`data-page-jump` on each feed
 * section) when the menu opens, so any route that renders feeds gets them
 * listed without registering anything here. The button itself sits outside
 * the routes, so it and the pop-out it controls carry on across page changes.
 */
export function PageJumpMenu({ groups }: { groups: JumpLinkGroup[] }) {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const videos = useFeaturedVideos();
  const dock = useMediaDock();
  const [open, setOpen] = useState(false);
  const [feeds, setFeeds] = useState<FeedTarget[]>([]);
  const [currentFeed, setCurrentFeed] = useState(-1);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // The address the menu was opened at, which leads the rendered page while a new one is still arriving.
  const openedAt = useRef("");
  const { pathname } = useLocation();
  const hasWatch = Boolean(dock || videos?.videos.length || (videos && onAir(videos).length));
  const status = useWatchStatus();
  const toggleLabel = ["Jump to", status.dockOpen ? `video ${status.playing ? "playing" : "paused"}` : "", status.live ? `${status.live} live now` : ""]
    .filter(Boolean).join(", ");

  // Close once the reader has gone somewhere else, but not when a page they
  // had already chosen finishes rendering after the menu was reopened on it.
  useEffect(() => {
    if (openedAt.current === pathname) setFeeds(feedTargets());
    else setOpen(false);
  }, [pathname]);

  useEffect(() => {
    setOpen(false);
  }, [isPhone]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function openMenu() {
    const targets = feedTargets();
    const offset = stickyHeaderOffset() + 24;
    openedAt.current = window.location.pathname;
    setFeeds(targets);
    setCurrentFeed(targets.findLastIndex((target) => target.element.getBoundingClientRect().top <= offset));
    setOpen(true);
  }

  function close(returnFocus = false) {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  }

  function backToTop() {
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function jumpTo(element: HTMLElement) {
    setOpen(false);
    const destination = () => Math.max(0, element.getBoundingClientRect().top + window.scrollY - stickyHeaderOffset() - 8);
    const aimedAt = destination();
    window.scrollTo({ top: aimedAt, behavior: "smooth" });
    // Feeds above the target may still be loading and growing while the page
    // scrolls. If the reader is still where the scroll was headed once it
    // settles, finish the move to wherever the section now sits.
    window.setTimeout(() => {
      if (Math.abs(window.scrollY - aimedAt) > 4) return;
      const settled = destination();
      if (Math.abs(settled - aimedAt) > 4) window.scrollTo({ top: settled, behavior: "smooth" });
    }, 900);
  }

  // Tab and Shift+Tab stay within the open menu, as in any dialog.
  function keepFocusInside(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled])") ?? [])
      .filter((element) => element.offsetParent !== null);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  const topButton = (
    <button type="button" className="page-jump-top" onClick={backToTop}>
      <span aria-hidden="true">↑</span> Back to top
    </button>
  );

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className={`page-jump-toggle${open ? " page-jump-toggle-open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="page-jump-menu"
        aria-label={toggleLabel}
        title={isPhone ? undefined : "Jump to a feed or page, or pick a video"}
        onClick={() => (open ? close() : openMenu())}
      >
        <span className="page-jump-toggle-icon" aria-hidden="true">{open ? "×" : "☰"}</span>
        <span>Jump to</span>
        <MediaStatus status={status} />
      </button>
      {open ? (
        <>
          <button type="button" className="page-jump-backdrop" aria-label="Close the jump menu" tabIndex={-1} onClick={() => close()} />
          <div
            ref={panelRef}
            id="page-jump-menu"
            className={`page-jump-menu${hasWatch ? " page-jump-menu-has-watch" : ""}`}
            role="dialog"
            aria-label="Jump to"
            onKeyDown={keepFocusInside}
          >
            <div className="page-jump-header">
              <p>Jump to</p>
              <span className="page-jump-header-actions">
                {isPhone ? null : topButton}
                <button type="button" className="page-jump-close" onClick={() => close(true)} aria-label="Close the jump menu">
                  ×
                </button>
              </span>
            </div>
            <div className="page-jump-body">
              {isPhone ? topButton : null}
              {hasWatch ? <WatchPanel layout={isPhone ? "row" : "column"} onPlay={() => close()} /> : null}
              <div className="page-jump-navigate">
                {isPhone ? null : (
                  <CountySearch
                    className="page-jump-county-finder"
                    heading={<h2>Find your county</h2>}
                    onNavigate={() => close()}
                  />
                )}
                {feeds.length ? (
                  <div className="page-jump-group">
                    <h2>News feeds on this page</h2>
                    <ul>
                      {feeds.map((feed, index) => (
                        <li key={`${feed.label}-${index}`}>
                          <button type="button" aria-current={index === currentFeed ? "location" : undefined} onClick={() => jumpTo(feed.element)}>
                            {feed.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {groups.map((group) =>
                  group.links.length ? (
                    <nav key={group.label} className="page-jump-group" aria-label={group.label}>
                      <h2>{group.label}</h2>
                      <ul>
                        {group.links.map((link) => (
                          <li key={link.to}>
                            {link.external ? (
                              <a href={link.to} target={link.newTab ? "_blank" : undefined} rel={link.newTab ? "noopener" : undefined} onClick={() => close()}>
                                {link.icon ? <img className="page-jump-link-icon" src={link.icon} alt="" /> : null}
                                {link.label}
                              </a>
                            ) : (
                              <NavLink to={link.to} end={link.end} onClick={() => close()}>
                                {link.label}
                              </NavLink>
                            )}
                          </li>
                        ))}
                      </ul>
                    </nav>
                  ) : null,
                )}
              </div>
            </div>
            <div className="page-jump-footer">
              <Link to="/" className="page-jump-logo" onClick={() => close()}>
                <img src={countyPostLogo} alt="The County Post front page" loading="lazy" />
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function feedTargets(): FeedTarget[] {
  return Array.from(document.querySelectorAll<HTMLElement>("main [data-page-jump]"))
    .map((element) => ({ element, label: element.dataset.pageJump || "" }))
    .filter((target) => target.label);
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}
