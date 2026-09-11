import { expect, test } from "@playwright/test";
import { counties, getCounty } from "../../src/data/counties";
import type { PublicNotice, PublicNoticesResponse } from "../../src/lib/public-notices";

function response(slug = "harris", count = 2): PublicNoticesResponse {
  const county = getCounty("texas", slug)!;
  const items: PublicNotice[] = Array.from({ length: count }, (_, i) => ({
    id: `${slug}-${i}`, title: `${county.displayName} ${i ? "regional public hearing" : "budget meeting"} ${i + 1}`,
    url: `https://www.txdot.gov/projects/notice-${i}.html`, sourceId: "government", sourceName: "Official county source",
    countyFips: i ? [county.fips, "48339"] : [county.fips], coverage: i ? "regional" : "county", geographyLabel: i ? `${county.displayName}, Montgomery County` : county.displayName,
    category: i ? "hearing" : "meeting", eventDate: "2026-09-14",
  }));
  return { county: { state: "texas", county: slug, fips: county.fips, displayName: county.displayName }, items,
    sources: [{ id: "county", name: `${county.displayName} official notices`, url: "https://www.harriscountytx.gov/", kind: "government", status: "link-only" }],
    meta: { rollout: "texas", status: "current", count, totalAvailable: count, hasMore: false, offset: 0, checkedAt: "2026-09-11T12:00:00Z", lookbackDays: 90, cacheTtlSeconds: 300 } };
}

test.beforeEach(async ({ page }) => {
  await page.route("**/*tradingview*", route => route.abort());
  await page.route("http://localhost:8787/**", route => route.fulfill({ status: 404, body: "Not included in notice fixture" }));
  await page.route("**/public-notices?*", route => {
    const slug = new URL(route.request().url()).pathname.split("/")[4];
    return route.fulfill({ json: response(slug) });
  });
});

test("shows original notices, county and regional scopes, event dates and working filters", async ({ page }) => {
  await page.goto("/texas/harris/public-notices");
  await expect(page.getByRole("heading", { level: 1, name: "Harris County, Texas Public Notices" })).toBeVisible();
  await expect(page.locator(".notice-card")).toHaveCount(2);
  await expect(page.locator(".notice-date").first()).toHaveText("Meeting / notice date: Sep 14, 2026");
  await expect(page.locator(".notice-card a").first()).toHaveAttribute("href", "https://www.txdot.gov/projects/notice-0.html");
  await page.getByLabel("Notice coverage", { exact: true }).selectOption("regional");
  await expect(page.locator(".notice-card")).toHaveCount(1);
  await expect(page.locator(".notice-card")).toContainText("Harris County, Montgomery County");
  await page.getByLabel("Notice type", { exact: true }).selectOption("meeting");
  await expect(page.getByText("No notices match these filters.")).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://thecountypost.com/texas/harris/public-notices");
});

