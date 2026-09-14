import { expect, test, devices, type Page } from "@playwright/test";

async function mockNews(page: Page) {
  await page.route("http://localhost:8787/**", async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.includes("/pages/") && !url.pathname.includes("/feeds/")) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Not part of this fixture" }) });
      return;
    }
    const isTexas = url.pathname.includes("/texas");
    const isCounty = url.pathname.includes("/counties/");
    const countySlug = isCounty ? url.pathname.split("/")[5] : undefined;
    const location = isCounty ? `${countySlug === "harris" ? "Harris" : "Randall"} County, Texas` : isTexas ? "Texas" : "United States";
    const items = Array.from({ length: 24 }, (_, index) => ({
      id: `${url.pathname}-${index}`,
      title: `${location} local news, sports and community report ${index}`,
      link: `https://example.com/report/${index}`,
      source: "Community News",
      contentSnippet: `News from ${location}.`,
      publishedAt: new Date(Date.UTC(2026, 8, 14, 12, 0, 0) - index * 3600000).toISOString(),
    }));
    const feed = { items, scope: {}, meta: { count: items.length, hasMore: false, fetchedAt: new Date().toISOString() } };
    const body = url.pathname.includes("/pages/")
      ? { sections: Object.fromEntries((url.searchParams.get("sections") || "general").split(",").map((section) => [section, feed])), scope: {}, meta: feed.meta }
      : url.pathname.includes("/feeds/") ? feed : {};
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.route(/googletagmanager|google-analytics|tradingview|rss2json/, (route) => route.abort());
}

test.beforeEach(async ({ page }) => { await mockNews(page); });

