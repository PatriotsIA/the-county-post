import { expect, test } from "@playwright/test";

const origin = process.env.VITE_CLASSIFIEDS_ORIGIN || "https://classifieds.thecountypost.com";
/** The tags every County Post link into the marketplace carries: the kind of link and the page it was on. */
const tagged = (url: string, medium: string, page: string) => {
  const target = new URL(url);
  Object.entries({ utm_source: "thecountypost", utm_medium: medium, utm_campaign: "classifieds", utm_content: page }).forEach(([key, value]) => target.searchParams.set(key, value));
  return target.toString();
};
const CLASSIFIEDS_AD = "The County Post Classifieds — buy, sell and find it local, in every county. Free personal listings. Browse listings.";

test("classifieds handoff carries county identity without the legacy submission form", async ({ page }) => {
  await page.goto("/texas/potter/classifieds");
  await expect(page.getByRole("link", { name: "Browse county listings" })).toHaveAttribute("href", tagged(`${origin}/from-county-post/county/48375/`, "link", "/texas/potter/classifieds"));
  await expect(page.getByRole("link", { name: "Post an item for sale" })).toHaveAttribute("href", tagged(`${origin}/from-county-post/county/48375/?action=post`, "link", "/texas/potter/classifieds"));
  await expect(page.getByRole("button", { name: "Submit classified" })).toHaveCount(0);
  await page.goto("/connecticut/hartford/classifieds");
  await expect(page.getByRole("link", { name: "Post an item for sale" })).toHaveAttribute("href", /county\/09003\/\?action=post&utm_source=thecountypost&/);
  await page.goto("/maryland/baltimore-city/classifieds");
  await expect(page.getByRole("link", { name: "Browse county listings" })).toHaveAttribute("href", /county\/24510\/\?utm_source=thecountypost&/);
  await page.goto("/texas");
  await expect(page.getByRole("link", { name: "Browse statewide listings" })).toHaveAttribute("href", tagged(`${origin}/from-county-post/state/48/`, "link", "/texas"));
});

test("the navigation and house ads link to Classifieds at the page's level, tagged with the page they were on", async ({ page }) => {
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  const levels = [
    { path: "/", destination: `${origin}/` },
    { path: "/texas", destination: `${origin}/from-county-post/state/48/` },
    { path: "/texas/potter/weather", destination: `${origin}/from-county-post/county/48375/` },
  ];
  for (const { path, destination } of levels) {
    await page.goto(path);
    const link = nav.getByRole("link", { name: "Classifieds" });
    await expect(link, path).toHaveAttribute("href", tagged(destination, "nav", path));
    // Marked with the Classifieds logo.
    await expect(link.locator("img.nav-link-icon"), path).toHaveAttribute("src", /county-post-classifieds-logo/);
  }

  // The house ads run at every level, linking to that level's marketplace.
  await page.goto("/texas/potter");
  const dismiss = page.getByRole("button", { name: "Dismiss bookmark reminder" });
  if (await dismiss.count()) await dismiss.click();
  // Banner slides carry their alt text only while showing, so find the house banner by its link.
  const banner = page.locator('.ad-banner-slide[href*="utm_campaign=classifieds"]');
  await expect(banner).toHaveAttribute("href", tagged(`${origin}/from-county-post/county/48375/`, "banner-ad", "/texas/potter"));
  await expect(banner).toHaveAttribute("rel", "noopener");
  const square = page.locator(".ad-slot-inline .ad-link").filter({ has: page.getByAltText(CLASSIFIEDS_AD) }).first();
  await expect(square).toHaveAttribute("href", tagged(`${origin}/from-county-post/county/48375/`, "inline-ad", "/texas/potter"));
  // Never the county's masthead sponsor, and not one of the advertisers in the partner directory.
  await expect(page.locator(".masthead .county-sponsor img")).not.toHaveAttribute("alt", CLASSIFIEDS_AD);
  await page.goto("/partners");
  await expect(page.getByAltText(CLASSIFIEDS_AD)).toHaveCount(0);
  await page.goto("/");
  await expect(page.locator('.ad-banner-slide[href*="utm_campaign=classifieds"]')).toHaveAttribute("href", tagged(`${origin}/`, "banner-ad", "/"));
});

test("The County Post Classifieds presents Opinion & op-eds in every edition, linked to that edition's marketplace", async ({ page }) => {
  for (const { path, destination } of [
    { path: "/", destination: `${origin}/` },
    { path: "/texas", destination: `${origin}/from-county-post/state/48/` },
    { path: "/texas/potter", destination: `${origin}/from-county-post/county/48375/` },
  ]) {
    await page.goto(path);
    const sponsor = page.locator('[data-page-jump="Opinion & op-eds"] .feed-sponsor');
    await expect(sponsor, path).toHaveAttribute("href", tagged(destination, "feed-sponsor", path));
    await expect(sponsor.locator("img"), path).toHaveAttribute("src", /county-post-classifieds-logo/);
    await expect(sponsor.locator("img"), path).toHaveAttribute("alt", "The County Post Classifieds");
  }
});
