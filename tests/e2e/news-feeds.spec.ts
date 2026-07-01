import { expect, test } from "@playwright/test";
import { getCountiesForState, getCounty, getCountyMarketCities } from "../../src/data/counties";
import { states } from "../../src/data/states";

test.beforeEach(async ({ page }) => {
  await page.route("http://localhost:8787/v1/pages/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const limit = Number(requestUrl.searchParams.get("limit") || "24");
    const parts = requestUrl.pathname.split("/").filter(Boolean);
    const scope = parts[2];
    const stateSlug = parts[3] || "";
    const countySlug = parts[4] || "";
    const sections = (requestUrl.searchParams.get("sections") || "")
      .split(",")
      .map((section) => section.trim())
      .filter(Boolean);

    const sectionEntries = sections.map((section) => {
      const topicSlug = topicForSection(section);
      const items = makeRouteItems({ scope, stateSlug, countySlug, topicSlug, limit });
      return [
        section,
        {
          scope: {},
          topic: topicSlug,
          items,
          meta: { count: items.length, sourcesUsed: ["test"], fetchedAt: new Date().toISOString(), cacheTtlSeconds: 300 },
        },
      ];
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        scope: {},
        sections: Object.fromEntries(sectionEntries),
        meta: { count: sectionEntries.length, fetchedAt: new Date().toISOString(), cacheTtlSeconds: 300 },
      }),
    });
  });

  await page.route("http://localhost:8787/v1/feeds/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const limit = Number(requestUrl.searchParams.get("limit") || "24");
    const parts = requestUrl.pathname.split("/").filter(Boolean);
    const scope = parts[2];
    const stateSlug = parts[3] || "";
    const countySlug = parts[4] || "";
    const topicSlug = parts.at(-1) || "general";
    const items = makeRouteItems({ scope, stateSlug, countySlug, topicSlug, limit });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        scope: {},
        topic: topicSlug,
        items,
        meta: { count: items.length, sourcesUsed: ["test"], fetchedAt: new Date().toISOString(), cacheTtlSeconds: 300 },
      }),
    });
  });
});

function topicForSection(section: string) {
  if (section === "localNews") return "general";
  if (section === "localSports") return "sports";
  return section;
}

function makeRouteItems({
  scope,
  stateSlug,
  countySlug,
  topicSlug,
  limit,
}: {
  scope: string;
  stateSlug: string;
  countySlug: string;
  topicSlug: string;
  limit: number;
}) {
  const isObituary = topicSlug === "obituaries";
  const isSports = topicSlug === "sports";
  const isCrime = topicSlug === "crime";
  const isOpinion = topicSlug === "opinion";
  const isBriscoe = countySlug === "briscoe";
  const isArkansas = stateSlug === "arkansas";

  const topic = isObituary ? "Obituary" : isSports ? "Sports" : isCrime ? "Crime" : "Local News";
  return isBriscoe
    ? [
        ...makeItems({ source: "Briscoe County Test", topic, count: Math.min(4, limit), stateLabel: "Texas" }),
        ...makeItems({ source: "Lubbock Daily Test", topic, count: Math.max(0, limit - 4), offset: 4, stateLabel: "Texas" }),
      ]
    : makeItems({
        source: isArkansas ? "Arkansas State Test" : scope === "national" ? "National Test" : "Randall County Test",
        topic,
        count: limit,
        stateLabel: isArkansas ? "Arkansas" : "Texas",
        includeFilteredObituary: !isObituary,
        includeTennesseeOpinion: isOpinion,
      });
}

