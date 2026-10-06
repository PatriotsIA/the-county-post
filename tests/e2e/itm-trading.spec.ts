import { expect, test } from "@playwright/test";

const fixture = {
  currency: "USD", unit: "troy oz", updatedAt: "2026-10-01T16:20:00Z",
  provider: { name: "Minted Metal", url: "https://mintedmetal.com" },
  items: [
    { key: "gold", label: "Gold", price: 3000, previousPrice: 2900, fixedAt: "2026-09-30T15:00:00Z", sourceLabel: "London PM Fix" },
    { key: "silver", label: "Silver", price: 30, previousPrice: 30, fixedAt: "2026-09-30T12:00:00Z" },
    { key: "platinum", label: "Platinum", price: 1000, previousPrice: 1020 },
    { key: "palladium", label: "Palladium", price: 900 },
  ],
};

const tickerScriptUrl = "https://widgets.tradingview-widget.com/w/en/tv-ticker-tape.js";
const tickerModule = 'customElements.define("tv-ticker-tape", class extends HTMLElement {});';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-01T18:00:00Z"));
  await page.route("https://**", route => route.abort());
  await page.route("http://localhost:8787/**", route => route.fulfill({ status: 503, json: { error: "Not in fixture" } }));
  await page.route("http://localhost:8787/v1/markets/metals", route => route.fulfill({ json: fixture }));
});

test("editions show a spot ticker and sponsor link without requesting daily benchmarks", async ({ page }) => {
  await page.route(tickerScriptUrl, route => route.fulfill({ contentType: "application/javascript", body: tickerModule }));
  let requests = 0;
  page.on("request", request => { if (request.url().includes("/markets/metals")) requests++; });
  for (const path of ["/", "/texas", "/texas/randall"]) {
    await page.goto(path);
    await expect(page.locator('.nav a[href="/itm-trading"]')).toHaveText("ITM Trading");
    await expect(page.locator('.metals-desk-link')).toHaveAttribute("href", "/itm-trading");
    await expect(page.getByRole('complementary', { name: 'Metal spot prices', exact: true })).toBeVisible();
    await expect(page.locator('.precious-metals-ticker tv-ticker-tape')).toHaveAttribute('symbols', 'OANDA:XAUUSD,OANDA:XAGUSD,OANDA:XPTUSD,OANDA:XPDUSD');
    await expect(page.locator('#tradingview-ticker-tape-script')).toHaveCount(1);
  }
  expect(requests).toBe(0);
  await page.locator('.nav a[href="/itm-trading"]').click();
  await expect(page.getByRole("heading", { level: 1, name: "ITM Trading", exact: true })).toBeVisible();
  await expect(page.getByRole("article", { name: "Gold benchmark", exact: true })).toContainText("$3,000.00");
  expect(requests).toBeGreaterThan(0);
  await expect(page.locator('.market-panel')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://thecountypost.com/itm-trading");
  await expect(page).toHaveTitle("ITM Trading & Metal Prices | The County Post");
  await expect(page.locator('.itm-disclosure').first()).toContainText("ITM Trading is a sponsor of The County Post");
  await expect(page.locator('#stan-roberts a[href="tel:+18886964653"]')).toHaveText("888-696-4653");
  await expect(page.getByRole("link", { name: "services@itmtrading.com", exact: true })).toHaveAttribute("href", /mailto:services@itmtrading.com\?subject=For%20Stan%20Roberts/);
  await expect(page.getByRole("link", { name: "Contact Stan through ITM" })).toHaveAttribute("href", "https://www.itmtrading.com/contactus");
  const graph = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() || "{}");
  expect(graph["@graph"][0].sponsor.name).toBe("ITM Trading");
  expect(graph["@graph"][0].about.name).toBe("Stan Roberts");
  await page.locator('.itm-hero').screenshot({ path: "test-results/itm-hero-desktop.png" });
  await page.locator('.itm-tracker').screenshot({ path: "test-results/itm-tracker-desktop.png" });
});

