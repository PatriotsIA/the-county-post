import { expect, test } from "@playwright/test";

test("classifieds handoff carries county identity without the legacy submission form", async ({ page }) => {
  test.skip(!process.env.VITE_CLASSIFIEDS_ORIGIN, "Enable only for a private marketplace preview.");
  await page.goto("/texas/potter/classifieds");
  await expect(page.getByRole("link", { name: "Browse county listings" })).toHaveAttribute("href", "https://staging-classifieds.thecountypost.com/from-county-post/county/48375/");
  await expect(page.getByRole("link", { name: "Post an item for sale" })).toHaveAttribute("href", "https://staging-classifieds.thecountypost.com/from-county-post/county/48375/?action=post");
  await expect(page.getByRole("button", { name: "Submit classified" })).toHaveCount(0);
  await page.goto("/connecticut/hartford/classifieds");
  await expect(page.getByRole("link", { name: "Post an item for sale" })).toHaveAttribute("href", /county\/09003\/\?action=post$/);
  await page.goto("/maryland/baltimore-city/classifieds");
  await expect(page.getByRole("link", { name: "Browse county listings" })).toHaveAttribute("href", /county\/24510\/$/);
  await page.goto("/texas");
  await expect(page.getByRole("link", { name: "Browse statewide listings" })).toHaveAttribute("href", "https://staging-classifieds.thecountypost.com/from-county-post/state/48/");
});