test("mobile notices remain readable and longer lists can be expanded", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.route("**/public-notices?*", route => route.fulfill({ json: response("harris", 30) }));
  await page.goto("/texas/harris/public-notices");
  await expect(page.locator(".notice-card")).toHaveCount(12);
  await page.getByRole("button", { name: "Show more notices" }).click();
  await expect(page.locator(".notice-card")).toHaveCount(24);
  await page.getByRole("button", { name: "Show more notices" }).click();
  await expect(page.locator(".notice-card")).toHaveCount(30);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("loads additional API pages without repeating notices", async ({ page }) => {
  const offsets: number[] = [];
  await page.route("**/public-notices?*", route => {
    const offset = Number(new URL(route.request().url()).searchParams.get("offset"));
    offsets.push(offset);
    const body = response("harris", 15);
    body.items = offset ? body.items.slice(12) : body.items.slice(0, 12);
    body.meta = { ...body.meta, offset, count: body.items.length, hasMore: !offset };
    return route.fulfill({ json: body });
  });
  await page.goto("/texas/harris/public-notices");
  await page.getByRole("button", { name: "Show more notices" }).click();
  await expect(page.locator(".notice-card")).toHaveCount(15);
  expect(offsets).toEqual([0, 12]);
});

test("rejects another county's response and can retry without affecting news", async ({ page }) => {
  let calls = 0;
  await page.route("**/public-notices?*", route => route.fulfill({ json: response(++calls === 1 ? "bell" : "harris") }));
  await page.goto("/texas/harris/public-notices");
  await expect(page.getByRole("alert")).toContainText("could not be verified for this county");
  await expect(page.locator(".notice-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Retry notices" }).click();
  await expect(page.locator(".notice-card")).toHaveCount(2);
  expect(calls).toBe(2);
});

test("an outage retains source links and never claims that no notices exist", async ({ page }) => {
  const body = response("harris", 0); body.meta.status = "unavailable";
  await page.route("**/public-notices?*", route => route.fulfill({ json: body }));
  await page.goto("/texas/harris/public-notices");
  await expect(page.getByRole("status").filter({ hasText: "Notice feeds are temporarily unavailable" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Harris County official notices" })).toBeVisible();
  await expect(page.getByText("No county-specific notices were found", { exact: false })).toHaveCount(0);
});

test("county home includes notices separately from obituaries", async ({ page }) => {
  await page.goto("/texas/harris");
  const section = page.getByRole("region", { name: "Harris County public notices", exact: true });
  await section.scrollIntoViewIfNeeded();
  await expect(section.locator(".notice-card")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Obituaries", exact: true })).toBeVisible();
  await section.getByRole("link", { name: "View public notices and sources" }).click();
  await expect(page).toHaveURL("/texas/harris/public-notices");
});

test("unconnected states show rollout status and never request Texas data", async ({ page }) => {
  let calls = 0;
  page.on("request", request => { if (request.url().includes("/v1/counties/") && request.url().includes("public-notices")) calls++; });
  await page.goto("/florida/jefferson/public-notices");
  await expect(page.getByText("Sources for Jefferson County, Florida are not connected yet.", { exact: false })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  expect(calls).toBe(0);
});

test("every Texas county has a unique canonical public-notices route", () => {
  const texas = counties.filter(county => county.state.slug === "texas");
  const routes = new Set(texas.map(county => `/${county.state.slug}/${county.slug}/public-notices`));
  expect(routes.size).toBe(254);
  for (const county of texas) expect(getCounty("texas", county.slug)?.fips).toBe(county.fips);
});

test("Market Desk shows the complete count and preview beneath alerts, retaining the section above Politics", async ({ page }) => {
  let noticeRequests = 0;
  const body = response("harris", 2);
  body.meta.totalAvailable = 240;
  body.meta.hasMore = true;
  await page.route("**/public-notices?*", route => { noticeRequests++; return route.fulfill({ json: body }); });
  await page.route("**/v1/counties/texas/harris/weather*", route => route.fulfill({ json: {
    county: { slug: "harris", stateSlug: "texas", fips: "48201" }, location: { city: "Houston" }, zones: {}, forecast: [], hourly: [], warnings: [], meta: { cacheTtlSeconds: 180, alertsCacheTtlSeconds: 180 }, alerts: [{ id: "notice-test-alert", event: "Flood Watch", severity: "Moderate", headline: "Harris County Flood Watch" }],
    droughtCondition: { category: "D1", label: "Moderate Drought", areaPercent: 40, mapDate: "2026-09-08" },
  } }));
  await page.goto("/texas/harris", { waitUntil: "domcontentloaded" });
  const ticker = page.locator(".county-notice-ticker");
  await expect(ticker).toBeVisible();
  await expect(ticker).toContainText("240 public notices");
  await expect(ticker.getByRole("link", { name: /Most recent:/ })).toHaveAttribute("href", body.items[0].url);
  await expect(ticker.locator("time")).toHaveText("Sep 14, 2026");
  await expect(page.locator(".county-weather-alert")).toHaveCount(2);
  expect(await page.evaluate(() => {
    const alerts = [...document.querySelectorAll(".county-weather-alert")];
    const ticker = document.querySelector(".county-notice-ticker")!;
    return alerts.every(alert => Boolean(alert.compareDocumentPosition(ticker) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);
  const bounds = await ticker.boundingBox();
  const cta = ticker.getByRole("link", { name: "See All Harris County Public Notices" });
  const buttonBounds = await cta.boundingBox();
  expect(buttonBounds!.x + buttonBounds!.width).toBeGreaterThan(bounds!.x + bounds!.width - 20);
  expect(bounds!.height).toBeLessThanOrEqual(60);
  await page.locator(".market-weather-stack").screenshot({ path: "coverage/public-notices/market-desk-desktop.png" });
  const section = page.getByRole("region", { name: "Harris County public notices", exact: true });
  await section.scrollIntoViewIfNeeded();
  await expect(section.locator(".notice-card")).toHaveCount(2);
  expect(await section.evaluate(section => {
    const politics = [...document.querySelectorAll("h2")].find(heading => heading.textContent === "Politics");
    return Boolean(politics && section.compareDocumentPosition(politics) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  expect(noticeRequests).toBe(1);
  await cta.click();
  await expect(page).toHaveURL("/texas/harris/public-notices");
});

test("Market Desk count distinguishes empty, unavailable and unconnected county sources", async ({ page }) => {
  const empty = response("harris", 0);
  await page.route("**/public-notices?*", route => route.fulfill({ json: empty }));
  await page.goto("/texas/harris", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".county-notice-ticker")).toContainText("0 public notices");
  await expect(page.locator(".county-notice-ticker")).toContainText("No recent notices in connected sources");
  const unavailable = response("bell", 0); unavailable.meta.status = "unavailable";
  await page.route("**/public-notices?*", route => route.fulfill({ json: unavailable }));
  await page.goto("/texas/bell", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".county-notice-ticker")).toContainText("Notices unavailable");
  await expect(page.locator(".county-notice-ticker")).not.toContainText("0 public notices");
  await page.goto("/florida/jefferson", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".county-notice-ticker")).toContainText("County sources are not connected yet");
});

test("the mobile notice row and ITM logo fit without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  // Amplify's SPA rule sends HTML for uppercase .JPG requests. The logo must
  // be a lowercase asset that actually decodes, not merely an attached <img>.
  await page.route(/\.JPG(?:\?|$)/, route => route.fulfill({ contentType: "text/html", body: "<!doctype html><html></html>" }));
  await page.goto("/texas/harris", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Market desk/ }).click();
  const ticker = page.locator(".county-notice-ticker");
  await expect(ticker).toContainText("2 public notices");
  await ticker.scrollIntoViewIfNeeded();
  const cta = ticker.getByRole("link", { name: "See All Harris County Public Notices" });
  await expect(cta).toBeVisible();
  expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const logo = page.locator(".precious-metals-sponsor img");
  await expect(logo).toHaveAttribute("src", /itm-trading-logo\.jpg/);
  expect(await logo.evaluate(async (img: HTMLImageElement) => { await img.decode(); return img.naturalWidth > 0 && img.naturalHeight > 0; })).toBe(true);
  await page.locator(".market-weather-stack").screenshot({ path: "coverage/public-notices/market-desk-mobile.png" });
});
