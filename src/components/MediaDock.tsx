import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { controlEmbed, controllableEmbedUrl, initialEmbedState, platformOf, type EmbedController, type EmbedState } from "../lib/embed-control";
import {
  closeDock, dockCanSeek, lendDockTransport, playInDock, reportDockPlayback, setDockAutoplayNext, setDockMinimized, setDockMuted,
  skipDock, stepDock, toggleDockPlayback, useMediaDock, type MediaDockState,
} from "../lib/media-dock";
import { formatClock, platformName } from "../lib/featured-videos";
import "./MediaDock.css";

const LAYOUT_KEY = "county-post-media-dock-layout";
const EDGE = 8;
// 356 px keeps a 16:9 player 200 px tall, YouTube's smallest allowed.
const MIN_WIDTH = 356;
const MAX_WIDTH = 760;
const DEFAULT_WIDTH = 400;
const SKIP_SECONDS = 15;

type Layout = { x: number; y: number; width: number };

function readLayout(): Partial<Layout> {
  try {
    const saved = JSON.parse(window.localStorage.getItem(LAYOUT_KEY) || "{}") as Partial<Layout>;
    return Object.fromEntries(Object.entries(saved).filter(([, value]) => typeof value === "number" && Number.isFinite(value)));
  } catch {
    return {};
  }
}

function saveLayout({ x, y, width }: Layout) {
  try { window.localStorage.setItem(LAYOUT_KEY, JSON.stringify({ x, y, width })); } catch { /* storage blocked: the dock forgets its place */ }
}

const maxWidth = () => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth - EDGE * 2));
const clampWidth = (width: number) => Math.min(maxWidth(), Math.max(Math.min(MIN_WIDTH, maxWidth()), width));

type Size = { width: number; height: number };

function clampPosition(layout: Layout, size: Size): Layout {
  return clearCornerButton({
    ...layout,
    x: Math.min(Math.max(EDGE, layout.x), Math.max(EDGE, window.innerWidth - size.width - EDGE)),
    y: Math.min(Math.max(EDGE, layout.y), Math.max(EDGE, window.innerHeight - size.height - EDGE)),
  }, size);
}

/** Buttons stacked in the lower-right corner: Jump to, and the Fetch guide above it where the guide runs. */
const CORNER_BUTTONS = ".page-jump-toggle, .fetch-launcher";

/**
 * The corner buttons are how readers reach the site and these controls from
 * anywhere, so the window never settles over them: one that would sits just above.
 * (On a screen too short for that, the buttons stay on top of the window.)
 */
function clearCornerButton(layout: Layout, size: Size): Layout {
  const buttons = [...document.querySelectorAll<HTMLElement>(CORNER_BUTTONS)]
    .map((button) => button.getBoundingClientRect())
    .filter((rect) => rect.width);
  if (!buttons.length) return layout;
  const corner = {
    left: Math.min(...buttons.map((rect) => rect.left)),
    right: Math.max(...buttons.map((rect) => rect.right)),
    top: Math.min(...buttons.map((rect) => rect.top)),
    bottom: Math.max(...buttons.map((rect) => rect.bottom)),
  };
  const covers = layout.x < corner.right + EDGE && layout.x + size.width > corner.left - EDGE
    && layout.y < corner.bottom + EDGE && layout.y + size.height > corner.top - EDGE;
  const above = corner.top - EDGE - size.height;
  return covers && above >= EDGE ? { ...layout, y: above } : layout;
}

/**
 * The pop-out player: a window over the page that the reader can drag, resize
 * and minimise, which keeps playing while they move between pages, and which
 * works through a queue of the desk's videos.
 */
export function MediaDock() {
  const dock = useMediaDock();
  return dock ? <Dock dock={dock} /> : null;
}

