import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("http://localhost:8787/v1/counties/**/population", async (route) => {
    const parts = new URL(route.request().url()).pathname.split("/").filter(Boolean);
    const stateSlug = parts[2];
    const countySlug = parts[3];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        county: countySlug === "potter" ? "Potter" : "Test",
        countySlug,
        state: stateSlug === "texas" ? "Texas" : "Test",
        stateSlug,
        fips: "48375",
        population: 114453,
        estimateVintage: 2025,
        rateTier: "100000-250000",
      }),
    });
  });
});

test("renders checkout first, national contact next, and consolidated pricing", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Put your business on the Post" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "County and state campaign rates" })).toBeVisible();
  await expect(page.locator(".advertiser-main section").first()).toHaveAttribute("id", "checkout");
  await expect(page.locator("#checkout + #national-advertising")).toBeVisible();
  await expect(page.locator("#national-advertising + #pricing")).toBeVisible();
  await expect(page.getByRole("heading", { name: "See your campaign in the County Post design" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "County and state campaign rates" })).toBeVisible();
  await expect(page.getByText("Texas: 254 counties · $2,540/month")).toBeVisible();
  await expect(page.getByText("Texas: one feed · $5,080/month")).toBeVisible();
  await expect(page.getByRole("img", { name: "The County Post" }).first()).toHaveAttribute("src", /county-post-final-logo/);
  await expect(page.getByText("Lori Horner")).toHaveCount(0);
  await expect(page.locator(".creative-specs + label")).toContainText("Upload ad creative");
  await expect(page.locator(".creative-specs")).toContainText("Color card: 250×250 full-color JPG or PNG");
  await expect(page.locator(".creative-specs")).toContainText("Network band: 980×300 JPG or PNG");
  await expect(page.locator(".creative-specs")).toContainText("County expansion:");
  const pricingButton = page.locator(".creative-specs + label + .pricing-information-button");
  await expect(pricingButton).toHaveText("Pricing Information");
  await expect(pricingButton).toHaveAttribute("href", "/#pricing");
  await pricingButton.click();
  await expect(page).toHaveURL(/\/#pricing$/);
  await expect(page.locator("#pricing")).toBeInViewport();
  await expect(page.getByRole("link", { name: "View the live County Post" })).toHaveAttribute("href", "https://thecountypost.com");
  await expect(page.getByRole("link", { name: "Visit main site" })).toHaveAttribute("href", "https://thecountypost.com");

  const national = page.locator("#national-advertising");
  await expect(national.getByText("National lanes and exclusive national placements")).toBeVisible();
  await expect(national.getByRole("link", { name: "submissions@thecountypost.com" })).toHaveAttribute(
    "href",
    "mailto:submissions@thecountypost.com",
  );
  await expect(national.getByRole("link", { name: "(866) 756-1776" })).toHaveAttribute("href", "tel:+18667561776");
  await expect(national).toContainText("1000 S. Jefferson St., Amarillo, TX");
  await expect(national.locator("form")).toHaveCount(0);
  await expect(page.locator("form")).toHaveCount(1);
});

test("calculates state and per-feed pricing and submits state fulfillment details", async ({ page }) => {
  let checkoutPayload: Record<string, unknown> | undefined;
  await page.route("http://localhost:8787/v1/checkout/sessions", async (route) => {
    checkoutPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ url: "/?checkout=success" }) });
  });
  await page.goto("/");

  await page.getByLabel("Campaign reach").selectOption("state");
  await page.getByLabel("Add a state").fill("Texas");
  await page.getByRole("button", { name: "Texas (TX)" }).click();
  await expect(page.locator(".checkout-summary strong")).toHaveText("$2,540/month");

  await page.getByLabel("Placement").selectOption("state-feed-sponsorship");
  await expect(page.locator(".checkout-summary strong")).toHaveText("$5,080/month");
  await page.getByLabel("Sports").check();
  await expect(page.locator(".checkout-summary strong")).toHaveText("$10,160/month");
  await page.getByLabel("Billing").selectOption("annual");
  await expect(page.locator(".checkout-summary strong")).toHaveText("$101,600/year");

  await page.getByLabel("Business name").fill("Texas Example");
  await page.getByLabel("Contact email").fill("ads@example.com");
  await page.getByRole("button", { name: "Continue to secure Stripe checkout" }).click();

  await expect(page.getByText("Payment received.")).toBeVisible();
  expect(checkoutPayload).toMatchObject({
    scope: "state",
    placement: "state-feed-sponsorship",
    billing: "annual",
    states: ["texas"],
    feeds: ["general", "sports"],
    customerEmail: "ads@example.com",
    businessName: "Texas Example",
  });
});

test("preserves county population-tier checkout", async ({ page }) => {
  let checkoutPayload: Record<string, unknown> | undefined;
  await page.route("http://localhost:8787/v1/checkout/sessions", async (route) => {
    checkoutPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ url: "/?checkout=success" }) });
  });
  await page.goto("/");

  await page.getByLabel("Add a county").fill("Potter");
  await page.getByRole("button", { name: "Potter County, TX" }).click();
  await expect(page.locator(".checkout-summary strong")).toHaveText("$250/month");
  await page.getByLabel("Billing").selectOption("annual");
  await expect(page.locator(".checkout-summary strong")).toHaveText("$2,500/year");
  await page.getByLabel("Business name").fill("Potter Example");
  await page.getByLabel("Contact email").fill("potter@example.com");
  await page.getByRole("button", { name: "Continue to secure Stripe checkout" }).click();

  await expect(page.getByText("Payment received.")).toBeVisible();
  expect(checkoutPayload).toMatchObject({
    scope: "county",
    placement: "color-card",
    billing: "annual",
    counties: [{ stateSlug: "texas", countySlug: "potter" }],
  });
});

test("uses an uploaded creative throughout the placement showcase", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Business name").fill("Acme County Supply");
  await page.getByLabel(/Upload ad creative/).setInputFiles({
    name: "acme.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });

  const previews = page.getByRole("img", { name: "Acme County Supply advertisement preview" });
  await expect.poll(() => previews.count()).toBeGreaterThanOrEqual(4);
  await expect(previews.first()).toBeVisible();
});

test("keeps legal statements and redirects legacy advertiser routes", async ({ page }) => {
  await page.goto("/advertise");
  await expect(page).toHaveURL(/\/#checkout$/);
  await expect(page.getByRole("heading", { name: "Put your business on the Post" })).toBeVisible();

  await page.goto("/payments");
  await expect(page).toHaveURL(/\/#checkout$/);

  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
  await expect(page.getByText("Content is aggregated through the County Post News API.")).toBeVisible();

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  await expect(page.getByText("No behavioral tracking or ad tech.")).toBeVisible();
});

test("remains usable without horizontal overflow at mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "Advertiser navigation" })).toBeVisible();
  await expect(page.getByLabel("Campaign reach")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});
