import { expect, test } from "@playwright/test";

// Search is entirely local; external news/ads are isolated for these UI checks.
test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    return ["127.0.0.1", "localhost"].includes(host) ? route.continue() : route.abort();
  });
});

for (const width of [1280, 320]) {
  test.describe(`${width}px county search`, () => {
    test.use({ viewport: { width, height: 800 } });
    for (const path of ["/", "/states", "/texas"]) {
      test(`complete scrollable results and mixed queries at ${path}`, async ({ page }) => {
        await page.goto(path);
        const input = page.getByRole("textbox", { name: "Search for a county or state" }).or(page.getByRole("searchbox", { name: "Search for a county or state" }));
        await input.fill("Jefferson County");
        const results = page.getByRole("region", { name: "County and state search results" });
        const target = results.locator('a[href="/texas/jefferson"]');
        await expect(target).toBeAttached();
        expect(await results.getByRole("link").count()).toBeGreaterThan(10);
        expect(await results.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
        await results.hover();
        await page.mouse.wheel(0, 350);
        await expect.poll(() => results.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
        await input.fill("texas,");
        await expect(results.getByRole("link")).toHaveCount(255);
        expect(await results.evaluate((node) => node.scrollTop)).toBe(0);
        await input.press("Enter");
        await expect(page).toHaveURL(/texas$/);
        // Use this location's finder again to check punctuation, order and typo.
        await page.goto(path);
        for (const query of ["texas, jeffson", "jefferson, texas,", "TX Jefferson", "jefferson county texas"]) {
          await input.fill(query);
          await expect(results.getByRole("link")).toHaveCount(1);
          await expect(target).toBeVisible();
        }
        await input.fill("not-a-county-987654321");
        await expect(results.getByRole("link")).toHaveCount(0);
        await input.fill("Jefferson County");
        // Native keyboard focus must reveal a result below the initial fold.
        await target.focus();
        await expect(target).toBeInViewport();
        expect(await results.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
        expect(await results.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
        await target.press("Enter");
        await expect(page).toHaveURL(/texas\/jefferson$/);
      });
    }
  });
}