test("county feeds merge nearby-market stories, sort newest first, filter sections, and load more on scroll", async ({ page }) => {
  await page.goto("/texas/randall");

  await expect(page.getByRole("heading", { name: /Randall County/i })).toBeVisible();
  await expect(page.getByText("Amarillo, TX")).toBeVisible();

  const localSection = page.locator("section", { has: page.getByRole("heading", { name: "Local headlines" }) });
  const localCards = localSection.locator(".feed-card");
  await expect.poll(async () => localCards.count()).toBeGreaterThanOrEqual(16);
  const initialLocalCount = await localCards.count();
  await expect(localCards.first()).toContainText("story 01");
  await expect(localSection).not.toContainText("Obituary notice should be filtered");
  await expect(localCards.first().locator("a")).toHaveAttribute("target", "_blank");
  await expect(localCards.first().locator(".feed-meta")).toContainText("Jun 26, 2026");

  await localSection.locator(".feed-scroll").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect.poll(async () => localCards.count()).toBeGreaterThan(initialLocalCount);

  const obituarySection = page.locator("section", { has: page.getByRole("heading", { name: "Obituaries & public notices" }) });
  await expect(obituarySection.locator(".feed-card").first()).toContainText("Obituary story 01");

  const opinionSection = page.locator("section", { has: page.getByRole("heading", { name: "Opinion & op-eds" }) });
  await expect(opinionSection).not.toContainText("Tennessee op-ed should be filtered");
});

test("state pages populate state headlines from broad in-state feeds", async ({ page }) => {
  await page.goto("/states/arkansas");

  await expect(page.getByRole("heading", { name: /Arkansas/i })).toBeVisible();
  const stateSection = page.locator("section", { has: page.getByRole("heading", { name: "State headlines" }) });
  await expect.poll(async () => stateSection.locator(".feed-card").count()).toBeGreaterThanOrEqual(12);
  await expect(stateSection.locator(".feed-card").first()).toContainText("Arkansas");
  await expect(stateSection.locator(".feed-card").first().locator(".feed-meta")).toContainText("Jun 26, 2026");
});

test("rural counties expand to nearby hubs while keeping county matches first", async ({ page }) => {
  await page.goto("/texas/briscoe");

  await expect(page.getByRole("heading", { name: /Briscoe County/i })).toBeVisible();
  await expect(page.getByText("Amarillo, TX")).toBeVisible();
  await expect(page.getByText(/expands to nearby markets including Amarillo and Lubbock/i).first()).toBeVisible();
  await expect(page.getByText(/Houston Daily Test/)).toHaveCount(0);

  const localSection = page.locator("section", { has: page.getByRole("heading", { name: "Local headlines" }) });
  const localCards = localSection.locator(".feed-card");
  await expect.poll(async () => localCards.count()).toBeGreaterThanOrEqual(16);
  await expect(localCards.first()).toContainText("Briscoe County Test");
  await expect(localSection).toContainText("Lubbock Daily Test");
});

test("one sampled county in every state receives an in-state fallback market", () => {
  for (const state of states) {
    const county = getCountiesForState(state.slug)[0];
    expect(county, `${state.name} should have counties`).toBeTruthy();

    const markets = getCountyMarketCities(county, 2);
    expect(markets.length, `${county.displayName}, ${state.name} should have fallback markets`).toBeGreaterThan(0);
  }

  const briscoe = getCounty("texas", "briscoe");
  expect(briscoe).toBeTruthy();
  expect(getCountyMarketCities(briscoe!, 2)).toEqual(["Amarillo", "Lubbock"]);
});

function makeItems({
  source,
  topic,
  count,
  offset = 0,
  stateLabel,
  includeFilteredObituary = false,
  includeTennesseeOpinion = false,
}: {
  source: string;
  topic: string;
  count: number;
  offset?: number;
  stateLabel: string;
  includeFilteredObituary?: boolean;
  includeTennesseeOpinion?: boolean;
}) {
  return Array.from({ length: count }, (_, index) => {
    const itemNumber = index + offset + 1;
    const date = new Date(Date.UTC(2026, 5, 27 - itemNumber, 12, 0, 0));
    const title =
      index === 2 && includeFilteredObituary
        ? "Obituary notice should be filtered from non-obituary feeds"
        : index === 3 && includeTennesseeOpinion
          ? "Tennessee op-ed should be filtered from Potter County Texas"
          : `${stateLabel} ${topic} story ${String(itemNumber).padStart(2, "0")} from ${source}`;

    return {
      id: `${source}-${topic}-${itemNumber}`,
      title,
      link: `https://example.com/${source.toLowerCase().replace(/\s+/g, "-")}/${topic.toLowerCase().replace(/\s+/g, "-")}/${itemNumber}`,
      source,
      publishedAt: date.toUTCString(),
      description: title,
      imageUrl: "",
    };
  });
}