function Dock({ dock }: { dock: MediaDockState }) {
  const item = dock.queue[dock.index];
  const platform = platformOf(item.embedUrl);
  const dockRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const controllerRef = useRef<EmbedController | undefined>(undefined);
  const [player, setPlayer] = useState<EmbedState>(initialEmbedState);
  const [scrub, setScrub] = useState<number>();
  const [queueOpen, setQueueOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [layout, setLayout] = useState<Layout>(() => {
    const saved = readLayout();
    return { x: saved.x ?? EDGE * 2, y: saved.y ?? Number.NaN, width: clampWidth(saved.width ?? DEFAULT_WIDTH) };
  });
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // Started by the reader, so it plays with sound; a stream it came from may have been muted.
  const src = useMemo(
    () => controllableEmbedUrl(item.embedUrl, { startAt: dock.startAt, autoplay: true, muted: false }),
    [item.embedUrl, dock.startAt],
  );
  // A new session reloads the frame even for the same address, so choosing an item again restarts it.
  const frameKey = `${dock.session}:${src}`;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !platform) return;
    setPlayer(initialEmbedState);
    setScrub(undefined);
    const controller = controlEmbed(frame, platform, setPlayer);
    controllerRef.current = controller;
    const takeBack = lendDockTransport(controller);
    return () => { takeBack(); controller.dispose(); controllerRef.current = undefined; };
  }, [frameKey, platform]);

  // The corner menu follows and steers playback through the shared store.
  useEffect(() => reportDockPlayback(player), [player]);
  useEffect(() => () => reportDockPlayback(undefined), []);

  useEffect(() => {
    if (player.ended && dock.autoplayNext && !item.live) stepDock(1);
  }, [player.ended, dock.autoplayNext, item.live]);

  // First placement (bottom-left) and keeping the window on screen.
  const fit = () => {
    const element = dockRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const current = layoutRef.current;
    const width = clampWidth(current.width);
    const placed = Number.isNaN(current.y) ? { ...current, y: window.innerHeight - rect.height - EDGE * 2 } : current;
    const next = clampPosition({ ...placed, width }, { width: dock.minimized ? rect.width : width, height: rect.height });
    if (next.x !== current.x || next.y !== current.y || next.width !== current.width) setLayout(next);
  };
  const fitRef = useRef(fit);
  fitRef.current = fit;
  useLayoutEffect(fit);
  useEffect(() => {
    const onResize = () => fitRef.current();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const commitLayout = () => saveLayout(layoutRef.current);

  /* Moving and resizing ------------------------------------------------ */

  const startDrag = (event: PointerEvent<HTMLElement>, mode: "move" | "resize") => {
    if (event.button !== 0 || (mode === "move" && (event.target as HTMLElement).closest("button, a"))) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const origin = { ...layoutRef.current };
    const pointer = { x: event.clientX, y: event.clientY };
    setDragging(true);
    const move = (moveEvent: globalThis.PointerEvent) => {
      const rect = dockRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = moveEvent.clientX - pointer.x, dy = moveEvent.clientY - pointer.y;
      setLayout(mode === "move"
        ? clampPosition({ ...origin, x: origin.x + dx, y: origin.y + dy }, rect)
        : { ...origin, width: clampWidth(origin.width + dx) });
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      setDragging(false);
      commitLayout();
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  const nudge = (event: KeyboardEvent<HTMLElement>, mode: "move" | "resize") => {
    const step = event.shiftKey ? 96 : 24;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = dockRef.current?.getBoundingClientRect();
    if (!rect) return;
    const current = layoutRef.current;
    const next = mode === "move"
      ? clampPosition({ ...current, x: current.x + delta[0], y: current.y + delta[1] }, rect)
      : { ...current, width: clampWidth(current.width + delta[0]) };
    setLayout(next);
    saveLayout(next);
  };

  /* Playback ----------------------------------------------------------- */

  const canSeek = !item.live && player.ready && player.duration > 0;
  const togglePlay = toggleDockPlayback;
  const skip = skipDock;
  const commitScrub = () => {
    if (scrub === undefined) return;
    if (dockCanSeek()) controllerRef.current?.seek(scrub);
    setScrub(undefined);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (event.altKey || event.ctrlKey || event.metaKey || target.matches("input, textarea")) return;
    const onControl = target.matches("button, a, [role=slider]");
    switch (event.key) {
      case " ": if (onControl) return; togglePlay(); break;
      case "k": case "K": togglePlay(); break;
      case "j": case "J": skip(-SKIP_SECONDS); break;
      case "l": case "L": skip(SKIP_SECONDS); break;
      case "n": case "N": stepDock(1); break;
      case "p": case "P": stepDock(-1); break;
      case "m": case "M": setDockMuted(!player.muted); break;
      case "Escape": setDockMinimized(!dock.minimized); break;
      default: return;
    }
    event.preventDefault();
  };

  const shownTime = scrub ?? player.currentTime;
  const upNext = dock.queue[dock.index + 1];

  return (
    <aside
      ref={dockRef}
      className={`media-dock${dock.minimized ? " media-dock-minimized" : ""}${dragging ? " media-dock-dragging" : ""}`}
      style={{ left: layout.x, top: Number.isNaN(layout.y) ? undefined : layout.y, bottom: Number.isNaN(layout.y) ? EDGE * 2 : undefined, width: dock.minimized ? undefined : layout.width }}
      aria-label="Pop-out video player"
      onKeyDown={onKeyDown}
    >
      <p className="visually-hidden" aria-live="polite">Now playing: {item.title}, {item.channelName}</p>
      <header
        className="media-dock-bar"
        onPointerDown={(event) => startDrag(event, "move")}
      >
        <span
          className="media-dock-grip"
          role="button"
          tabIndex={0}
          aria-label="Move player. Drag, or use the arrow keys."
          title="Drag to move"
          onKeyDown={(event) => nudge(event, "move")}
        >
          <MediaIcon name="grip" />
        </span>
        <span className="media-dock-heading">
          {item.live ? <span className="media-dock-live">Live</span> : null}
          <span className="media-dock-channel">{item.channelName}</span>
          <span className="media-dock-position">{dock.index + 1} of {dock.queue.length}</span>
        </span>
        <span className="media-dock-window">
          <IconButton label={dock.minimized ? "Expand player" : "Minimize player"} icon={dock.minimized ? "expand" : "minimize"} onClick={() => setDockMinimized(!dock.minimized)} />
          <IconButton label="Close player" icon="close" onClick={closeDock} />
        </span>
      </header>

      <div className="media-dock-stage">
        <div className="media-dock-frame">
          <iframe
            key={frameKey}
            ref={frameRef}
            src={src}
            title={`${item.live ? "Live: " : ""}${item.channelName} — ${item.title}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <div className="media-dock-body">
          <p className="media-dock-title" title={item.title}>{item.title}</p>
          {item.live ? (
            <p className="media-dock-timeline media-dock-timeline-live"><span className="media-dock-live">Live</span> On air now</p>
          ) : (
            <div className="media-dock-timeline">
              <span className="media-dock-time">{formatClock(shownTime)}</span>
              <input
                type="range"
                className="media-dock-scrubber"
                min={0}
                max={Math.max(1, Math.floor(player.duration))}
                step={1}
                value={Math.min(Math.floor(shownTime), Math.max(1, Math.floor(player.duration)))}
                disabled={!canSeek}
                aria-label="Seek"
                aria-valuetext={`${formatClock(shownTime)} of ${formatClock(player.duration)}`}
                onChange={(event) => setScrub(Number(event.target.value))}
                onPointerUp={commitScrub}
                onKeyUp={commitScrub}
                onBlur={commitScrub}
                style={{ "--progress": `${player.duration ? (Math.min(shownTime, player.duration) / player.duration) * 100 : 0}%` } as CSSProperties}
              />
              <span className="media-dock-time">{player.duration ? formatClock(player.duration) : "--:--"}</span>
            </div>
          )}
          <div className="media-dock-controls">
            <IconButton label="Previous video" icon="previous" onClick={() => stepDock(-1)} disabled={dock.index === 0} />
            <IconButton label={`Back ${SKIP_SECONDS} seconds`} icon="back" onClick={() => skip(-SKIP_SECONDS)} disabled={!canSeek} extra />
            <IconButton label={player.playing ? "Pause" : "Play"} icon={player.playing ? "pause" : "play"} onClick={togglePlay} disabled={!player.ready} primary />
            <IconButton label={`Forward ${SKIP_SECONDS} seconds`} icon="forward" onClick={() => skip(SKIP_SECONDS)} disabled={!canSeek} extra />
            <IconButton label="Next video" icon="next" onClick={() => stepDock(1)} disabled={!upNext} />
            <IconButton label={player.muted ? "Unmute" : "Mute"} icon={player.muted ? "muted" : "volume"} onClick={() => setDockMuted(!player.muted)} disabled={!player.ready} />
            <IconButton label={queueOpen ? "Hide queue" : "Show queue"} icon="queue" onClick={() => setQueueOpen(!queueOpen)} pressed={queueOpen} extra />
          </div>
        </div>
      </div>

      {queueOpen && !dock.minimized ? (
        <div className="media-dock-queue">
          <div className="media-dock-queue-head">
            <span>Queue</span>
            <label>
              <input type="checkbox" checked={dock.autoplayNext} onChange={(event) => setDockAutoplayNext(event.target.checked)} />
              Play next automatically
            </label>
          </div>
          <ol>
            {dock.queue.map((entry, index) => (
              <li key={entry.key}>
                <button type="button" aria-current={index === dock.index ? "true" : undefined} onClick={() => playInDock(index)}>
                  <span className="media-dock-queue-thumb">
                    {entry.thumbnailUrl ? <img src={entry.thumbnailUrl} alt="" loading="lazy" /> : null}
                    {entry.live ? <span className="media-dock-live">Live</span> : null}
                  </span>
                  <span className="media-dock-queue-text">
                    <span className="media-dock-queue-title">{entry.title}</span>
                    <span className="media-dock-queue-meta">
                      {index === dock.index ? "Now playing · " : ""}{entry.channelName}
                      {entry.durationSeconds ? ` · ${formatClock(entry.durationSeconds)}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {!dock.minimized ? (
        <footer className="media-dock-foot">
          <a href={item.watchUrl} target="_blank" rel="noreferrer">{item.live ? "Watch live" : "Watch"} on {platformName(item.platform)} ↗</a>
          {upNext ? <span className="media-dock-upnext" title={upNext.title}>Up next: {upNext.title}</span> : null}
          <span
            className="media-dock-resize"
            role="button"
            tabIndex={0}
            aria-label="Resize player. Drag, or use the left and right arrow keys."
            title="Drag to resize"
            onPointerDown={(event) => startDrag(event, "resize")}
            onKeyDown={(event) => nudge(event, "resize")}
          >
            <MediaIcon name="resize" />
          </span>
        </footer>
      ) : null}
    </aside>
  );
}

function IconButton({ label, icon, onClick, disabled, primary, pressed, extra }: {
  label: string;
  icon: IconName;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  pressed?: boolean;
  /** Left out of the minimised bar. */
  extra?: boolean;
}) {
  return (
    <button
      type="button"
      className={`media-dock-button${primary ? " media-dock-button-primary" : ""}${extra ? " media-dock-button-extra" : ""}`}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      <MediaIcon name={icon} />
    </button>
  );
}

export type IconName = "play" | "pause" | "previous" | "next" | "back" | "forward" | "volume" | "muted" | "queue" | "minimize" | "expand" | "close" | "grip" | "resize";

const ICONS: Record<IconName, ReactNode> = {
  play: <path d="M8 5v14l11-7z" />,
  pause: <path d="M6 5h4v14H6zM14 5h4v14h-4z" />,
  previous: <path d="M6 6h2v12H6zM9.5 12l8.5 6V6z" />,
  next: <path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" />,
  back: <><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" /><text x="12" y="15.5" textAnchor="middle" fontSize="6.5" fontWeight="700">15</text></>,
  forward: <><path d="M12 5V2l5 4-5 4V7a5 5 0 1 0 5 5h2a7 7 0 1 1-7-7z" /><text x="12" y="15.5" textAnchor="middle" fontSize="6.5" fontWeight="700">15</text></>,
  volume: <path d="M4 9v6h4l5 4V5L8 9zm11.5 3a3.5 3.5 0 0 0-2-3.2v6.4a3.5 3.5 0 0 0 2-3.2zM13.5 4.3v2.1a6 6 0 0 1 0 11.2v2.1a8 8 0 0 0 0-15.4z" />,
  muted: <path d="M4 9v6h4l5 4V5L8 9zm12.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z" />,
  queue: <path d="M4 6h12v2H4zm0 5h12v2H4zm0 5h8v2H4zm13 0v-5l4 2.5z" />,
  minimize: <path d="M5 17h14v2H5z" />,
  expand: <path d="M5 5h14v14H5zm2 4v8h10V9z" />,
  close: <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z" />,
  grip: <path d="M8 5h2v2H8zm6 0h2v2h-2zM8 11h2v2H8zm6 0h2v2h-2zM8 17h2v2H8zm6 0h2v2h-2z" />,
  resize: <path d="M19 13v6h-6v-2h2.6L13 14.4l1.4-1.4 2.6 2.6V13zM11 9.6 8.4 7H11V5H5v6h2V8.4L9.6 11z" />,
};

/** The player's icons, shared with the corner menu's controls. */
export function MediaIcon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false">{ICONS[name]}</svg>;
}
