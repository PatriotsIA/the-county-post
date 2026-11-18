import { expect, test } from "@playwright/test";

const origin = process.env.VITE_CLASSIFIEDS_ORIGIN || "https://classifieds.thecountypost.com";
const carouselTags = (page: string) => `utm_source=thecountypost&utm_medium=carousel&utm_campaign=classifieds&utm_content=${encodeURIComponent(page)}`;

test("the Classifieds carousel explains classifieds.thecountypost.com above Opinion & op-eds at every level, and on the partners pages", async ({ page }) => {
  const explainer = page.locator(".classifieds-explainer");
  const slideLink = (index: number) => explainer.locator(".explainer-slide").nth(index).getByRole("link");
  for (const { path, heading, first, browse, sell, wanted } of [
    { path: "/", heading: "The County Post Classifieds", first: "Where classifieds are back", browse: `${origin}/`, sell: `${origin}/register/`, wanted: `${origin}/in-search-of/` },
    { path: "/texas", heading: "Texas Classifieds", first: "Texas marketplace", browse: `${origin}/from-county-post/state/48/`, sell: `${origin}/register/`, wanted: `${origin}/in-search-of/texas/` },
    { path: "/texas/potter", heading: "Potter County Classifieds", first: "Potter County marketplace", browse: `${origin}/from-county-post/county/48375/`, sell: `${origin}/from-county-post/county/48375/?action=post`, wanted: `${origin}/in-search-of/texas/` },
  ]) {
    await page.goto(path);
    await expect(explainer.locator(".kicker"), path).toHaveText("classifieds.thecountypost.com");
    await expect(explainer.getByRole("heading", { level: 2 }), path).toHaveText(heading);
    const explainerBox = (await explainer.boundingBox())!;
    const opinionBox = (await page.locator('[data-page-jump="Opinion & op-eds"]').boundingBox())!;
    expect(explainerBox.y + explainerBox.height, path).toBeLessThanOrEqual(opinionBox.y);
    await expect(explainer.locator(".explainer-slide h3"), path).toHaveText([
      first, "Sell it free", "Looking for something?", "A free page for your business", "Every county has a market", "Advertise on the marketplace",
    ]);
    // Every link goes into the marketplace at this level, tagged with this page.
    const joiner = (url: string) => (url.includes("?") ? "&" : "?");
    await expect(slideLink(0), path).toHaveAttribute("href", `${browse}${joiner(browse)}${carouselTags(path)}`);
    await expect(slideLink(1), path).toHaveAttribute("href", `${sell}${joiner(sell)}${carouselTags(path)}`);
    await expect(slideLink(2), path).toHaveAttribute("href", `${wanted}?${carouselTags(path)}`);
    await expect(slideLink(3), path).toHaveAttribute("href", `${origin}/businesses/?${carouselTags(path)}`);
    await expect(explainer.locator(".explainer-slide img").first(), path).toHaveAttribute("src", /county-post-classifieds-logo/);
  }

  // One slide at a time: the arrows and dots move through them, and the hidden ones cannot be tabbed into.
  await expect(explainer.locator(".explainer-slide[inert]")).toHaveCount(5);
  await explainer.getByRole("button", { name: "Next slide" }).click();
  await expect(explainer.locator(".explainer-dots button[aria-current]")).toHaveAccessibleName("Show slide 2: Sell it free");
  await expect(explainer.locator(".explainer-slide").nth(1)).not.toHaveAttribute("inert", "");
  await explainer.getByRole("button", { name: "Show slide 4: A free page for your business" }).click();
  await expect(explainer.getByRole("link", { name: "Find local businesses ↗" })).toBeVisible();

  await page.goto("/partners");
  await expect(explainer.getByRole("heading", { level: 2 })).toHaveText("The County Post Classifieds");
  await page.goto("/texas/potter/partners");
  await expect(explainer.getByRole("heading", { level: 2 })).toHaveText("Potter County Classifieds");
});

test("the masthead reads Local - Regional - National under its tagline, and the jump menu ends with the County Post logo", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".masthead .wordmark-tagline")).toHaveText(["Every County - Every Community. One Nation", "Local - Regional - National"]);

  // Desktops: bottom left of the panel.
  await page.getByRole("button", { name: /^Jump to/ }).click();
  const menu = page.getByRole("dialog", { name: "Jump to" });
  const logo = menu.getByRole("link", { name: "The County Post front page" });
  await expect(logo).toHaveAttribute("href", "/");
  const [logoBox, menuBox] = [(await logo.boundingBox())!, (await menu.boundingBox())!];
  expect(logoBox.x - menuBox.x).toBeLessThan(40);
  expect(menuBox.y + menuBox.height - (logoBox.y + logoBox.height)).toBeLessThan(30);
  await page.keyboard.press("Escape");

  // Phones: centred at the very bottom of the sheet.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /^Jump to/ }).click();
  await logo.scrollIntoViewIfNeeded();
  const phoneLogo = (await logo.boundingBox())!;
  expect(Math.abs(phoneLogo.x + phoneLogo.width / 2 - 195)).toBeLessThan(3);
  await logo.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(menu).toHaveCount(0);
});
