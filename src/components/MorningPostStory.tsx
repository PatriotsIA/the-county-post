import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Seo } from "./Seo";
import { NewsFeedSection } from "./NewsFeedSection";
import { LoadingIndicator } from "./LoadingIndicator";
import { getCounty } from "../data/counties";
import { getStateBySlug } from "../data/states";
import { fetchMorningPostStory, type MorningPostStory } from "../lib/newsletter-api";
import { buildCountyFallbackFeedUrls, buildNationalFallbackFeedUrls, buildStateFallbackFeedUrls } from "../lib/fallback-feed-urls";
import type { Topic } from "../lib/news-api";

// The desks The Morning Post draws from (newsletter/src/content.ts).
const STORY_TOPICS: Topic[] = ["general", "sports", "obituaries", "politics", "economy", "crime"];

type StoryState = { status: "loading" } | { status: "loaded"; story: MorningPostStory } | { status: "error"; message: string };

/**
 * A Morning Post story on The County Post. Each story was reported by another
 * publisher, so the page credits them, links to the full article and carries no
 * article structured data; it is noindex like other utility routes.
 */
export function MorningPostStoryPage() {
  const { stateSlug, countySlug, storyId = "" } = useParams<{ stateSlug?: string; countySlug?: string; storyId: string }>();
  const state = stateSlug ? getStateBySlug(stateSlug) : undefined;
  const county = state && countySlug ? getCounty(state.slug, countySlug) : undefined;
  const validEdition = countySlug ? Boolean(county) : stateSlug ? Boolean(state) : true;
  const level = county ? "county" : state ? "state" : "national";
  const editionName = county ? `${county.displayName}, ${county.state.name}` : state?.name ?? "National";
  const editionPath = county ? `/${county.state.slug}/${county.slug}` : state ? `/${state.slug}` : "/";
  // Edition pages carry their h1 in the masthead; only the national page has none.
  const Heading = level === "national" ? "h1" : "h2";
  const [result, setResult] = useState<StoryState>({ status: "loading" });
  const [imageAvailable, setImageAvailable] = useState(true);

  useEffect(() => {
    if (!validEdition || !/^[a-f0-9]{20}$/.test(storyId)) {
      setResult({ status: "error", message: "This story is no longer available." });
      return;
    }
    const controller = new AbortController();
    setResult({ status: "loading" });
    setImageAvailable(true);
    fetchMorningPostStory(storyId, controller.signal)
      .then((story) => {
        // A story page belongs to the edition that emailed it.
        const sameEdition = story.edition.level === level && story.edition.state === state?.slug && story.edition.county === county?.slug;
        setResult(sameEdition && STORY_TOPICS.includes(story.topic as Topic)
          ? { status: "loaded", story }
          : { status: "error", message: "This story is no longer available." });
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setResult({ status: "error", message: error.message });
      });
    return () => controller.abort();
  }, [storyId, validEdition, level, state?.slug, county?.slug]);

  if (result.status !== "loaded") {
    return (
      <div className="layout-grid">
        <Seo title="Morning Post story" description="A story from The Morning Post, The County Post's free daily newsletter." policy="morningPostStory" />
        <section className="card editorial-op-ed morning-post-story">
          {result.status === "loading" ? (
            <LoadingIndicator label="Loading story" />
          ) : (
            <>
              <p className="kicker">The Morning Post</p>
              <Heading>{result.message}</Heading>
              <p>Stories from The Morning Post stay here for 90 days.</p>
              <Link className="button-link" to={editionPath}>
                {county ? `${county.displayName} news` : state ? `${state.name} news` : "Today's news"} →
              </Link>
            </>
          )}
        </section>
      </div>
    );
  }

  const { story } = result;
  const topic = story.topic as Topic;
  const host = new URL(story.link).hostname.replace(/^www\./, "");
  const published = new Date(story.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="layout-grid">
      <Seo
        title={story.title}
        description={story.description ?? `${story.title}, reported by ${story.source}.`}
        policy="morningPostStory"
        image={story.imageUrl}
      />
      <article className="card editorial-op-ed morning-post-story">
        <header className="editorial-op-ed-header">
          <p className="kicker">
            {story.deskTitle} · {editionName}
          </p>
          <Heading>{story.title}</Heading>
          <p className="editorial-op-ed-byline">
            Reported by {story.source} · {published}
          </p>
        </header>
        <div className="editorial-op-ed-body">
          {story.imageUrl && imageAvailable ? (
            <img className="morning-post-story-image" src={story.imageUrl} alt="" onError={() => setImageAvailable(false)} />
          ) : null}
          {story.description ? <p>{story.description}</p> : null}
          <a className="button-link morning-post-story-read" href={story.link} target="_blank" rel="noreferrer">
            Read the full story at {story.source} →
          </a>
          <p className="editorial-op-ed-author">
            Reported by {story.source}. The full article is on {host}. This story appeared in{" "}
            <Link to="/morning-post">The Morning Post</Link>, The County Post's free daily newsletter.
          </p>
        </div>
      </article>
      <NewsFeedSection
        title={`More ${story.deskTitle.toLowerCase()}`}
        kicker={`${editionName} desk`}
        apiPath={county ? `/v1/feeds/counties/${county.state.slug}/${county.slug}/${topic}` : state ? `/v1/feeds/states/${state.slug}/${topic}` : `/v1/feeds/national/${topic}`}
        fallbackFeedUrls={county ? buildCountyFallbackFeedUrls(county, topic) : state ? buildStateFallbackFeedUrls(state, topic) : buildNationalFallbackFeedUrls(topic)}
        pageSize={6}
        kind={topic}
        locality={county
          ? { countyName: county.name, countyDisplayName: county.displayName, stateName: county.state.name, stateAbbr: county.state.abbr, strict: true }
          : state ? { stateName: state.name, stateAbbr: state.abbr, strict: true } : undefined}
        actionLink={{ to: `${editionPath}#desk-${topic}`, label: `${story.deskTitle} desk` }}
      />
    </div>
  );
}
