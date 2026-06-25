import { site } from "../data/site";
import type { StateSite } from "../data/states";

function googleNewsRssUrl(query: string) {
  const url = new URL(site.links.googleNewsRssSearch);
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");
  return url.toString();
}

export function buildStateFeedUrl(state: StateSite) {
  return googleNewsRssUrl(
    `"${state.name}" OR "${state.name} news" OR "${state.abbr} politics" OR "${state.name} legislature" OR "${state.name} governor"`,
  );
}
