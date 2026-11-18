import { useSyncExternalStore } from "react";
import { fetchFeaturedVideos, type FeaturedVideosResponse, type LiveStream } from "./videos-api";
import { popOut, useDockPlaying, useMediaDock, type MediaItem } from "./media-dock";

const POLL_MS = 120_000;

/*
 * Shared data: one request and one poll however many desks and menus show it.
 * The corner menu subscribes on every page, so the answer outlives page changes.
 */

let latest: FeaturedVideosResponse | undefined;
// Set once a request has failed before any answer arrived: the service is down rather than slow.
let unavailable = false;
const listeners = new Set<() => void>();
let stopPolling: (() => void) | undefined;

function startPolling() {
  let controller: AbortController | undefined;
  const load = () => {
    if (document.visibilityState === "hidden") return;
    controller?.abort();
    const current = (controller = new AbortController());
    fetchFeaturedVideos(current.signal)
      .then((next) => {
        if (current.signal.aborted) return;
        latest = next;
        unavailable = false;
        listeners.forEach((listener) => listener());
      })
      .catch(() => {
        // Keep the last answer; desks hide if there never was one.
        if (current.signal.aborted || latest || unavailable) return;
        unavailable = true;
        listeners.forEach((listener) => listener());
      });
  };
  load();
  const interval = window.setInterval(load, POLL_MS);
  const onVisibility = () => { if (document.visibilityState === "visible") load(); };
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    controller?.abort();
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) stopPolling = startPolling();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      stopPolling?.();
      stopPolling = undefined;
    }
  };
}

/*
 * The top desk's state, shared so Watch News Now in the masthead can open it
 * from any page. The desk starts open, unless the reader closed it earlier in
 * this visit: that choice holds until they open it again, or a featured
 * channel goes live. `listening` is set by Watch News Now: a reader who asked
 * to watch hears the stream, where a desk that opened by itself stays muted.
 * `reveal` counts presses, each one asking the desk to scroll into view once
 * it is on the page (it may still be loading).
 */
type DeskState = { open: boolean; listening: boolean; reveal: number };
const DESK_CLOSED_KEY = "county-post-video-desk-closed";

function readDeskClosed() {
  try { return window.sessionStorage.getItem(DESK_CLOSED_KEY) === "1"; } catch { return false; }
}

function rememberDeskClosed(closed: boolean) {
  try {
    if (closed) window.sessionStorage.setItem(DESK_CLOSED_KEY, "1");
    else window.sessionStorage.removeItem(DESK_CLOSED_KEY);
  } catch { /* storage blocked: the desk opens again on the next page load */ }
}

let deskState: DeskState = { open: typeof window === "undefined" || !readDeskClosed(), listening: false, reveal: 0 };
const deskListeners = new Set<() => void>();

function updateDesk(next: Partial<DeskState>) {
  deskState = { ...deskState, ...next };
  deskListeners.forEach((listener) => listener());
}

function subscribeDesk(listener: () => void) {
  deskListeners.add(listener);
  return () => { deskListeners.delete(listener); };
}

export function useDeskState() {
  return useSyncExternalStore(subscribeDesk, () => deskState, () => deskState);
}

/** Opens or closes the top desk. Closing it also ends a Watch News Now request for sound. */
export function setDeskOpen(open: boolean) {
  rememberDeskClosed(!open);
  if (open === deskState.open && (open || !deskState.listening)) return;
  updateDesk(open ? { open } : { open, listening: false });
}

/** Watch News Now: opens the top desk with sound and brings it into view. */
export function watchNewsNow() {
  rememberDeskClosed(false);
  updateDesk({ open: true, listening: true, reveal: deskState.reveal + 1 });
}

export function useFeaturedVideos() {
  return useSyncExternalStore(subscribe, () => latest, () => undefined);
}

/** True when the video service has not answered at all, so a page can say so rather than wait. */
export function useFeaturedVideosUnavailable() {
  return useSyncExternalStore(subscribe, () => unavailable, () => false);
}

/* What a desk shows: recent uploads and live streams as one kind of item. */

export const liveKeyOf = (stream: LiveStream) => `${stream.platform}:${stream.videoId}`;
export const platformName = (platform: string) => (platform === "youtube" ? "YouTube" : "Vimeo");

export function liveItem(stream: LiveStream, channelName: string, { withSound }: { withSound: boolean }): MediaItem {
  const embed = new URL(stream.embedUrl);
  // A reader who presses play on a stream expects sound; an unasked autoplay must stay muted.
  if (withSound) { embed.searchParams.delete("mute"); embed.searchParams.delete("muted"); }
  return {
    key: `live:${liveKeyOf(stream)}`,
    live: true,
    channelId: stream.channelId,
    channelName,
    platform: stream.platform,
    title: stream.title || `${channelName} live stream`,
    publishedAt: stream.startedAt,
    thumbnailUrl: stream.platform === "youtube" ? `https://i.ytimg.com/vi/${stream.videoId}/hqdefault.jpg` : undefined,
    watchUrl: stream.watchUrl,
    embedUrl: embed.toString(),
  };
}

/**
 * What is on the air: the featured channels' live streams or, while none of
 * them is live, the stand-in news stream. Only the featured channels' own
 * streams open the desk by themselves; the stand-in just fills the live slot.
 */
export function onAir(data: FeaturedVideosResponse): LiveStream[] {
  return data.live.length ? data.live : data.standby ? [data.standby.stream] : [];
}

/** The featured channels, plus the stand-in's while it is on the air: whom the desk credits. */
export function creditedChannels(data: FeaturedVideosResponse) {
  return data.standby && !data.live.length ? [...data.channels, data.standby.channel] : data.channels;
}

/** Everything a desk offers, live streams first: what the pop-out player works through. */
export function desk(data: FeaturedVideosResponse) {
  const channels = creditedChannels(data);
  const channelName = (channelId: string) => channels.find((channel) => channel.id === channelId)?.name ?? "";
  const videos = data.videos.map((video): MediaItem => ({ ...video, key: `${video.platform}:${video.id}`, live: false, channelName: channelName(video.channelId) }));
  const queue = [...onAir(data).map((stream) => liveItem(stream, channelName(stream.channelId), { withSound: true })), ...videos];
  return { channelName, videos, queue };
}

/** The channels on the air, named once each: "ITM Trading & Patriots in Action TV". */
export function liveChannelNames(data: FeaturedVideosResponse) {
  const { channelName } = desk(data);
  return [...new Set(onAir(data).map((stream) => channelName(stream.channelId)))].join(" & ");
}

/** What the corner button tells readers about video: whether the pop-out is open and playing, and who is on the air. */
export function useWatchStatus() {
  const data = useFeaturedVideos();
  const dockOpen = Boolean(useMediaDock());
  const playing = useDockPlaying();
  return { dockOpen, playing, live: data && onAir(data).length ? liveChannelNames(data) : "" };
}

/** Plays an item in the pop-out, carrying on from `startAt` seconds. */
export function popOutFrom(queue: MediaItem[], item: MediaItem, startAt = 0) {
  const index = queue.findIndex((entry) => entry.key === item.key);
  popOut(index >= 0 ? queue : [item, ...queue], Math.max(0, index), startAt);
}

/** 754 → "12:34"; 3754 → "1:02:34". */
export function formatClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** "Nov 12", with the year for anything from another year. */
export function formatVideoDate(value: string) {
  const date = new Date(value);
  const otherYear = date.getFullYear() !== new Date().getFullYear();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(otherYear ? { year: "numeric" } : {}) });
}
