import { expect, test } from "@playwright/test";

const path = "/op-eds/paxton-rally";
const fullVideo = "https://d2mwhhov0un9j4.cloudfront.net/paxton/big-texan-full-v1.mp4";

test("rally article offers the full recording without downloading it before playback", async ({ page }) => {
  const mediaRequests: string[] = [];
  await page.route("https://d2mwhhov0un9j4.cloudfront.net/**", route => {
    mediaRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto(path, { waitUntil: "domcontentloaded" });
  const article = page.locator("article.editorial-op-ed");
  await expect(article.getByRole("heading", { level: 1 })).toHaveText('Potter County GOP chairman to Paxton rally: "Don\'t spray the kitchen"');
  const video = article.locator("video");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("controls", "");
  await expect(video).toHaveAttribute("playsinline", "");
  await expect(video).toHaveAttribute("preload", "none");
  await expect(video).not.toHaveAttribute("autoplay");
  await expect(video.locator("source")).toHaveAttribute("src", fullVideo);
  await expect(article.getByRole("link", { name: "Open the full video" })).toHaveAttribute("href", fullVideo);
  await expect(article.locator(".editorial-op-ed-body > :first-child")).toHaveClass("editorial-op-ed-video");
  await expect(article.getByRole("heading", { level: 2 })).toHaveText([
    "The ant and the roach", "Why it matters this week", "Before you put the phone down",
  ]);
  await expect(article.getByRole("link", { name: "https://theballotbox.com", exact: true })).toHaveAttribute("href", "https://theballotbox.com");
  await expect(article.locator(".editorial-op-ed-author")).toContainText("Daniel L. Rogers, Publisher");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://thecountypost.com${path}`);
  const schema = await page.locator('script[type="application/ld+json"]').evaluateAll(nodes => nodes.flatMap(node => {
    const data = JSON.parse(node.textContent || "{}");
    return data["@graph"] ?? [data];
  }));
  const story = schema.find(item => item["@type"] === "NewsArticle");
  expect(story.author.name).toBe("Daniel L. Rogers");
  expect(story.articleBody).toContain("Early voting ends Friday, Oct. 30. Election Day is Tuesday, Nov. 3.");
  expect(story.articleBody).not.toContain("## ");
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const box = await video.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(width);
  }
  expect(mediaRequests).toEqual([]);

  await page.goto("/op-eds/potter-county-gop-chairman-paxton-rally-dont-spray-the-kitchen", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://thecountypost.com${path}`);
  await expect(page.getByRole("link", { name: "Watch the full video and learn more", exact: true })).toHaveAttribute("href", "https://patriotsinaction.com/ken-paxton");
  const footerAd = page.getByRole("complementary", { name: "Ken Paxton advertisement" });
  await footerAd.scrollIntoViewIfNeeded();
  await expect(footerAd.getByRole("link")).toHaveAttribute("href", "https://patriotsinaction.com/ken-paxton");
  await expect(footerAd.getByRole("img")).toBeVisible();
  await expect(page.locator("article.editorial-op-ed > :last-child")).toHaveClass("editorial-op-ed-ad");

  // The optional media and heading support must not add a player to older columns.
  await page.goto("/op-eds/enough-about-the-other-guy", { waitUntil: "domcontentloaded" });
  await expect(page.locator("article.editorial-op-ed video")).toHaveCount(0);
  await expect(page.locator(".editorial-op-ed-ad")).toHaveCount(0);
  await expect(page.locator(".editorial-op-ed-body > p").first()).toContainText("Turn on the television.");
});
