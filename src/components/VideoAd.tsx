import { useEffect, useRef, useState } from "react";
import type { AdCreative } from "../data/ads";

/** Load a player only after the reader presses play; stop it when it leaves view. */
export function VideoAd({ ad, className = "", onPlaybackChange }: {
  ad: AdCreative;
  className?: string;
  onPlaybackChange?: (playing: boolean) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onPlaybackChange?.(playing);
    return () => onPlaybackChange?.(false);
  }, [onPlaybackChange, playing]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !playing) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) setPlaying(false);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [playing]);

  if (!ad.video) return null;

  return (
    <div ref={containerRef} className={`video-ad ${className}`} data-ad-id={ad.id}>
      <p className="video-ad-label">Advertisement · {ad.name}</p>
      <div className="video-ad-media">
        {playing ? (
          <iframe
            src={ad.video.embedUrl}
            title={`${ad.name}: ${ad.video.title}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button type="button" className="video-ad-play" onClick={() => setPlaying(true)} aria-label={`Play ${ad.name}: ${ad.video.title}`}>
            <img src={ad.image} alt={ad.alt} loading="lazy" />
            <span className="video-ad-play-icon" aria-hidden="true">▶</span>
          </button>
        )}
      </div>
      <p className="video-ad-title">{ad.video.title}</p>
      <div className="video-ad-actions">
        <a href={ad.href} target="_blank" rel="noreferrer sponsored">Visit {ad.name} ↗</a>
        <a href={ad.video.watchUrl} target="_blank" rel="noreferrer sponsored">Watch on Vimeo ↗</a>
        {playing ? <button type="button" onClick={() => setPlaying(false)}>Close video</button> : null}
      </div>
    </div>
  );
}
