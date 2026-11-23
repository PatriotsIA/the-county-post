import { expect, test } from "@playwright/test";

const siteTour = "Learn How To Use The County Post";
const fetchTour = "How To Use Fetch";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route =>
    new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort()
  );
});

for (const path of ["/", "/texas", "/texas/potter"]) {
  test(`both tutorials are offered on first open in ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.getByRole("button", { name: "Ask Fetch" }).click();
    const dialog = page.getByRole("dialog", { name: "Ask Fetch" });
    for (const name of [siteTour, fetchTour])
      await expect(dialog.getByRole("button", { name, exact: true })).toBeInViewport({ ratio: 1 });
    await dialog.getByRole("button", { name: siteTour }).click();
    await dialog.getByLabel("Jump to a lesson").selectOption({ label: "5. Find facts about your county" });
    const countyEdition = path === "/texas/potter";
    await dialog.getByRole("button", { name: countyEdition ? "Open County Data" : "Choose a county for County Data" }).click();
    await expect(page).toHaveURL(countyEdition ? /\/texas\/potter\/data$/ : /\/states$/);
    await page.getByRole("button", { name: "Back to my results" }).click();
    await expect(dialog.getByRole("heading", { name: "Find facts about your county" })).toBeFocused();
  });
}

test("a reader can walk both tutorials without typing, go back, and finish", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ask Fetch" }).click();
  const dialog = page.getByRole("dialog", { name: "Ask Fetch" });
  for (const [name, first, last] of [
    [siteTour, "Find your edition", "Find partners or advertise"],
    [fetchTour, "Ask your first question", "Keep a backup or use private chat"],
  ]) {
    await dialog.getByRole("button", { name, exact: true }).click();
    await expect(dialog.getByRole("heading", { name: first })).toBeFocused();
    await dialog.getByRole("button", { name: "Next step" }).click();
    await dialog.getByRole("button", { name: "Previous" }).click();
    const picker = dialog.getByLabel("Jump to a lesson");
    const lessons = (await picker.getByRole("option").allTextContents()).map(label => label.replace(/^\d+\. /, ""));
    expect(lessons[0]).toBe(first);
    expect(lessons.at(-1)).toBe(last);
    for (const [i, title] of lessons.entries()) {
      await expect(dialog.getByRole("heading", { name: title, exact: true })).toBeFocused();
      await expect(picker).toHaveValue(String(i));
      await expect(dialog.getByRole("listitem").first()).toBeVisible();
      if (i < lessons.length - 1) await dialog.getByRole("button", { name: "Next step" }).click();
    }
    await dialog.getByRole("button", { name: "Finish tour" }).click();
    await expect(dialog.getByRole("heading", { name: "What can I find for you?" })).toBeVisible();
  }
});

test("a typed Fetch tutorial request and a practice question return to the Fetch lesson", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ask Fetch" }).click();
  const dialog = page.getByRole("dialog", { name: "Ask Fetch" });
  const input = dialog.getByRole("textbox", { name: "Ask Fetch a question" });
  await input.fill("How do I use Fetch?");
  await input.press("Enter");
  await expect(dialog.getByRole("heading", { name: "Ask your first question" })).toBeVisible();
  await dialog.getByRole("button", { name: /Try .*weather/ }).click();
  await dialog.getByRole("button", { name: "Back to tour" }).click();
  await expect(dialog.getByRole("heading", { name: "Ask your first question" })).toBeFocused();
  await input.fill("How do I use the County Post?");
  await input.press("Enter");
  await expect(dialog.getByRole("heading", { name: "Find your edition" })).toBeVisible();
});
