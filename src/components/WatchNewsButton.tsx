import { liveChannelNames, onAir, useFeaturedVideos, useFeaturedVideosUnavailable, watchNewsNow } from "../lib/featured-videos";
import "./WatchNewsButton.css";

/**
 * Watch News Now, in the masthead of every page: it opens the Featured Videos
 * desk with sound and scrolls down to it. It always pulses; a red Live tag
 * joins it while one of the featured channels is on the air. Newsmax2, the
 * stand-in that runs around the clock, does not raise the tag, or it would
 * never come down. Hidden only when the video service has nothing to show.
 */
export function WatchNewsButton() {
  const data = useFeaturedVideos();
  const unavailable = useFeaturedVideosUnavailable();
  if (data ? !data.videos.length && !onAir(data).length : unavailable) return null;
  const live = data?.live.length ? liveChannelNames(data) : "";
  return (
    <button
      type="button"
      className={`watch-news-button${live ? " watch-news-button-live" : ""}`}
      aria-controls="featured-video-panel"
      aria-label={live ? `Watch News Now: ${live} live now, in Featured Videos` : "Watch News Now in Featured Videos"}
      onClick={watchNewsNow}
    >
      <span className="watch-news-play" aria-hidden="true">▶</span>
      <span>Watch News Now</span>
      {live ? <span className="watch-news-live-tag" aria-hidden="true"><span className="watch-news-dot" />Live</span> : null}
    </button>
  );
}
