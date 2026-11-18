import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FeaturedVideosResponse } from "../lib/videos-api";
import { controlEmbed, controllableEmbedUrl, platformOf } from "../lib/embed-control";
import { closeDock, currentDockItem, useMediaDock, type MediaItem } from "../lib/media-dock";
import {
  creditedChannels, desk, formatClock, formatVideoDate, liveChannelNames, liveItem, liveKeyOf, onAir, platformName, popOutFrom, setDeskOpen,
  useDeskState, useFeaturedVideos,
} from "../lib/featured-videos";
import { scrollBelowHeader } from "../lib/scroll";
import "./FeaturedVideoDesk.css";

// The live stream a reader closed the top desk on; the desk stays closed for that stream.
const CLOSED_ON_LIVE_KEY = "county-post-video-desk-closed-live";

type DeskItem = MediaItem;

function readClosedOnLive() {
  try { return window.sessionStorage.getItem(CLOSED_ON_LIVE_KEY); } catch { return null; }
}

function writeClosedOnLive(value: string) {
  try { window.sessionStorage.setItem(CLOSED_ON_LIVE_KEY, value); } catch { /* storage blocked: the desk may reopen */ }
}

function LiveBadge({ names }: { names: string }) {
  return <em className="video-desk-live-badge"><span aria-hidden="true" />Live now · {names}</em>;
}

function ChannelLinks({ data }: { data: FeaturedVideosResponse }) {
  return (
    <p className="video-desk-channels">
      {creditedChannels(data).map((channel) => (
        <a key={channel.id} href={channel.url} target="_blank" rel="noreferrer">{channel.name} on {platformName(channel.platform)} ↗</a>
      ))}
    </p>
  );
}

/**
 * Collapsible desk under the Market desk, on every page. It starts open, with
 * whatever is on the air playing muted: a featured channel's stream, or the
 * stand-in news stream (Newsmax2). A reader who closes it keeps it closed for
 * the rest of the visit, until they open it again (here or with Watch News Now
 * in the masthead) or a featured channel goes live.
 */
