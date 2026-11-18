/**
 * Controls a YouTube or Vimeo player frame through the providers' postMessage
 * channels, the same channels their own SDKs use. Loading those SDKs would put
 * more third-party script in our document; these messages keep it in the frame.
 *
 * Only messages from the frame itself, on the provider's own origin, are read.
 */

export type EmbedPlatform = "youtube" | "vimeo";

export type EmbedState = {
  ready: boolean;
  playing: boolean;
  ended: boolean;
  currentTime: number;
  duration: number;
  muted: boolean;
};

export type EmbedController = {
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  setMuted(muted: boolean): void;
  dispose(): void;
};

export const initialEmbedState: EmbedState = { ready: false, playing: false, ended: false, currentTime: 0, duration: 0, muted: false };

const YOUTUBE_ORIGINS = new Set(["https://www.youtube-nocookie.com", "https://www.youtube.com"]);
const VIMEO_ORIGIN = "https://player.vimeo.com";

export function platformOf(embedUrl: string): EmbedPlatform | undefined {
  const { origin } = new URL(embedUrl);
  if (YOUTUBE_ORIGINS.has(origin)) return "youtube";
  if (origin === VIMEO_ORIGIN) return "vimeo";
  return undefined;
}

/** The embed address with the control channel switched on, optionally starting part-way in. */
export function controllableEmbedUrl(embedUrl: string, { startAt = 0, autoplay, muted }: { startAt?: number; autoplay?: boolean; muted?: boolean } = {}) {
  const url = new URL(embedUrl);
  const platform = platformOf(embedUrl);
  const start = Math.max(0, Math.floor(startAt));
  if (autoplay !== undefined) url.searchParams.set("autoplay", autoplay ? "1" : "0");
  if (platform === "youtube") {
    url.searchParams.set("enablejsapi", "1");
    url.searchParams.set("origin", window.location.origin);
    if (muted !== undefined) url.searchParams.set("mute", muted ? "1" : "0");
    if (start) url.searchParams.set("start", String(start));
  } else if (platform === "vimeo") {
    url.searchParams.set("api", "1");
    if (muted !== undefined) url.searchParams.set("muted", muted ? "1" : "0");
    if (start) url.hash = `t=${start}s`;
  }
  return url.toString();
}

function parse(data: unknown): Record<string, unknown> | undefined {
  if (typeof data === "string") {
    try { return JSON.parse(data) as Record<string, unknown>; } catch { return undefined; }
  }
  return data && typeof data === "object" ? (data as Record<string, unknown>) : undefined;
}

/**
 * Whether the frame holds the provider's player yet. Until it does, it is a
 * blank page on our own origin, and a message addressed to the provider is
 * refused with a console error, so nothing is sent before then. Our own page
 * can be read; the provider's cannot, which is how the two are told apart.
 * The handshakes below keep asking until the player is there.
 */
function holdsPlayer(frame: HTMLIFrameElement) {
  const view = frame.contentWindow;
  if (!view) return false;
  try {
    void view.location.href;
    return false;
  } catch {
    return true;
  }
}

export function controlEmbed(frame: HTMLIFrameElement, platform: EmbedPlatform, onChange: (state: EmbedState) => void): EmbedController {
  return platform === "youtube" ? controlYouTube(frame, onChange) : controlVimeo(frame, onChange);
}

/* YouTube: the iframe API's widget channel. ---------------------------- */

const YT_ENDED = 0, YT_PLAYING = 1, YT_BUFFERING = 3;

