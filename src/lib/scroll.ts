/** Height of the masthead when it is pinned to the top of a phone screen. */
export function stickyHeaderOffset() {
  const masthead = document.querySelector<HTMLElement>(".masthead");
  if (!masthead || getComputedStyle(masthead).position !== "sticky") return 0;
  return masthead.getBoundingClientRect().height;
}

/**
 * Scrolls so an element's top sits just below any pinned masthead. Content
 * above it can still be loading and change size while the page scrolls, so
 * once the scroll has settled it is aimed again, unless the reader has since
 * scrolled somewhere else.
 */
export function scrollBelowHeader(element: HTMLElement) {
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = reduceMotion ? "auto" : "smooth";
  const destination = () => Math.max(0, element.getBoundingClientRect().top + window.scrollY - stickyHeaderOffset() - 8);
  const aimedAt = destination();
  window.scrollTo({ top: aimedAt, behavior });
  window.setTimeout(() => {
    if (Math.abs(window.scrollY - aimedAt) > 4) return;
    const settled = destination();
    if (Math.abs(settled - aimedAt) > 4) window.scrollTo({ top: settled, behavior });
  }, 900);
}
