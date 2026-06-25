import { useEffect, useState } from "react";
import { fetchNewsFeed, type NewsFeedItem } from "../lib/rss";

type Props = {
  title: string;
  feedUrl: string;
  fallbackUrl?: string;
  kicker?: string;
};

export function NewsFeedSection({ title, feedUrl, fallbackUrl, kicker }: Props) {
  const [items, setItems] = useState<NewsFeedItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      setError("");
      try {
        const primary = await fetchNewsFeed(feedUrl);
        if (!cancelled && primary.length) {
          setItems(primary);
          setStatus("loaded");
          return;
        }

        if (fallbackUrl) {
          const fallback = await fetchNewsFeed(fallbackUrl);
          if (!cancelled) {
            setItems(fallback);
            setStatus(fallback.length ? "loaded" : "error");
            if (!fallback.length) {
              setError("No stories found for this feed yet.");
            }
          }
        } else if (!cancelled) {
          setStatus("error");
          setError("No stories found for this feed yet.");
        }
      } catch (reason) {
        if (!cancelled) {
          setStatus("error");
          setError(reason instanceof Error ? reason.message : "Unable to load this feed right now.");
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [feedUrl, fallbackUrl]);

  return (
    <section className="section">
      <header className="section-heading">
        <div className="section-heading-rule" aria-hidden />
        <div>
          {kicker ? <p className="kicker">{kicker}</p> : null}
          <h2>{title}</h2>
        </div>
        <div className="section-heading-rule" aria-hidden />
      </header>
      {status === "error" ? <p className="muted">{error}</p> : null}
      {status === "loading" && !items.length ? <p className="muted">Presses are warming…</p> : null}
      <div className="feed-grid">
        {items.map((item) => (
          <article key={item.id} className="feed-card">
            <div className="feed-card-body">
              <a href={item.link} target="_blank" rel="noreferrer" className="feed-title">
                {item.title}
              </a>
              <p className="feed-meta">
                {item.source ? `${item.source} • ` : ""}
                {formatDate(item.publishedAt)}
              </p>
              {item.description ? <p className="feed-description">{item.description}</p> : null}
            </div>
          </article>
        ))}
      </div>
      {!items.length && status === "loaded" ? <p className="muted">No items available yet.</p> : null}
    </section>
  );
}

function formatDate(value?: string) {
  if (!value) return "Unfiled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unfiled";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}
