export type VideoPlatform = "youtube" | "vimeo";

export type FeaturedChannel = { id: string; name: string; platform: VideoPlatform; url: string };

export type FeaturedVideo = {
  id: string;
  channelId: string;
  platform: VideoPlatform;
  title: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  watchUrl: string;
  embedUrl: string;
  durationSeconds?: number;
};

export type LiveStream = {
  channelId: string;
  platform: VideoPlatform;
  videoId: string;
  title?: string;
  startedAt?: string;
  watchUrl: string;
  embedUrl: string;
};

/** Live news for the live slot while none of the featured channels is on the air (Newsmax2 for now). */
export type StandbyStream = { channel: FeaturedChannel; stream: LiveStream };

export type FeaturedVideosResponse = {
  channels: FeaturedChannel[];
  videos: FeaturedVideo[];
  live: LiveStream[];
  standby?: StandbyStream;
  fetchedAt: string;
  liveUnchecked?: string[];
  partial?: boolean;
  stale?: boolean;
};

// Players are framed on every page, so only the two providers' player hosts are accepted.
const PLAYER_PREFIXES = ["https://www.youtube-nocookie.com/embed/", "https://player.vimeo.com/video/"];
const isPlayerUrl = (url: unknown) => typeof url === "string" && PLAYER_PREFIXES.some((prefix) => url.startsWith(prefix));

export async function fetchFeaturedVideos(signal?: AbortSignal): Promise<FeaturedVideosResponse> {
  const baseUrl = import.meta.env.VITE_NEWS_API_URL;
  if (!baseUrl) throw new Error("News API is not configured.");
  const response = await fetch(new URL("v1/videos/featured", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`), { signal });
  if (!response.ok) throw new Error("Featured video is unavailable.");
  const data = (await response.json()) as FeaturedVideosResponse;
  const live = (data.live ?? []).filter((stream) => isPlayerUrl(stream.embedUrl));
  const standby = data.standby;
  return {
    ...data,
    channels: data.channels ?? [],
    videos: (data.videos ?? []).filter((video) => isPlayerUrl(video.embedUrl)),
    live,
    standby: !live.length && standby?.channel?.id && standby.channel.id === standby.stream?.channelId && isPlayerUrl(standby.stream.embedUrl) ? standby : undefined,
  };
}
