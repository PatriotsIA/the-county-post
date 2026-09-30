import { crc32, deflateSync } from "node:zlib";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://api.emailjs.com/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/plain", body: "OK" });
  });
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
  await expect(page.getByRole("heading", { level: 2, name: "County Post Marketing Campaign rates" })).toBeVisible();
  await expect(page.locator(".advertiser-main section").first()).toHaveAttribute("id", "checkout");
  await expect(page.locator("#checkout + #national-advertising")).toBeVisible();
  await expect(page.locator("#national-advertising + #pricing")).toBeVisible();
  await expect(page.getByRole("heading", { name: "See your County Post Marketing Campaign in the County Post design" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "County Post Marketing Campaign rates" })).toBeVisible();
  await expect(page.getByLabel("Coming soon")).toContainText(
    "Advertising Options on Our Next Release: The County Post: Classifieds Marketplace - Coming Soon!",
  );
  await expect(page.getByText("Texas: 254 counties · $2,540/month")).toBeVisible();
  await expect(page.getByText("Texas: one feed · $5,080/month")).toBeVisible();
  await expect(page.getByRole("img", { name: "The County Post" }).first()).toHaveAttribute("src", /county-post-final-logo/);
  await expect(page.getByText("Lori Horner")).toHaveCount(0);
  const nationalExample = page.getByRole("img", { name: /Full-page example of The County Post national edition/ });
  await nationalExample.scrollIntoViewIfNeeded();
  await expect(nationalExample).toBeVisible();
  const artworkFields = page.getByRole("group", { name: "Ad artwork" });
  await expect(artworkFields).toContainText("or you can send it after checkout to erik@patriotsinaction.com");
  await expect(artworkFields.getByRole("link", { name: "erik@patriotsinaction.com" })).toHaveAttribute("href", "mailto:erik@patriotsinaction.com");
  await expect(artworkFields).toContainText("Exclusive feed sponsor ad assets should be 250×250 px.");
  await expect(artworkFields.getByLabel("Square ad — 250×250 px")).toHaveAttribute("type", "file");
  await expect(artworkFields.getByLabel("Wide banner — 980×300 px")).toHaveAttribute("type", "file");
  await expect(page.locator(".creative-specs")).toContainText("Color card: 250×250 full-color JPG or PNG");
  await expect(page.locator(".creative-specs")).toContainText("Network band: 980×300 JPG or PNG");
  await expect(page.locator(".creative-specs")).toContainText("County expansion:");
  const pricingButton = page.locator(".creative-specs + .artwork-fields + .pricing-information-button");
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
  let notification: { template_id: string; template_params: Record<string, string> } | undefined;
  await page.route("https://api.emailjs.com/**", async (route) => {
    notification = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "text/plain", body: "OK" });
  });
  await page.route("http://localhost:8787/v1/checkout/sessions", async (route) => {
    checkoutPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ url: "/?checkout=success" }) });
  });
  await page.goto("/");

  await page.getByLabel("County Post Marketing Campaign reach").selectOption("state");
  await page.getByLabel("Add a state").fill("Texas");
  await page.getByRole("button", { name: "Texas (TX)" }).click();
  await expect(page.locator(".checkout-summary strong")).toHaveText("$2,540/month");

  await page.getByLabel(/^Placement/).selectOption("state-feed-sponsorship");
  await expect(page.locator(".checkout-summary strong")).toHaveText("$5,080/month");
  await page.getByLabel("Sports").check();
  await expect(page.locator(".checkout-summary strong")).toHaveText("$10,160/month");
  await page.getByLabel("Billing").selectOption("annual");
  await expect(page.locator(".checkout-summary strong")).toHaveText("$101,600/year");

  await page.getByLabel("Business name").fill("Texas Example");
  await page.getByLabel("Contact email").fill("ads@example.com");
  await page.getByLabel("Referred to by (optional)").fill("County Post Sales Team");
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
    referredBy: "County Post Sales Team",
  });
  expect(notification?.template_id).toBe("template_countypost");
  expect(notification?.template_params.reply_to).toBe("ads@example.com");
  expect(notification?.template_params.message).toContain("businessName: Texas Example");
  expect(notification?.template_params.message).toContain("states: Texas");
  expect(notification?.template_params.message).toContain("feeds: general, sports");
  expect(notification?.template_params.message).toContain("quotedTotal: $101,600/year");
  expect(notification?.template_params.message).toContain("payment has not been confirmed");
});

