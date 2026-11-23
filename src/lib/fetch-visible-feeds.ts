import type { NewsFeedItem } from "./news-api";

// Each mounted desk contributes the same filtered records it renders, including RSS.
const desks = new Map<symbol, { path: string; items: NewsFeedItem[] }>();

export function registerVisibleFeed(path: string, items: NewsFeedItem[]) {
  const id = Symbol();
  desks.set(id, { path, items });
  return () => {
    desks.delete(id);
  };
}

export function visibleFeedItems(edition: string, leadOnly = false) {
  const prefix = "/v1/feeds/" + edition + "/";
  return [...desks.values()]
    .filter(({ path }) => (leadOnly ? path === prefix + "general" : path.startsWith(prefix)))
    .flatMap(({ items }) => items)
    .map((item) =>
      item.link.startsWith("/") && !item.link.startsWith("//")
        ? { ...item, link: new URL(item.link, window.location.origin).href }
        : item,
    );
}

export function visibleFeedEditions() {
  return [
    ...new Set([...desks.values()].map(({ path }) => path.slice("/v1/feeds/".length, path.lastIndexOf("/")))),
  ];
}
