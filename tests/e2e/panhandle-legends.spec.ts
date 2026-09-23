import { expect, test } from "@playwright/test";

const videoIds = ["1215218560", "1206153465", "1165499745", "1165499670", "1165499251", "1165499027", "1165498956", "1165498523", "1165498343"];

test.beforeEach(async ({ page }) => {
  await page.route("http://localhost:8787/**", (route) => /\/pages\/|\/feeds\//.test(route.request().url())
    ? route.fulfill({ contentType: "application/json", body: JSON.stringify({ items: [], sections: {}, scope: {}, meta: { count: 0, hasMore: false } }) })
    : route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Outside this fixture" }) }));
  await page.route(/googletagmanager|google-analytics|tradingview|rss2json/, (route) => route.abort());
});

test("dedicated sponsor page shows every video with one canonical and no automatic players", async ({ page }) => {
  for (const path of ["/legends", "/legends/"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: "Panhandle Legends", exact: true })).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator(".legends-video-card")).toHaveCount(9);
    for (const id of videoIds) {
      await expect(page.locator(`.legends-video-card a[href='https://vimeo.com/${id}']`)).toHaveCount(1);
    }
    const decoded = await page.locator(".legends-video-card img").evaluateAll(async (images) => Promise.all(images.map(async (image) => {
      const img = image as HTMLImageElement;
      img.loading = "eager";
      await img.decode();
      return img.naturalWidth > 0 && img.naturalHeight > 0;
    })));
    expect(decoded).toEqual(Array(9).fill(true));
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.locator(".ad-slot")).toHaveCount(0);
    await expect(page.locator(".context-nav")).toHaveCount(0);
    await expect(page.getByText("Featured sponsor · Texas statewide")).toBeVisible();
    await expect(page.getByText("Supporting The County Post’s Texas edition and all 254 Texas county editions.")).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://thecountypost.com/legends");
    await expect(page.locator(".breadcrumbs li").last()).toHaveText("Panhandle Legends");
    const schema = await page.locator('script[type="application/ld+json"]').textContent();
    expect(JSON.parse(schema!)["@graph"].find((item: { "@type": string }) => item["@type"] === "ItemList").numberOfItems).toBe(9);
  }

});

test("partner buttons open the dedicated sponsor page and retain the shop link", async ({ page }) => {
  for (const [directory, destination] of [
    ["/partners", "/legends"],
    ["/texas/randall/partners", "/legends"],
    ["/texas/harris/partners", "/legends"],
  ]) {
    await page.goto(directory);
    const partner = page.locator(".partner-card").filter({ has: page.getByRole("heading", { name: "Panhandle Legends", exact: true }) });
    await expect(partner).toHaveCount(1);
    await expect(partner.getByRole("link", { name: "Visit partner" })).toHaveAttribute("href", "https://shop.patriotsinaction.com/collections/texas-panhandle-legends");
    const button = partner.getByRole("link", { name: "Explore Panhandle Legends" });
    await expect(button).toHaveAttribute("href", destination);
    await button.click();
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
    await expect(page.getByRole("heading", { name: "Panhandle Legends", exact: true })).toBeVisible();
  }
  await page.goto("/arkansas/polk/partners");
  await expect(page.getByRole("heading", { name: "Polk County Partners", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore Panhandle Legends" })).toHaveCount(0);
});

test("Texas navigation leads to the collection and other states do not gain a Legends section", async ({ page }) => {
  for (const [path, target] of [["/texas", "/legends"], ["/texas/potter", "/legends"]]) {
    await page.goto(path);
    const link = page.locator(".context-nav").getByRole("link", { name: "Panhandle Legends", exact: true });
    await expect(link).toHaveAttribute("href", target);
    await link.click();
    await expect(page.getByRole("heading", { name: "Panhandle Legends", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/legends$/);
  }
  for (const path of ["/oklahoma", "/arkansas/polk"]) {
    await page.goto(path);
    await expect(page.locator(".context-nav")).toBeVisible();
    await expect(page.locator(".context-nav").getByRole("link", { name: "Panhandle Legends" })).toHaveCount(0);
  }
  await page.goto("/texas/not-a-county/texas-legends");
  await expect(page.locator(".legends-page")).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
});

test("website and publisher social links are labeled and open the expected destinations", async ({ page }) => {
  await page.goto("/legends");
  const resources = page.locator(".legends-connect");
  for (const [label, href] of [
    ["Patriots in Action TV", "https://vimeo.com/patriotsinactiontv"],
    ["KAMR on Facebook", "https://www.facebook.com/KAMRLOCAL4NEWS/"],
    ["KAMR on X", "https://twitter.com/KAMRLocal4News"],
    ["Texas Panhandle Legends merchandise", "https://shop.patriotsinaction.com/collections/texas-panhandle-legends"],
  ]) {
    const link = resources.getByRole("link").filter({ has: page.getByRole("heading", { name: label }) });
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveAttribute("target", "_blank");
  }
  await expect(page.getByRole("heading", { name: "Watch. Follow. Connect." })).toBeVisible();
});

test("collection and partner button fit a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/legends");
  await expect(page.getByRole("heading", { name: "Panhandle Legends", exact: true })).toBeVisible();
  const overflow = await page.locator(".legends-page").evaluate((element) => [...element.querySelectorAll("section, article, a")].filter(node => {
    const bounds = node.getBoundingClientRect();
    return bounds.left < 0 || bounds.right > innerWidth;
  }).map(node => node.className));
  expect(overflow).toEqual([]);
  await page.locator(".legends-page").screenshot({ path: "test-results/panhandle-legends-mobile.png", animations: "disabled" });
  await page.goto("/texas/harris/partners");
  const button = page.getByRole("link", { name: "Explore Panhandle Legends" });
  await button.scrollIntoViewIfNeeded();
  expect(await button.evaluate(element => { const bounds = element.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth; })).toBe(true);
});


test("legacy statewide and valid county URLs redirect without losing tracking or video anchors", async ({ page }) => {
  for (const path of ["/texas/texas-legends", "/texas/randall/texas-legends", "/texas/harris/texas-legends", "/states/texas/texas-legends", "/states/texas/potter/texas-legends"]) {
    await page.goto(`${path}?utm_source=legacy#legends-videos`);
    await expect(page).toHaveURL(/\/legends\?utm_source=legacy#legends-videos$/);
    await expect(page.getByRole("heading", { name: "Panhandle Legends", exact: true })).toBeVisible();
  }
});