test("keeps the request available when the campaign notification fails", async ({ page }) => {
  await page.route("https://api.emailjs.com/**", route => route.fulfill({status: 503, body: "Mail temporarily unavailable"}));
  await page.route("http://localhost:8787/v1/checkout/sessions", route => route.fulfill({status: 201, contentType:"application/json", body: JSON.stringify({url:"/?checkout=success"})}));
  await page.goto("/");
  await page.getByLabel("Add a county").fill("Potter");
  await page.getByRole("button", { name: "Potter County, TX" }).click();
  await page.getByLabel("Business name").fill("Retained request");
  await page.getByLabel("Contact email").fill("ads@example.com");
  await page.getByRole("button", { name: "Continue to secure Stripe checkout" }).click();
  await expect(page.locator(".error")).toBeVisible();
  await expect(page).not.toHaveURL(/checkout=success/);
  await expect(page.getByLabel("Business name")).toHaveValue("Retained request");
  await expect(page.getByRole("button", { name: "Continue to secure Stripe checkout" })).toBeEnabled();
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

/** Minimal valid RGB PNG, so artwork dimension checks run against real decodable images. */
function png(width: number, height: number) {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const rows = Buffer.alloc((width * 3 + 1) * height, 0xcc);
  for (let y = 0; y < height; y++) rows[y * (width * 3 + 1)] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}

test("validates, previews and uploads square and banner artwork before checkout", async ({ page }) => {
  const uploads: string[] = [];
  let checkoutPayload: Record<string, unknown> | undefined;
  let notification: { template_params: Record<string, string> } | undefined;
  await page.route("http://localhost:8787/v1/advertising/creatives/upload", async (route) => {
    const { fileName } = route.request().postDataJSON() as { fileName: string };
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ assetKey: `ad-creatives/2026-09-30/${fileName}`, upload: { url: "https://uploads.fixture/", fields: { key: fileName } } }),
    });
  });
  await page.route("https://uploads.fixture/", async (route) => {
    uploads.push(route.request().method());
    await route.fulfill({ status: 204 });
  });
  await page.route("https://api.emailjs.com/**", async (route) => {
    notification = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "text/plain", body: "OK" });
  });
  await page.route("http://localhost:8787/v1/checkout/sessions", async (route) => {
    checkoutPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ url: "/?checkout=success" }) });
  });
  await page.goto("/");
  await page.getByLabel("Business name").fill("Acme County Supply");
  await page.getByLabel("Contact email").fill("acme@example.com");
  await page.getByLabel("Add a county").fill("Potter");
  await page.getByRole("button", { name: "Potter County, TX" }).click();

  const square = page.getByLabel("Square ad — 250×250 px");
  const banner = page.getByLabel("Wide banner — 980×300 px");
  await square.setInputFiles({ name: "wrong.png", mimeType: "image/png", buffer: png(300, 250) });
  await expect(page.getByRole("alert")).toContainText("must be 250×250 pixels");
  await square.setInputFiles({ name: "square.png", mimeType: "image/png", buffer: png(500, 500) });
  await expect(page.getByAltText("Square ad preview")).toBeVisible();
  const previews = page.getByRole("img", { name: "Acme County Supply advertisement preview" });
  await expect.poll(() => previews.count()).toBeGreaterThanOrEqual(4);
  await banner.setInputFiles({ name: "banner.png", mimeType: "image/png", buffer: png(980, 300) });
  await expect(page.getByAltText("Wide banner preview")).toBeVisible();
  await expect.poll(() => previews.count()).toBeGreaterThanOrEqual(5);

  await page.getByRole("button", { name: "Continue to secure Stripe checkout" }).click();
  await expect(page.getByText("Payment received.")).toBeVisible();
  expect(uploads).toEqual(["POST", "POST"]);
  expect(checkoutPayload).toMatchObject({
    creativeAssetKey: "ad-creatives/2026-09-30/square.png",
    bannerCreativeAssetKey: "ad-creatives/2026-09-30/banner.png",
  });
  expect(notification?.template_params.message).toContain("squareArtwork: ad-creatives/2026-09-30/square.png (500×500, square.png)");
  expect(notification?.template_params.message).toContain("bannerArtwork: ad-creatives/2026-09-30/banner.png (980×300, banner.png)");
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
  await expect(page.getByLabel("County Post Marketing Campaign reach")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});
