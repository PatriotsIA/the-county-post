import { expect, test } from "@playwright/test";

/**
 * SEO regressions are silent: nothing looks broken in the browser when a page
 * loses its canonical or starts reporting the wrong title. These lock in the
 * signals that took the most work to get right.
 */

async function readHead(page: import("@playwright/test").Page) {
  return page.evaluate(() => ({
    title: document.title,
    titleCount: document.querySelectorAll("title").length,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
    descriptionCount: document.querySelectorAll('meta[name="description"]').length,
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
    canonicalCount: document.querySelectorAll('link[rel="canonical"]').length,
    robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "",
    ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? "",
    ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? "",
    staleDefaults: document.querySelectorAll("[data-seo-default]").length,
    jsonLdTypes: [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((node) => {
      const parsed = JSON.parse(node.textContent || "{}");
      return (parsed["@graph"] ?? [parsed]).map((entry: { "@type": string }) => entry["@type"]);
    }),
  }));
}

test("every route carries exactly one title, description, and canonical", async ({ page }) => {
  const routes = ["/", "/states", "/texas", "/texas/lubbock", "/texas/lubbock/weather", "/topics/economy-markets"];

  for (const route of routes) {
    await page.goto(route);
    const meta = await readHead(page);

    expect(meta.titleCount, `${route} title count`).toBe(1);
    expect(meta.descriptionCount, `${route} description count`).toBe(1);
    expect(meta.canonicalCount, `${route} canonical count`).toBe(1);
    expect(meta.description.length, `${route} description length`).toBeGreaterThan(50);
    expect(meta.description.length, `${route} description length`).toBeLessThanOrEqual(160);
    expect(meta.canonical, `${route} canonical host`).toBe(`https://thecountypost.com${route === "/" ? "/" : route}`);
    expect(meta.ogImage, `${route} og:image`).toBe("https://thecountypost.com/social-card.png");
    // index.html ships default tags for crawlers that do not run JavaScript;
    // they must be stripped once React renders the real ones.
    expect(meta.staleDefaults, `${route} leftover static defaults`).toBe(0);
  }
});

test("titles are page-specific and name the county before the masthead", async ({ page }) => {
  // Regression: an imperative `document.title = ...` effect in App used to run
  // after render and overwrite the <title> React hoists from <Seo>, leaving
  // every page reporting either the masthead or a bare county name.
  await page.goto("/texas/lubbock");
  await expect(page).toHaveTitle("Lubbock County, Texas News | The County Post");

  await page.goto("/texas/lubbock/weather");
  await expect(page).toHaveTitle("Lubbock County, Texas Weather | The County Post");

  await page.goto("/");
  await expect(page).toHaveTitle("The County Post — Local News for Every U.S. County");
});

test("utility routes are noindex and content routes are indexable", async ({ page }) => {
  await page.goto("/texas/lubbock/submit");
  expect((await readHead(page)).robots).toBe("noindex, follow");

  await page.goto("/texas/lubbock/classifieds");
  expect((await readHead(page)).robots).toBe("noindex, follow");

  await page.goto("/texas/lubbock");
  expect((await readHead(page)).robots).toContain("index, follow");
});

test("structured data describes each page kind", async ({ page }) => {
  await page.goto("/");
  expect((await readHead(page)).jsonLdTypes).toEqual(expect.arrayContaining(["NewsMediaOrganization", "WebSite"]));

  await page.goto("/texas/lubbock");
  expect((await readHead(page)).jsonLdTypes).toEqual(expect.arrayContaining(["CollectionPage", "AdministrativeArea"]));

  await page.goto("/texas/lubbock/data/demographics");
  expect((await readHead(page)).jsonLdTypes).toEqual(expect.arrayContaining(["Dataset", "BreadcrumbList"]));

  await page.goto("/op-eds/the-data-centers-and-the-rest-of-us");
  expect((await readHead(page)).jsonLdTypes).toEqual(expect.arrayContaining(["NewsArticle", "BreadcrumbList"]));
});

test("counties are reachable by crawlable links, not only by search", async ({ page }) => {
  // Google discovers pages by following <a href>. Before the state county index
  // existed, no anchor on the site pointed at any of the 3,143 county desks —
  // they were reachable only by typing into a search box, which a crawler
  // cannot do.
  await page.goto("/states");
  await expect(page.locator('a[href="/texas"]').first()).toBeVisible();

  await page.goto("/texas");
  const countyLinks = page.locator(".county-index-list a");
  await expect(countyLinks).toHaveCount(254);
  await expect(page.locator('.county-index-list a[href="/texas/lubbock"]')).toHaveCount(1);

  await page.goto("/delaware");
  await expect(page.locator(".county-index-list a")).toHaveCount(3);
});

test("breadcrumbs render the United States to county hierarchy", async ({ page }) => {
  await page.goto("/texas/lubbock/weather");
  const crumbs = page.locator(".breadcrumbs li");
  await expect(crumbs).toHaveCount(4);
  await expect(crumbs.nth(0)).toHaveText("United States");
  await expect(crumbs.nth(1)).toHaveText("Texas");
  await expect(crumbs.nth(2)).toHaveText("Lubbock County");
  await expect(crumbs.nth(3)).toHaveText("Weather");

  // Each crumb above the leaf is a real link, not styled text.
  await expect(crumbs.nth(1).locator("a")).toHaveAttribute("href", "/texas");

  // The front page has no trail to draw.
  await page.goto("/");
  await expect(page.locator(".breadcrumbs")).toHaveCount(0);
});

test("aggregated stories credit the original publisher, not The County Post", async ({ page }) => {
  // A stubbed feed with a known publisher, so the assertion is about how the
  // card presents attribution rather than about whichever story is live.
  // Scoped to the feeds endpoint only: a catch-all on /v1/** would hand this
  // payload to the weather, atlas, and markets calls too and crash the page.
  await page.route("http://localhost:8787/v1/feeds/**", async (route) => {
    const items = [
      {
        id: "wire-1",
        title: "Gold gains as markets await key US inflation data",
        link: "https://www.reuters.com/markets/gold-gains-2026-08-10/",
        source: "Reuters",
        publishedAt: "2026-08-10T14:00:00Z",
        description: "Bullion edged higher ahead of the consumer price index release.",
        categories: ["Markets"],
      },
    ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        scope: {},
        topic: "opinion",
        items,
        meta: { count: items.length, sourcesUsed: ["test"], fetchedAt: new Date().toISOString(), cacheTtlSeconds: 300 },
      }),
    });
  });

  // The national desk applies no county locality filter, so the stub survives
  // to the render and the assertion is about presentation only.
  await page.goto("/op-eds");
  const section = page.locator("section", { has: page.getByRole("heading", { name: "National opinion", exact: true }) });
  const stories = section.locator(".feed-card:not(.feed-ad-card)");

  // The County Post's own op-ed is pinned first and labelled as original work.
  const original = stories.first();
  await expect(original.locator(".feed-publisher")).toHaveText("The County Post \u00b7 Original reporting");
  await expect(original.locator(".feed-origin-link")).toContainText("Read the full story on The County Post");

  // A wire story names Reuters in the eyebrow, the placeholder thumbnail, and
  // the outbound link — never The County Post.
  const wire = stories.filter({ hasText: "Gold gains as markets await" }).first();
  await expect(wire.locator(".feed-publisher")).toHaveText("Reuters");
  await expect(wire.locator(".feed-meta")).toContainText("Published Aug 10, 2026");
  await expect(wire.locator(".feed-origin-link")).toHaveText(/View original story at Reuters/);
  await expect(wire.locator(".feed-source-mark")).toHaveText("Reuters");
  await expect(wire.locator(".feed-publisher")).not.toContainText("County Post");
});