export function FeaturedVideoDesk() {
  const data = useFeaturedVideos();
  const dock = useMediaDock();
  const { open: isOpen, listening, reveal } = useDeskState();
  const sectionRef = useRef<HTMLElement>(null);
  const revealed = useRef(0);
  // The chosen item itself, not its key, so a refresh that drops it from the list cannot stop it mid-play.
  const [selected, setSelected] = useState<DeskItem>();
  const [liveIndex, setLiveIndex] = useState(0);

  // Only the featured channels' own streams open the desk.
  const live = data?.live ?? [];
  const liveKey = live.map(liveKeyOf).join(",");
  const streams = data ? onAir(data) : [];

  useEffect(() => {
    setLiveIndex(0);
    if (liveKey && readClosedOnLive() !== liveKey) setDeskOpen(true);
  }, [liveKey]);

  const hasContent = Boolean(data && (data.videos.length || streams.length));
  // Watch News Now brings the desk into view, waiting for it if the videos are still loading.
  useEffect(() => {
    if (!reveal || revealed.current === reveal || !hasContent || !sectionRef.current) return;
    revealed.current = reveal;
    scrollBelowHeader(sectionRef.current);
  }, [reveal, hasContent]);

  if (!data || !hasContent) return null;

  const { channelName, videos: items, queue } = desk(data);
  const activeLive = streams[Math.min(liveIndex, streams.length - 1)];
  // With the pop-out open, a card plays there rather than starting a second player on the page.
  const choose = (item: DeskItem) => (dock ? popOutFrom(queue, item) : setSelected(item));
  const popOutSelected = (startAt: number) => {
    if (selected) popOutFrom(queue, selected, startAt);
    setSelected(undefined);
  };
  const liveNames = liveChannelNames(data);
  const panelId = "featured-video-panel";

  const toggle = () => {
    if (isOpen && liveKey) writeClosedOnLive(liveKey);
    setDeskOpen(!isOpen);
  };
  // Sound only for a reader who asked to watch, and never over the pop-out.
  const liveWithSound = listening && !dock;

  return (
    <section ref={sectionRef} className={`video-desk${streams.length ? " video-desk-is-live" : ""}`} aria-label="Featured Videos">
      <button type="button" className="market-panel-toggle video-desk-toggle" aria-controls={panelId} aria-expanded={isOpen} onClick={toggle}>
        <span>
          <strong>Featured Videos</strong>
          {streams.length ? <LiveBadge names={liveNames} /> : null}
          <span>{data.channels.map((channel) => channel.name).join(" & ")}</span>
        </span>
        <span className="market-panel-toggle-state">{isOpen ? "Hide" : "Show"} <span aria-hidden="true">{isOpen ? "−" : "+"}</span></span>
      </button>
      <div id={panelId} className="video-desk-content" hidden={!isOpen}>
        {isOpen ? (
          <>
            {selected ? (
              <DeskPlayer
                key={selected.key}
                item={selected}
                label={channelName(selected.channelId)}
                closeWhenHidden
                onClose={() => setSelected(undefined)}
                onPopOut={popOutSelected}
                actions={streams.length ? <button type="button" onClick={() => setSelected(undefined)}>Back to live</button> : null}
              />
            ) : activeLive ? (
              <DeskPlayer
                key={liveKeyOf(activeLive)}
                item={liveItem(activeLive, channelName(activeLive.channelId), { withSound: liveWithSound })}
                label={channelName(activeLive.channelId)}
                muted={!liveWithSound}
                onPopOut={() => popOutFrom(queue, liveItem(activeLive, channelName(activeLive.channelId), { withSound: true }))}
                actions={streams.length > 1 ? streams.map((stream, index) => (
                  <button key={stream.videoId} type="button" aria-pressed={index === liveIndex} onClick={() => setLiveIndex(index)}>
                    {channelName(stream.channelId)} live
                  </button>
                )) : null}
              />
            ) : null}
            {items.length ? (
              <VideoCarousel
                items={items}
                selectedKey={selected?.key}
                dockedKey={currentDockItem(dock)?.key}
                channelName={channelName}
                onSelect={choose}
                onPopOut={(item) => { popOutFrom(queue, item); if (selected?.key === item.key) setSelected(undefined); }}
              />
            ) : null}
            <ChannelLinks data={data} />
          </>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The same videos as a desk among the news feeds, open by default and
 * collapsible like the feeds around it. Live streams lead the carousel but play
 * only when chosen, so this desk never starts a second player on its own.
 */
export function FeaturedVideoFeed() {
  const data = useFeaturedVideos();
  const dock = useMediaDock();
  const [isOpen, setIsOpen] = useState(true);
  const [selected, setSelected] = useState<DeskItem>();

  if (!data || (!data.videos.length && !onAir(data).length)) return null;

  const { channelName, queue: items } = desk(data);
  const choose = (item: DeskItem) => (dock ? popOutFrom(items, item) : setSelected(item));
  const liveNames = liveChannelNames(data);
  const panelId = "featured-video-feed-panel";

  return (
    <section className="section video-feed-desk" id="desk-video" data-page-jump="Featured video">
      <header className="section-heading">
        <div className="section-heading-rule" aria-hidden />
        <div>
          <p className="kicker">{data.channels.map((channel) => channel.name).join(" · ")}</p>
          <h2>Featured video</h2>
          {onAir(data).length ? <p className="video-feed-live"><LiveBadge names={liveNames} /></p> : null}
          <button type="button" className="feed-collapse-toggle" aria-controls={panelId} aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
            {isOpen ? "Hide videos" : "Show videos"} <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
          </button>
        </div>
        <div className="section-heading-rule" aria-hidden />
      </header>
      <div id={panelId} className="video-feed-content" hidden={!isOpen}>
        {isOpen ? (
          <>
            {selected ? (
              <DeskPlayer
                key={selected.key}
                item={selected}
                label={channelName(selected.channelId)}
                closeWhenHidden
                onClose={() => setSelected(undefined)}
                onPopOut={(startAt) => { popOutFrom(items, selected, startAt); setSelected(undefined); }}
              />
            ) : null}
            <VideoCarousel
              items={items}
              selectedKey={selected?.key}
              dockedKey={currentDockItem(dock)?.key}
              channelName={channelName}
              onSelect={choose}
              onPopOut={(item) => { popOutFrom(items, item); if (selected?.key === item.key) setSelected(undefined); }}
            />
            <ChannelLinks data={data} />
          </>
        ) : null}
      </div>
    </section>
  );
}

/** A live stream pauses while scrolled away; a chosen video closes, as video ads do. */
function DeskPlayer({ item, label, muted = false, actions, closeWhenHidden = false, onClose, onPopOut }: {
  item: DeskItem;
  label: string;
  muted?: boolean;
  actions?: ReactNode;
  closeWhenHidden?: boolean;
  onClose?: () => void;
  /** Hands the item to the pop-out player at the second it has reached here. */
  onPopOut?: (startAt: number) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const reachedRef = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // YouTube allows automatic playback only once the player is visible, at least half of it on
  // screen, so a stream that starts by itself waits for that; a video a reader chose plays at once.
  const [inView, setInView] = useState(closeWhenHidden);
  const docked = currentDockItem(useMediaDock())?.key === item.key;
  const src = useMemo(() => controllableEmbedUrl(item.embedUrl), [item.embedUrl]);

  // Follow the playing position so popping out continues rather than restarts.
  useEffect(() => {
    const iframe = iframeRef.current;
    const platform = platformOf(item.embedUrl);
    if (!iframe || !platform) return;
    const controller = controlEmbed(iframe, platform, (state) => { reachedRef.current = state.currentTime; });
    return () => controller.dispose();
  }, [src, inView, docked, item.embedUrl]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    // A reader's choice opens above the carousel; bring it into view first.
    if (closeWhenHidden) {
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      frame.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    }
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    let seen = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) seen = true;
      if (closeWhenHidden) {
        if (seen && !entry.isIntersecting) onCloseRef.current?.();
      } else if (entry.intersectionRatio >= 0.5) {
        setInView(true);
      } else if (!entry.isIntersecting) {
        setInView(false);
      }
    }, { threshold: [0, 0.5] });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [closeWhenHidden]);

  return (
    <figure className="video-desk-player">
      <div ref={frameRef} className={`video-desk-frame${docked ? " video-desk-frame-docked" : ""}`}>
        {docked ? (
          <p className="video-desk-docked-note">
            <span>Playing in the pop-out player</span>
            <button type="button" onClick={closeDock}>Close pop-out</button>
          </p>
        ) : inView ? (
          <iframe
            ref={iframeRef}
            src={src}
            title={`${item.live ? "Live: " : ""}${label} — ${item.title}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : null}
      </div>
      <figcaption>
        <span className="video-desk-player-label">
          {item.live ? <span className="video-desk-live-tag">Live</span> : null}{label}{muted ? " · muted — unmute in the player" : ""}
        </span>
        <strong>{item.title}</strong>
        <span className="video-desk-player-actions">
          <a href={item.watchUrl} target="_blank" rel="noreferrer">{item.live ? "Watch live" : "Watch"} on {platformName(item.platform)} ↗</a>
          {onPopOut && !docked ? <button type="button" onClick={() => onPopOut(reachedRef.current)}>Pop out ⧉</button> : null}
          {actions}
          {onClose ? <button type="button" onClick={onClose}>Close video</button> : null}
        </span>
      </figcaption>
    </figure>
  );
}

function VideoCarousel({ items, selectedKey, dockedKey, channelName, onSelect, onPopOut }: {
  items: DeskItem[];
  selectedKey?: string;
  dockedKey?: string;
  channelName: (channelId: string) => string;
  onSelect: (item: DeskItem) => void;
  onPopOut: (item: DeskItem) => void;
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });
  const scroll = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direction * Math.max(track.clientWidth * 0.8, 240), behavior: reduceMotion ? "auto" : "smooth" });
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Snapping and the track's padding can leave it a few pixels from either edge.
        const atStart = track.scrollLeft <= 8;
        const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
        setEdges((current) => (current.atStart === atStart && current.atEnd === atEnd ? current : { atStart, atEnd }));
      });
    };
    measure();
    track.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [items.length]);

  const fits = edges.atStart && edges.atEnd;

  return (
    <div className={`video-desk-carousel${fits ? " video-desk-carousel-fits" : ""}`}>
      <button type="button" className="ad-carousel-arrow" onClick={() => scroll(-1)} disabled={edges.atStart} hidden={fits} aria-label="Previous videos"><span aria-hidden="true">‹</span></button>
      <ul ref={trackRef} className="video-desk-track" aria-label="Recent videos">
        {items.map((item) => (
          <li key={item.key}>
            <VideoCard
              item={item}
              pressed={item.key === selectedKey || item.key === dockedKey}
              docked={item.key === dockedKey}
              channelName={channelName(item.channelId)}
              onSelect={() => onSelect(item)}
              onPopOut={() => onPopOut(item)}
            />
          </li>
        ))}
      </ul>
      <button type="button" className="ad-carousel-arrow" onClick={() => scroll(1)} disabled={edges.atEnd} hidden={fits} aria-label="More videos"><span aria-hidden="true">›</span></button>
    </div>
  );
}

/** One video or stream: its thumbnail plays it, the corner button pops it out. Its list item holds the pop-out button in place. */
function VideoCard({ item, pressed, docked, channelName, onSelect, onPopOut }: {
  item: DeskItem;
  pressed: boolean;
  docked: boolean;
  channelName: string;
  onSelect: () => void;
  onPopOut: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className={`video-desk-card${item.live ? " video-desk-card-live" : ""}`}
        aria-pressed={pressed}
        aria-label={`${item.live ? "Watch live" : "Play"}: ${item.title} — ${channelName}`}
        onClick={onSelect}
      >
        <span className="video-desk-thumb">
          {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" loading="lazy" /> : null}
          <span className="video-ad-play-icon" aria-hidden="true">▶</span>
          {item.live ? <span className="video-desk-live-tag video-desk-thumb-live">Live</span> : null}
          {item.durationSeconds ? <span className="video-desk-duration">{formatClock(item.durationSeconds)}</span> : null}
          {docked ? <span className="video-desk-docked-tag">In pop-out</span> : null}
        </span>
        <span className="video-desk-card-meta">
          {channelName}
          {item.live ? " · on air now" : item.publishedAt ? <> · <time dateTime={item.publishedAt}>{formatVideoDate(item.publishedAt)}</time></> : null}
        </span>
        <span className="video-desk-card-title">{item.title}</span>
      </button>
      <button
        type="button"
        className="video-desk-card-popout"
        aria-label={`Pop out: ${item.title}`}
        title="Play in the pop-out player"
        onClick={onPopOut}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14zM5 5h6v2H7v10h10v-4h2v6H5z" />
        </svg>
      </button>
    </>
  );
}
