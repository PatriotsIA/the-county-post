import { useSyncExternalStore } from "react";
import type { EmbedController, EmbedState } from "./embed-control";

/** Something the pop-out player can play: a recent upload or a live stream. */
export type MediaItem = {
  key: string;
  live: boolean;
  channelId: string;
  channelName: string;
  platform: string;
  title: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  watchUrl: string;
  /** The provider's embed address; the dock adds its own playback options. */
  embedUrl: string;
};

export type MediaDockState = {
  queue: MediaItem[];
  index: number;
  /** Where the current item starts, so a video popped out of the page carries on. */
  startAt: number;
  /** Bumped on every request to play, so choosing the same item again restarts it. */
  session: number;
  minimized: boolean;
  autoplayNext: boolean;
};

let state: MediaDockState | undefined;
const listeners = new Set<() => void>();

function set(next: MediaDockState | undefined) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useMediaDock() {
  return useSyncExternalStore(subscribe, () => state, () => undefined);
}

/** The item the dock is playing, so the page can step aside for it. */
export function currentDockItem(dock: MediaDockState | undefined) {
  return dock ? dock.queue[dock.index] : undefined;
}

export function popOut(queue: MediaItem[], index: number, startAt = 0) {
  if (!queue[index]) return;
  set({
    queue,
    index,
    startAt: queue[index].live ? 0 : startAt,
    session: (state?.session ?? 0) + 1,
    minimized: false,
    autoplayNext: state?.autoplayNext ?? true,
  });
}

export function playInDock(index: number) {
  if (!state?.queue[index]) return;
  set({ ...state, index, startAt: 0, session: state.session + 1 });
}

export function stepDock(direction: -1 | 1) {
  if (!state) return;
  const index = state.index + direction;
  if (index >= 0 && index < state.queue.length) playInDock(index);
}

export function setDockMinimized(minimized: boolean) {
  if (state) set({ ...state, minimized });
}

export function setDockAutoplayNext(autoplayNext: boolean) {
  if (state) set({ ...state, autoplayNext });
}

export function closeDock() {
  set(undefined);
}

/*
 * Playback, as the player window reports it, and the controls it lends out, so
 * the corner menu can follow and steer the pop-out from anywhere on the site.
 */

type Transport = Pick<EmbedController, "play" | "pause" | "seek" | "setMuted">;

let playback: EmbedState | undefined;
let transport: Transport | undefined;
const playbackListeners = new Set<() => void>();

function subscribePlayback(listener: () => void) {
  playbackListeners.add(listener);
  return () => { playbackListeners.delete(listener); };
}

/** Called by the player window as its state changes, and with nothing when it closes. */
export function reportDockPlayback(next: EmbedState | undefined) {
  playback = next;
  playbackListeners.forEach((listener) => listener());
}

/** The player window hands over its controls; the returned function takes them back. */
export function lendDockTransport(controls: Transport) {
  transport = controls;
  return () => { if (transport === controls) transport = undefined; };
}

export function useDockPlayback() {
  return useSyncExternalStore(subscribePlayback, () => playback, () => undefined);
}

/** Only whether it is playing, so a badge re-renders on play and pause rather than every tick. */
export function useDockPlaying() {
  return useSyncExternalStore(subscribePlayback, () => Boolean(playback?.playing), () => false);
}

/** Whether the current item can be sought: a recording whose length the player has reported. */
export function dockCanSeek() {
  const item = currentDockItem(state);
  return Boolean(item && !item.live && playback?.ready && playback.duration > 0);
}

export function toggleDockPlayback() {
  if (!playback?.ready) return;
  if (playback.playing) transport?.pause();
  else transport?.play();
}

export function skipDock(seconds: number) {
  if (!playback || !dockCanSeek()) return;
  transport?.seek(Math.min(Math.max(0, playback.currentTime + seconds), playback.duration - 1));
}

export function seekDock(seconds: number) {
  if (dockCanSeek()) transport?.seek(seconds);
}

export function setDockMuted(muted: boolean) {
  if (playback?.ready) transport?.setMuted(muted);
}