test("mobile tickers defer loading and recover together after a provider script failure", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.route(tickerScriptUrl, route => route.abort());
  let scriptRequests = 0;
  page.on('request', request => { if (request.url().startsWith(tickerScriptUrl)) scriptRequests++; });
  await page.goto('/texas/randall');
  const toggle = page.getByRole('button', { name: /Market desk/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(scriptRequests).toBe(0);
  await toggle.click();
  await expect(page.getByRole('status').filter({ hasText: 'Metal spot prices unavailable.' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /^Market prices unavailable\.$/ })).toBeVisible();
  expect(scriptRequests).toBe(1);
  await toggle.click();
  await page.route(`${tickerScriptUrl}*`, route => route.fulfill({ contentType: 'application/javascript', body: tickerModule }));
  await toggle.click();
  await expect(page.locator('tv-ticker-tape')).toHaveCount(2);
  expect(scriptRequests).toBe(2);
  await expect(page.getByText('Metal spot prices unavailable.', { exact: true })).toHaveCount(0);
  await toggle.click();
  await expect(page.locator('tv-ticker-tape')).toHaveCount(0);
  await toggle.click();
  await expect(page.locator('tv-ticker-tape')).toHaveCount(2);
  expect(scriptRequests).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("benchmark comparisons and unit/purity calculations use verified values", async ({ page }) => {
  await page.goto("/itm-trading");
  const gold = page.getByRole("article", { name: "Gold benchmark", exact: true });
  await expect(gold).toContainText("+$100.00 (+3.45%)");
  await expect(gold).toContainText("Sep 30, 2026");
  await expect(page.locator('.itm-provenance')).toContainText("Oct 1, 2026");
  await expect(page.locator('.itm-ratio')).toContainText("100.00 : 1");
  await expect(page.getByRole("article", { name: "Platinum benchmark" })).toContainText("−$20.00 (-1.96%)");
  await expect(page.getByRole("article", { name: "Palladium benchmark" })).toContainText("Change unavailable");
  await page.getByLabel("Quantity (troy oz)").fill("2");
  await expect(page.locator('.itm-estimate strong')).toHaveText("$6,000.00");
  await page.getByLabel("Purity (%)").fill("50");
  await expect(page.locator('.itm-estimate strong')).toHaveText("$3,000.00");
  await page.getByRole("combobox", { name: "Price unit", exact: true }).selectOption("g");
  await expect(gold.locator('.itm-price')).toHaveText("$96.45");
  await page.getByLabel("Quantity (g)").fill("31.1034768");
  await page.getByLabel("Purity (%)").fill("100");
  await expect(page.locator('.itm-estimate strong')).toHaveText("$3,000.00");
  await page.getByRole("combobox", { name: "Metal", exact: true }).selectOption("silver");
  await expect(page.locator('.itm-estimate strong')).toHaveText("$30.00");
  await page.getByRole("combobox", { name: "Price unit", exact: true }).selectOption("kg");
  await page.getByLabel("Quantity (kg)").fill("1");
  await expect(page.locator('.itm-estimate strong')).toHaveText("$964.52");
  await page.getByLabel("Purity (%)").fill("101");
  await expect(page.locator('.itm-estimate strong')).toHaveText("Unavailable");
  await expect(page.getByRole("status").filter({ hasText: "Enter a quantity" })).toBeVisible();
});

test("a failed refresh retains dated values and retry recovers", async ({ page }) => {
  await page.goto("/itm-trading");
  await expect(page.locator('.itm-price').first()).toHaveText("$3,000.00");
  await page.route("**/v1/markets/metals", route => route.fulfill({ status: 503 }));
  await page.getByRole("button", { name: "Refresh prices", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "last received benchmarks" })).toBeVisible();
  await expect(page.locator('.itm-price').first()).toHaveText("$3,000.00");
  await expect(page.locator('.itm-fixing').first()).toContainText("Sep 30, 2026");
  await page.route("**/v1/markets/metals", route => route.fulfill({ json: fixture }));
  await page.getByRole("button", { name: "Refresh prices", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "last received benchmarks" })).toHaveCount(0);
});

test("malformed data never becomes a price or a calculation", async ({ page }) => {
  await page.route("**/v1/markets/metals", route => route.fulfill({ json: { ...fixture, items: [{ key: "gold", price: -1 }] } }));
  await page.goto("/itm-trading");
  await expect(page.getByRole("alert")).toContainText("Prices are unavailable");
  await expect(page.locator('.itm-price').first()).toHaveText("Unavailable");
  await expect(page.locator('.itm-estimate strong')).toHaveText("Unavailable");
  await expect(page.getByRole("link", { name: "Contact Stan through ITM" })).toBeAttached();
});

test("the phone layout shows sponsor contacts and flags older or stale benchmarks", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const old = { ...fixture, stale: true, items: fixture.items.map(item => ({ ...item, fixedAt: "2026-09-21T15:00:00Z" })) };
  await page.route("**/v1/markets/metals", route => route.fulfill({ json: old }));
  await page.goto("/itm-trading");
  await expect(page.locator('.itm-fixing').first()).toContainText("Older benchmark");
  await expect(page.getByRole("status").filter({ hasText: "last received benchmarks" })).toBeAttached();
  await expect(page.locator('.itm-hero-brand img')).toBeVisible();
  expect(await page.locator('.itm-hero-brand img').evaluate(async (image: HTMLImageElement) => { await image.decode(); return image.naturalWidth > 0; })).toBe(true);
  await page.locator('.itm-hero').screenshot({ path: "test-results/itm-hero-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Meet Stan Roberts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Stan Roberts", exact: true })).toBeInViewport();
  await expect(page.getByRole("link", { name: "Contact Stan through ITM" })).toBeVisible();
  await page.locator('#stan-roberts').screenshot({ path: "test-results/itm-contact-mobile.png" });
});
