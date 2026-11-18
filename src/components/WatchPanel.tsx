import { useState, type CSSProperties } from "react";
import {
  closeDock, currentDockItem, dockCanSeek, seekDock, setDockMinimized, setDockMuted, skipDock, stepDock, toggleDockPlayback,
  useDockPlayback, useDockPlaying, useMediaDock, type MediaDockState,
} from "../lib/media-dock";
import { desk, formatClock, formatVideoDate, liveChannelNames, onAir, popOutFrom, useFeaturedVideos, type useWatchStatus } from "../lib/featured-videos";
import { MediaIcon, type IconName } from "./MediaDock";

const SKIP_SECONDS = 15;

/**
 * What the corner button shows about video: moving bars while the pop-out
 * plays (still while paused) and a red Live tag while a channel is on the air.
 * The button's own label says the same in words.
 */
export function MediaStatus({ status }: { status: ReturnType<typeof useWatchStatus> }) {
  return (
    <>
      {status.dockOpen ? (
        <span className={`page-jump-bars${status.playing ? " page-jump-bars-playing" : ""}`} aria-hidden="true">
          <i /><i /><i />
        </span>
      ) : null}
      {status.live ? <span className="page-jump-live-tag" aria-hidden="true">Live</span> : null}
    </>
  );
}

/**
 * The menu's Watch section: controls for the pop-out when it is open, then
 * every live stream and recent video, each of which plays in the pop-out.
 * Phones lay the videos out as a row to swipe; desktops as a list.
 */
export function WatchPanel({ layout, onPlay }: { layout: "row" | "column"; onPlay: () => void }) {
  const data = useFeaturedVideos();
  const dock = useMediaDock();
  const current = currentDockItem(dock);
  const queue = data ? desk(data).queue : [];
  const live = data && onAir(data).length ? liveChannelNames(data) : "";

  const choose = (index: number) => {
    const item = queue[index];
    // The one already playing just comes back into view rather than restarting.
    if (item.key === current?.key) setDockMinimized(false);
    else popOutFrom(queue, item);
    onPlay();
  };

  return (
    <section className={`page-jump-watch page-jump-watch-${layout}`} aria-labelledby="page-jump-watch-heading">
      <h2 id="page-jump-watch-heading">
        Watch
        {live ? <span className="page-jump-watch-live"><span className="page-jump-live-tag">Live</span> {live}</span> : null}
      </h2>
      {dock ? <NowPlaying dock={dock} /> : null}
      {queue.length ? (
        <>
          <h3>{dock ? "Play something else" : "Play in the pop-out player"}</h3>
          <ul className="page-jump-videos" aria-label="Live streams and recent videos">
            {queue.map((item, index) => (
              <li key={item.key}>
                <button
                  type="button"
                  aria-current={item.key === current?.key ? "true" : undefined}
                  aria-label={`${item.live ? "Watch live" : "Play"}: ${item.title} — ${item.channelName}`}
                  onClick={() => choose(index)}
                >
                  <span className="page-jump-video-thumb">
                    {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" loading="lazy" /> : null}
                    {item.live ? <span className="page-jump-live-tag">Live</span> : null}
                    {item.durationSeconds ? <span className="page-jump-video-duration">{formatClock(item.durationSeconds)}</span> : null}
                  </span>
                  <span className="page-jump-video-text">
                    <span className="page-jump-video-title">{item.title}</span>
                    <span className="page-jump-video-meta">
                      {item.key === current?.key ? "Now playing · " : ""}
                      {item.channelName}
                      {item.live ? " · on air now" : item.publishedAt ? ` · ${formatVideoDate(item.publishedAt)}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

/** The pop-out's transport, steering the same player wherever the reader is. */
function NowPlaying({ dock }: { dock: MediaDockState }) {
  const playback = useDockPlayback();
  const playing = useDockPlaying();
  const [scrub, setScrub] = useState<number>();
  const item = dock.queue[dock.index];
  const ready = Boolean(playback?.ready);
  const duration = playback?.duration ?? 0;
  const shownTime = scrub ?? playback?.currentTime ?? 0;
  const canSeek = !item.live && ready && duration > 0;
  const commitScrub = () => {
    if (scrub === undefined) return;
    seekDock(scrub);
    setScrub(undefined);
  };

  return (
    <div className="page-jump-now" role="group" aria-label="Pop-out player controls">
      <p className="page-jump-now-kicker">
        {item.live ? <span className="page-jump-live-tag">Live</span> : null}
        <span className="page-jump-now-channel">Now playing · {item.channelName}</span>
        <span className="page-jump-now-position">{dock.index + 1} of {dock.queue.length}</span>
      </p>
      <p className="page-jump-now-title" title={item.title}>{item.title}</p>
      {item.live ? null : (
        <div className="page-jump-now-timeline">
          <span>{formatClock(shownTime)}</span>
          <input
            type="range"
            className="media-dock-scrubber"
            min={0}
            max={Math.max(1, Math.floor(duration))}
            step={1}
            value={Math.min(Math.floor(shownTime), Math.max(1, Math.floor(duration)))}
            disabled={!canSeek || !dockCanSeek()}
            aria-label="Seek"
            aria-valuetext={`${formatClock(shownTime)} of ${formatClock(duration)}`}
            onChange={(event) => setScrub(Number(event.target.value))}
            onPointerUp={commitScrub}
            onKeyUp={commitScrub}
            onBlur={commitScrub}
            style={{ "--progress": `${duration ? (Math.min(shownTime, duration) / duration) * 100 : 0}%` } as CSSProperties}
          />
          <span>{duration ? formatClock(duration) : "--:--"}</span>
        </div>
      )}
      <div className="page-jump-now-controls">
        <Control label="Previous video" icon="previous" onClick={() => stepDock(-1)} disabled={dock.index === 0} />
        <Control label={`Back ${SKIP_SECONDS} seconds`} icon="back" onClick={() => skipDock(-SKIP_SECONDS)} disabled={!canSeek} />
        <Control label={playing ? "Pause" : "Play"} icon={playing ? "pause" : "play"} onClick={toggleDockPlayback} disabled={!ready} primary />
        <Control label={`Forward ${SKIP_SECONDS} seconds`} icon="forward" onClick={() => skipDock(SKIP_SECONDS)} disabled={!canSeek} />
        <Control label="Next video" icon="next" onClick={() => stepDock(1)} disabled={dock.index >= dock.queue.length - 1} />
        <Control label={playback?.muted ? "Unmute" : "Mute"} icon={playback?.muted ? "muted" : "volume"} onClick={() => setDockMuted(!playback?.muted)} disabled={!ready} />
      </div>
      <div className="page-jump-now-window">
        <button type="button" onClick={() => setDockMinimized(!dock.minimized)}>
          <MediaIcon name={dock.minimized ? "expand" : "minimize"} />
          {dock.minimized ? "Expand player" : "Minimize player"}
        </button>
        <button type="button" onClick={closeDock}>
          <MediaIcon name="close" />
          Close player
        </button>
      </div>
    </div>
  );
}

function Control({ label, icon, onClick, disabled, primary }: { label: string; icon: IconName; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      className={`media-dock-button${primary ? " media-dock-button-primary" : ""}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <MediaIcon name={icon} />
    </button>
  );
}
