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