function controlYouTube(frame: HTMLIFrameElement, onChange: (state: EmbedState) => void): EmbedController {
  let state = { ...initialEmbedState };
  const id = `county-post-${Math.random().toString(36).slice(2)}`;
  const origin = () => new URL(frame.src).origin;
  const post = (message: object) => {
    if (holdsPlayer(frame)) frame.contentWindow?.postMessage(JSON.stringify({ ...message, id, channel: "widget" }), origin());
  };
  const command = (func: string, args: unknown[] = []) => post({ event: "command", func, args });
  const update = (next: Partial<EmbedState>) => { state = { ...state, ...next }; onChange(state); };

  const applyPlayerState = (playerState: number) => {
    if (playerState === YT_PLAYING || playerState === YT_BUFFERING) update({ playing: true, ended: false });
    else update({ playing: false, ended: playerState === YT_ENDED });
  };

  const onMessage = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow || !YOUTUBE_ORIGINS.has(event.origin)) return;
    const message = parse(event.data);
    if (!message) return;
    if (message.event === "onReady" || message.event === "initialDelivery") {
      if (!state.ready) update({ ready: true });
    }
    const info = message.info;
    if (message.event === "onStateChange" && typeof info === "number") applyPlayerState(info);
    if ((message.event === "infoDelivery" || message.event === "initialDelivery") && info && typeof info === "object") {
      const details = info as Record<string, unknown>;
      const next: Partial<EmbedState> = { ready: true };
      if (typeof details.currentTime === "number") next.currentTime = details.currentTime;
      if (typeof details.duration === "number" && details.duration > 0) next.duration = details.duration;
      if (typeof details.muted === "boolean") next.muted = details.muted;
      update(next);
      if (typeof details.playerState === "number") applyPlayerState(details.playerState);
    }
  };

  // The player only reports once it has heard from us; keep asking until it answers.
  const listen = () => post({ event: "listening" });
  const handshake = window.setInterval(() => (state.ready ? window.clearInterval(handshake) : listen()), 250);
  frame.addEventListener("load", listen);
  window.addEventListener("message", onMessage);
  listen();

  return {
    play: () => command("playVideo"),
    pause: () => command("pauseVideo"),
    seek: (seconds) => { command("seekTo", [seconds, true]); update({ currentTime: seconds, ended: false }); },
    setMuted: (muted) => { command(muted ? "mute" : "unMute"); update({ muted }); },
    dispose: () => {
      window.clearInterval(handshake);
      frame.removeEventListener("load", listen);
      window.removeEventListener("message", onMessage);
    },
  };
}

/* Vimeo: the player.js message protocol. -------------------------------- */

const VIMEO_EVENTS = ["timeupdate", "play", "pause", "ended", "loaded", "volumechange"];

function controlVimeo(frame: HTMLIFrameElement, onChange: (state: EmbedState) => void): EmbedController {
  let state = { ...initialEmbedState };
  // Objects, as player.js sends them: a JSON string gets Vimeo's older protocol, whose events differ.
  const post = (method: string, value?: unknown) => {
    if (holdsPlayer(frame)) frame.contentWindow?.postMessage(value === undefined ? { method } : { method, value }, VIMEO_ORIGIN);
  };
  const update = (next: Partial<EmbedState>) => { state = { ...state, ...next }; onChange(state); };

  const subscribe = () => {
    VIMEO_EVENTS.forEach((name) => post("addEventListener", name));
    post("getDuration");
    post("getPaused");
    post("getMuted");
  };

  const onMessage = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow || event.origin !== VIMEO_ORIGIN) return;
    const message = parse(event.data);
    if (!message) return;
    const data = (message.data ?? {}) as Record<string, unknown>;
    switch (message.event) {
      case "ready": update({ ready: true }); subscribe(); return;
      case "timeupdate":
      case "playProgress":
        update({
          ...(typeof data.seconds === "number" ? { currentTime: data.seconds } : {}),
          ...(typeof data.duration === "number" && data.duration > 0 ? { duration: data.duration } : {}),
        });
        return;
      case "play": update({ playing: true, ended: false }); return;
      case "pause": update({ playing: false }); return;
      case "ended":
      case "finish": update({ playing: false, ended: true }); return;
      case "volumechange": if (typeof data.volume === "number") update({ muted: data.volume === 0 }); return;
    }
    switch (message.method) {
      case "getDuration": if (typeof message.value === "number" && message.value > 0) update({ duration: message.value }); return;
      case "getPaused": if (typeof message.value === "boolean") update({ playing: !message.value }); return;
      case "getMuted": if (typeof message.value === "boolean") update({ muted: message.value }); return;
    }
  };

  // Vimeo announces "ready" once; asking for it covers a frame that loaded before we listened.
  const askReady = () => post("ping");
  frame.addEventListener("load", askReady);
  window.addEventListener("message", onMessage);
  askReady();

  return {
    play: () => post("play"),
    pause: () => post("pause"),
    seek: (seconds) => { post("setCurrentTime", seconds); update({ currentTime: seconds, ended: false }); },
    setMuted: (muted) => { post("setMuted", muted); post("setVolume", muted ? 0 : 1); update({ muted }); },
    dispose: () => {
      frame.removeEventListener("load", askReady);
      window.removeEventListener("message", onMessage);
    },
  };
}
