import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

export type JumpLink = { to: string; label: string; end?: boolean; external?: boolean; newTab?: boolean };
export type JumpLinkGroup = { label: string; links: JumpLink[] };

type FeedTarget = { element: HTMLElement; label: string };

const PHONE_QUERY = "(max-width: 720px)";

/**
 * The floating corner button. On desktop it scrolls back to the top. On phones,
 * where a county page runs to nine feeds and the menus scroll away with the
 * masthead, it opens a jump menu instead: back to top, every news feed on the
 * page, and the page's own navigation. Feeds are read from the rendered page
 * (`data-page-jump` on each feed section) when the menu opens, so any route
 * that renders feeds gets them listed without registering anything here.
 */
export function PageJumpMenu({ scrolled, groups }: { scrolled: boolean; groups: JumpLinkGroup[] }) {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [open, setOpen] = useState(false);
  const [feeds, setFeeds] = useState<FeedTarget[]>([]);
  const [currentFeed, setCurrentFeed] = useState(-1);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname, isPhone]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function openMenu() {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("main [data-page-jump]"))
      .map((element) => ({ element, label: element.dataset.pageJump || "" }))
      .filter((target) => target.label);
    const offset = stickyHeaderOffset() + 24;
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

  if (!isPhone) {
    return (
      <button
        type="button"
        className={`scroll-top${scrolled ? " scroll-top-visible" : ""}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Scroll to the top of the page"
      >
        <span aria-hidden="true">↑</span>
        <span>Top</span>
      </button>
    );
  }

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="scroll-top scroll-top-visible page-jump-toggle"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="page-jump-menu"
        onClick={() => (open ? close() : openMenu())}
      >
        <span aria-hidden="true">☰</span>
        <span>Jump to</span>
      </button>
      {open ? (
        <>
          <button type="button" className="page-jump-backdrop" aria-label="Close the jump menu" tabIndex={-1} onClick={() => close()} />
          <div ref={panelRef} id="page-jump-menu" className="page-jump-menu" role="dialog" aria-label="Jump to">
            <div className="page-jump-header">
              <p>Jump to</p>
              <button type="button" className="page-jump-close" onClick={() => close(true)} aria-label="Close the jump menu">
                ×
              </button>
            </div>
            <button type="button" className="page-jump-top" onClick={backToTop}>
              <span aria-hidden="true">↑</span> Back to top
            </button>
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
        </>
      ) : null}
    </>
  );
}

/** Height of the masthead when it is pinned to the top of a phone screen. */
function stickyHeaderOffset() {
  const masthead = document.querySelector<HTMLElement>(".masthead");
  if (!masthead || getComputedStyle(masthead).position !== "sticky") return 0;
  return masthead.getBoundingClientRect().height;
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