test("Texas advertiser targeting covers all 254 counties and excludes other editions", async ({ page }) => {
  await page.goto("/partners");
  const result = await page.evaluate(async () => {
    const paths = ["/src/data/ads.ts", "/src/data/partners.ts", "/src/data/counties.ts"];
    const [adData, partnerData, countyData] = await Promise.all(paths.map((path) => import(path)));
    const texas = countyData.getCountiesForState("texas");
    const otherCounties = countyData.counties.filter((county: { state: { slug: string } }) => county.state.slug !== "texas");
    const hasGear = (key?: string) => adData.getAdsForSlot("inline", key).some((ad: { name: string }) => ad.name === "Guerrilla Gear");
    const videoCount = (key?: string) => adData.getAdsForSlot("inline", key).filter((ad: { video?: unknown }) => ad.video).length;
    return {
      texasCount: texas.length,
      statewide: hasGear("texas"),
      everyTexasCounty: texas.every((county: { slug: string }) => hasGear(`texas/${county.slug}`) && partnerData.getPartnersForCounty(`texas/${county.slug}`).some((ad: { name: string }) => ad.name === "Guerrilla Gear")),
      noOtherCounty: otherCounties.every((county: { state: { slug: string }; slug: string }) => !hasGear(`${county.state.slug}/${county.slug}`)),
      national: hasGear(),
      removed: adData.ads.filter((ad: { name: string }) => /Pasture Exchange|PestCon/.test(ad.name)).length,
      partnerPageCount: partnerData.getCountyPartnerPageKeys().length,
      scopedRealty: [undefined, "texas", "texas/randall", "texas/potter", "texas/harris"].map((key) => adData.getAdsForSlot("inline", key).some((ad: { id: string }) => ad.id === "lori-horner-inline")),
      everyTexasCountyHasVideos: texas.every((county: { slug: string }) => videoCount(`texas/${county.slug}`) === 3),
      noVideosElsewhere: !videoCount() && !videoCount("arkansas") && otherCounties.every((county: { state: { slug: string }; slug: string }) => !videoCount(`${county.state.slug}/${county.slug}`)),
      videosCannotSponsor: adData.ads.filter((ad: { video?: unknown }) => ad.video).every((ad: unknown) => !adData.canSponsorFeed(ad)),
      onePanhandlePartner: partnerData.getPartnerCreatives().filter((ad: { name: string }) => ad.name === "Panhandle Legends").length,
      everyTexasCountyHasPartner: texas.every((county: { slug: string }) => partnerData.getPartnersForCounty(`texas/${county.slug}`).some((ad: { name: string }) => ad.name === "Panhandle Legends")),
    };
  });
  expect(result).toEqual({ texasCount: 254, statewide: true, everyTexasCounty: true, noOtherCounty: true, national: false, removed: 0, partnerPageCount: 254, scopedRealty: [false, false, true, true, false], everyTexasCountyHasVideos: true, noVideosElsewhere: true, videosCannotSponsor: true, onePanhandlePartner: 1, everyTexasCountyHasPartner: true });
  await expect(page.getByRole("heading", { name: "Guerrilla Gear", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Panhandle Legends", exact: true })).toHaveCount(1);
  await page.goto("/texas/harris/partners");
  await expect(page.getByRole("heading", { name: "Guerrilla Gear", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Panhandle Legends", exact: true })).toHaveCount(1);
  await page.goto("/arkansas/polk/partners");
  await expect(page.getByRole("heading", { name: "Guerrilla Gear", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Panhandle Legends", exact: true })).toHaveCount(0);
});

test("Panhandle videos occur in Texas feeds and carousels without loading players or becoming sponsors", async ({ page }) => {
  for (const path of ["/texas", "/texas/randall", "/texas/harris"]) {
    await page.goto(path);
    await expect(page.locator(".ad-slot-inline").first().locator(".video-ad")).toHaveCount(3);
    await expect(page.locator(".feed-video-card").first()).toBeAttached();
    await expect(page.locator("iframe[src*='player.vimeo.com']")).toHaveCount(0);
    await expect(page.locator(".feed-sponsor img[alt*='Panhandle'], .county-sponsor img[alt*='Panhandle']")).toHaveCount(0);
    const videos = await page.locator(".feed-video-card").count();
    const ads = await page.locator(".feed-ad-card").count();
    expect(videos).toBeLessThan(ads / 2);
    await expect(page.getByRole("img", { name: /Pasture Exchange|PestCon/ })).toHaveCount(0);
  }
  for (const path of ["/", "/arkansas", "/arkansas/polk"]) {
    await page.goto(path);
    await expect(page.locator(".ad-slot-inline").first()).toBeAttached();
    await expect(page.locator(".video-ad")).toHaveCount(0);
  }
});

test("video carousel waits during playback and stops an offscreen player", async ({ page }) => {
  await page.clock.install();
  await page.route("https://player.vimeo.com/video/**", (route) => route.fulfill({ contentType: "text/html", body: "<html><body>Video player fixture</body></html>" }));
  await page.goto("/texas");
  const video = page.locator(".ad-slot-inline .video-ad").first();
  await video.getByRole("button", { name: /^Play Panhandle Legends:/ }).click();
  await expect(video.locator("iframe")).toHaveAttribute("src", /player\.vimeo\.com\/video\/1215218560\?autoplay=1/);
  const track = page.locator(".ad-slot-inline .ad-slot-items");
  const scrollLeft = await track.evaluate((element) => element.scrollLeft);
  await page.clock.fastForward(21000);
  await expect(video.locator("iframe")).toHaveCount(1);
  expect(await track.evaluate((element) => element.scrollLeft)).toBe(scrollLeft);
  await page.screenshot({ path: "test-results/panhandle-carousel.png" });
  await track.evaluate((element) => element.scrollTo({ left: 0, behavior: "instant" }));
  await expect(video.locator("iframe")).toHaveCount(0);
});

test("bookmark reminder appears nationally and by county, dismisses for the session, and reopens", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByRole("complementary", { name: "Bookmark The County Post", exact: true });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Bookmark nationwide homepage" }).click();
  await expect(prompt.getByText("Press Ctrl+D", { exact: false })).toBeVisible();
  await prompt.getByRole("button", { name: "Dismiss bookmark reminder" }).click();
  await page.reload();
  await expect(prompt).toHaveCount(0);
  await page.getByRole("button", { name: "Bookmark / Add web app" }).click();
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Not now" }).click();
  await page.goto("/texas/randall");
  await expect(page.getByRole("complementary", { name: "Bookmark Randall County", exact: true })).toBeVisible();
});

test("iPhone Home Screen instructions and county reminder fit a narrow phone", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 320, height: 640 } });
  const page = await context.newPage();
  await mockNews(page);
  await page.goto(baseURL!);
  const prompt = page.locator(".bookmark-toast");
  await expect(prompt.getByRole("heading", { name: "Add Our Web App To Your Phone" })).toBeVisible();
  await prompt.getByRole("button", { name: "Add to iPhone / iPad Home Screen" }).click();
  await expect(prompt.getByText("Open as Web App", { exact: true })).toBeVisible();
  await expect(prompt.getByRole("button", { name: "Add to Android Home Screen" })).toHaveCount(0);
  expect(await prompt.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight && element.scrollWidth <= element.clientWidth;
  })).toBe(true);
  await page.screenshot({ path: "test-results/bookmark-iphone.png" });
  await context.close();
});

test("Android uses the browser install prompt once and handles cancellation", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36" }));
  await page.goto("/");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, { prompt: async () => {
      document.documentElement.dataset.installPromptCalls = String(Number(document.documentElement.dataset.installPromptCalls || 0) + 1);
      return { outcome: "dismissed" };
    } });
    window.dispatchEvent(event);
    document.documentElement.dataset.installPromptPrevented = String(event.defaultPrevented);
  });
  const prompt = page.locator(".bookmark-toast");
  await prompt.getByRole("button", { name: "Add to Android Home Screen" }).click();
  await expect(prompt.getByRole("status")).toContainText("Installation canceled");
  await expect(page.locator("html")).toHaveAttribute("data-install-prompt-calls", "1");
  await expect(page.locator("html")).toHaveAttribute("data-install-prompt-prevented", "true");
  await prompt.getByRole("button", { name: "Add to Android Home Screen" }).click();
  await expect(prompt.getByText("On your Android phone:", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-install-prompt-calls", "1");
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(prompt.getByRole("heading", { name: "Add Our Web App To Your Phone" })).toHaveCount(0);
});

test("installed mode suppresses the automatic prompt and blocked storage still allows dismissal", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Bookmark / Add web app" })).toBeAttached();
  await expect(page.locator(".bookmark-toast")).toHaveCount(0);
  await page.getByRole("button", { name: "Bookmark / Add web app" }).click();
  await expect(page.getByText("County Post is installed on this device.", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(window, "sessionStorage", { get() { throw new Error("Storage unavailable"); } });
  });
  await page.getByRole("button", { name: "Dismiss bookmark reminder" }).click();
  await expect(page.locator(".bookmark-toast")).toHaveCount(0);
});
