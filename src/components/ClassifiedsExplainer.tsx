import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { CountySite } from "../data/counties";
import type { StateSite } from "../data/states";
import { classifiedsOrigin, countyClassifiedsUrl, editionClassifiedsUrl, withCountyPostUtm } from "../lib/classifieds";
import classifiedsLogo from "../assets/county-post-classifieds-logo-small.webp";
import "./ClassifiedsExplainer.css";

type Slide = { id: string; kicker: string; title: string; body: string; action: { label: string; href: string } };

/**
 * A carousel explaining The County Post Classifieds, the separate marketplace
 * at classifieds.thecountypost.com, written for the edition it sits in: a
 * county, a state, or the whole country. It sits above Opinion & op-eds on
 * every edition home and on the partners pages. Every link into the
 * marketplace is tagged with the page it was followed from. Readers move
 * through it with the arrows, the dots or a swipe; it never advances on its own.
 *
 * County links go through the marketplace's FIPS entry points, which never
 * guess a county from its name; state pages there share the County Post's
 * state slugs.
 */
export function ClassifiedsExplainer({ county, state: stateProp }: { county?: CountySite; state?: StateSite }) {
  const headingId = useId();
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const { pathname } = useLocation();
  const origin = classifiedsOrigin();
  const state = county?.state ?? stateProp;
  const place = county?.displayName ?? state?.name;
  const editionKey = county ? `${county.state.slug}/${county.slug}` : state?.slug;
  const tag = (url: string) => withCountyPostUtm(url, "carousel", pathname);

  const slides: Slide[] = origin ? [
    {
      id: "marketplace",
      kicker: "The County Post Classifieds",
      title: place ? `${place} marketplace` : "Where classifieds are back",
      body: `Buy, sell and connect locally on classifieds.thecountypost.com: items and services from your neighbors${place ? ` in ${place}` : ""}, from autos and farm equipment to livestock, rentals, real estate and jobs.`,
      action: { label: `Browse ${place ? `${place} ` : ""}listings ↗`, href: tag(editionClassifiedsUrl(editionKey) ?? `${origin}/`) },
    },
    {
      id: "sell",
      kicker: "Personal listings",
      title: "Sell it free",
      body: `Personal listings are free. Create an account, post what you're selling${county ? ` in ${county.displayName}` : ""}, and it's reviewed before it goes live.`,
      action: county
        ? { label: "Post an item ↗", href: tag(countyClassifiedsUrl(county.fips, "post") ?? `${origin}/register/`) }
        : { label: "Create a free account ↗", href: tag(`${origin}/register/`) },
    },
    {
      id: "wanted",
      kicker: "In Search Of",
      title: "Looking for something?",
      body: `Post a Wanted listing and let sellers ${state ? `across ${state.name}` : "nearby"} find you, or see what buyers are asking for.`,
      action: { label: "See Wanted listings ↗", href: tag(`${origin}/in-search-of/${state ? `${state.slug}/` : ""}`) },
    },
    {
      id: "businesses",
      kicker: "Local businesses",
      title: "A free page for your business",
      body: "Business pages are free. Business listings are $10 for 30 days in one county, plus $5 for each additional county, paid through Stripe after staff approval, with no subscription.",
      action: { label: "Find local businesses ↗", href: tag(`${origin}/businesses/`) },
    },
    {
      id: "markets",
      kicker: "Every market",
      title: "Every county has a market",
      body: "Every state and county has its own market page, even before its first listing. Search by keyword, category, price and county, or leave the county blank to search nationwide.",
      action: { label: "Find a market ↗", href: tag(`${origin}/markets/`) },
    },
    {
      id: "advertise",
      kicker: "Advertise",
      title: "Advertise on the marketplace",
      body: "Reserve county, state or marketplace-wide placements. The advertising team confirms inventory, artwork and the final quote before anything runs.",
      action: { label: "Advertising options ↗", href: tag(`${origin}/advertise/`) },
    },
  ] : [];

  // The dots follow a swipe as well as the buttons.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setActive(Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener("scroll", onScroll);
    };
  }, [slides.length]);

  if (!slides.length) return null;

  const show = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const next = (index + slides.length) % slides.length;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: next * track.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
    setActive(next);
  };

  return (
    <section className="section classifieds-explainer" aria-roledescription="carousel" aria-labelledby={headingId}>
      <header className="section-heading">
        <div className="section-heading-rule" aria-hidden />
        <div>
          <p className="kicker">classifieds.thecountypost.com</p>
          <h2 id={headingId}>{place ? `${place} Classifieds` : "The County Post Classifieds"}</h2>
        </div>
        <div className="section-heading-rule" aria-hidden />
      </header>
      <div className="explainer-shell">
        <button type="button" className="explainer-arrow" onClick={() => show(active - 1)} aria-label="Previous slide">
          <span aria-hidden="true">‹</span>
        </button>
        <ul ref={trackRef} className="explainer-track">
          {slides.map((slide, index) => (
            <li
              key={slide.id}
              className="explainer-slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${slides.length}: ${slide.title}`}
              inert={index !== active}
            >
              <img className="explainer-logo" src={classifiedsLogo} alt="" loading="lazy" />
              <div className="explainer-copy">
                <p className="explainer-kicker">{slide.kicker}</p>
                <h3>{slide.title}</h3>
                <p>{slide.body}</p>
                <p className="explainer-action"><a href={slide.action.href}>{slide.action.label}</a></p>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className="explainer-arrow" onClick={() => show(active + 1)} aria-label="Next slide">
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <div className="explainer-dots">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            aria-label={`Show slide ${index + 1}: ${slide.title}`}
            aria-current={index === active ? "true" : undefined}
            onClick={() => show(index)}
          />
        ))}
      </div>
    </section>
  );
}
