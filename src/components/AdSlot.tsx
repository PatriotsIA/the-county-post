import { useEffect, useRef, useState } from "react";
import { ads, type AdSlotId } from "../data/ads";

type Props = {
  slot: AdSlotId;
  limit?: number;
};

export function AdSlot({ slot, limit }: Props) {
  const creatives = ads
    .filter((ad) => ad.slot === slot)
    .sort((a, b) => Number(b.id === "guerrilla-gear-inline") - Number(a.id === "guerrilla-gear-inline"))
    .slice(0, limit);
  if (!creatives.length) return null;

  if (slot === "banner") return <BannerAdCarousel creatives={creatives} />;

  return <SquareAdCarousel creatives={creatives} />;
}

function SquareAdCarousel({ creatives }: { creatives: typeof ads }) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const move = (direction: -1 | 1) => {
    const track = trackRef.current;
    const cards = Array.from(track?.querySelectorAll<HTMLElement>(".ad-link") || []);
    if (!track || !cards.length) return;

    const center = track.scrollLeft + track.clientWidth / 2;
    const current = cards.reduce((closest, card, index) => {
      const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
      return distance < closest.distance ? { index, distance } : closest;
    }, { index: 0, distance: Number.POSITIVE_INFINITY }).index;
    const next = (current + direction + cards.length) % cards.length;
    const target = cards[next];
    track.scrollTo({
      left: target.offsetLeft + target.offsetWidth / 2 - track.clientWidth / 2,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    if (creatives.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => move(1), 20_000);
    return () => window.clearInterval(interval);
  }, [creatives.length]);

  return (
    <aside className="ad-slot ad-slot-inline" aria-label="Sponsored advertisements">
      <p className="ad-slot-label">Presented by our advertisers</p>
      <div className="ad-carousel-shell">
        <button type="button" className="ad-carousel-arrow" onClick={() => move(-1)} aria-label="Previous sponsor">
          <span aria-hidden="true">‹</span>
        </button>
        <div className="ad-slot-items" ref={trackRef}>
          {creatives.map((ad) => (
            <a key={ad.id} className="ad-link" href={ad.href} target="_blank" rel="noreferrer sponsored">
              <img src={ad.image} alt={ad.alt} />
            </a>
          ))}
        </div>
        <button type="button" className="ad-carousel-arrow" onClick={() => move(1)} aria-label="Next sponsor">
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </aside>
  );
}

function BannerAdCarousel({ creatives }: { creatives: typeof ads }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const swipeStartX = useRef<number | null>(null);

  const moveBanner = (direction: -1 | 1) => {
    setActiveIndex((index) => (index + direction + creatives.length) % creatives.length);
  };

  useEffect(() => {
    if (creatives.length < 2) return;
    const interval = window.setInterval(() => moveBanner(1), 20_000);
    return () => window.clearInterval(interval);
  }, [creatives.length]);

  return (
    <aside className="ad-slot ad-slot-banner" aria-label="Sponsored advertisements">
      <p className="ad-slot-label">Sponsored</p>
      <div
        className="ad-banner-viewport"
        onPointerDown={(event) => {
          swipeStartX.current = event.clientX;
        }}
        onPointerUp={(event) => {
          if (swipeStartX.current === null) return;
          const delta = event.clientX - swipeStartX.current;
          swipeStartX.current = null;
          if (Math.abs(delta) >= 40) moveBanner(delta < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          swipeStartX.current = null;
        }}
      >
        {creatives.map((ad, index) => (
          <a
            key={ad.id}
            className={`ad-banner-slide${index === activeIndex ? " active" : ""}`}
            href={ad.href}
            target="_blank"
            rel="noreferrer sponsored"
            aria-hidden={index !== activeIndex}
            tabIndex={index === activeIndex ? 0 : -1}
          >
            <img src={ad.image} alt={index === activeIndex ? ad.alt : ""} />
          </a>
        ))}
        {creatives.length > 1 ? (
          <>
            <button type="button" className="ad-banner-side-arrow ad-banner-side-arrow-prev" onClick={() => moveBanner(-1)} aria-label="Previous advertisement">
              ‹
            </button>
            <button type="button" className="ad-banner-side-arrow ad-banner-side-arrow-next" onClick={() => moveBanner(1)} aria-label="Next advertisement">
              ›
            </button>
          </>
        ) : null}
      </div>
      {creatives.length > 1 ? (
        <div className="ad-banner-controls" aria-label="Banner advertisement selection">
          {creatives.map((ad, index) => (
            <button
              key={ad.id}
              type="button"
              className={index === activeIndex ? "active" : ""}
              onClick={() => setActiveIndex(index)}
              aria-label={`Show ${ad.name} advertisement`}
              aria-current={index === activeIndex}
            />
          ))}
        </div>
      ) : null}
    </aside>
  );
}
