import { useEffect, useId, useState } from "react";
import type { NewsFeedItem } from "../lib/news-api";
import { fetchNewsFeed } from "../lib/rss";
import itmTradingAd from "../../ad-assets/ad-itmtrading.JPG";

const itmTradingFeedUrl = "https://www.youtube.com/feeds/videos.xml?channel_id=UCom1i7_NVeSUNyJyuR_NbMQ";
const rssToJsonUrl = "https://api.rss2json.com/v1/api.json";
const evergreenVideoIds = ["pjlmcqWTPPg", "1CDpb0G3v2g", "QZcVYmEJ9x4"];

type Props = {
  featuredVideoIds?: string[];
};

export function HardAssetsFeed({ featuredVideoIds = evergreenVideoIds }: Props) {
  const [videos, setVideos] = useState<NewsFeedItem[]>([]);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [isOpen, setIsOpen] = useState(true);
  const panelId = useId();

  useEffect(() => {
    let active = true;
    fetchHardAssetsVideos()
      .then((items) => {
        if (!active) return;
        setVideos(items);
        setStatus("loaded");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="section hard-assets-feed">
      <header className="section-heading">
        <div className="section-heading-rule" aria-hidden />
        <div>
          <p className="kicker">ITM Trading video desk</p>
          <h2>Hard Assets</h2>
          <button
            type="button"
            className="feed-collapse-toggle"
            aria-controls={panelId}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((open) => !open)}
          >
            {isOpen ? "Hide stories" : "Show stories"} <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
          </button>
          <a className="hard-assets-sponsor" href="https://www.itmtrading.com/" target="_blank" rel="noreferrer sponsored">
            <span>Presented by</span>
            <img src={itmTradingAd} alt="ITM Trading" />
          </a>
        </div>
        <div className="section-heading-rule" aria-hidden />
      </header>

      <div id={panelId} hidden={!isOpen}>
      {featuredVideoIds.length ? (
        <div className="hard-assets-featured">
          {featuredVideoIds.map((videoId) => (
            <div key={videoId} className="hard-assets-featured-video">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                title="Featured ITM Trading video"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ))}
        </div>
      ) : null}

      {status === "loading" ? <p className="muted">Loading Hard Assets videos…</p> : null}
      {status === "error" ? <p className="muted">Hard Assets videos are unavailable right now.</p> : null}
      {status === "loaded" && !videos.length ? <p className="muted">No Hard Assets videos are available yet.</p> : null}

      {videos.length ? (
        <div className="hard-assets-grid">
          {videos.map((video) => (
            <a key={video.id} className="hard-assets-card" href={video.link} target="_blank" rel="noreferrer">
              <img src={video.imageUrl || youtubeThumbnail(video.link)} alt="" loading="lazy" />
              <span className="hard-assets-title">{video.title}</span>
              <span className="hard-assets-meta">{formatVideoDate(video.publishedAt)}</span>
            </a>
          ))}
        </div>
      ) : null}
      </div>
    </section>
  );
}

async function fetchHardAssetsVideos() {
  const sharedRssItems = await fetchNewsFeed(itmTradingFeedUrl, 50);
  if (sharedRssItems.length) return sharedRssItems;

  // Keep this public YouTube feed independent from any optional RSS provider
  // overrides used by local news feeds.
  const url = new URL(rssToJsonUrl);
  url.searchParams.set("rss_url", itmTradingFeedUrl);
  const response = await fetch(url);
  if (!response.ok) throw new Error("ITM Trading video feed is unavailable.");

  const data = (await response.json()) as {
    items?: Array<{
      guid?: string;
      title?: string;
      link?: string;
      author?: string;
      pubDate?: string;
      thumbnail?: string;
    }>;
  };

  return (data.items || []).map((item, index) => ({
    id: item.guid || item.link || `itm-video-${index}`,
    title: item.title || "ITM Trading video",
    link: item.link || "https://www.youtube.com/@itmtrading/videos",
    source: item.author || "ITM Trading",
    publishedAt: item.pubDate,
    imageUrl: item.thumbnail || youtubeThumbnail(item.link || ""),
    mediaType: "video" as const,
  }));
}

function youtubeThumbnail(link: string) {
  const videoId = new URL(link, "https://www.youtube.com").searchParams.get("v");
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "";
}

function formatVideoDate(value?: string) {
  if (!value) return "ITM Trading";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "ITM Trading";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
