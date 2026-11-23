import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function fixtures(context: BrowserContext, price = 1200) {
  await context.route("**/*", (r) => {
    const url = new URL(r.request().url());
    if (url.pathname.endsWith("/economic-data") && url.pathname.includes("/v1/counties/")) {
      const fips: Record<string, string> = { potter: "48375", randall: "48381", lubbock: "48303" };
      return r.fulfill({
        json: {
          county: { fips: fips[url.pathname.split("/")[4]] },
          metrics: [
            {
              key: "gross-domestic-product",
              frequency: "Annual",
              units: "Thousands of dollars",
              valueKind: "currency-thousands",
              latest: { date: "2020-01-01", value: price },
              source: "BEA",
              seriesUrl: "https://example.org/series",
            },
          ],
        },
      });
    }
    return url.pathname.startsWith("/v1/") || !["localhost", "127.0.0.1"].includes(url.hostname)
      ? r.abort()
      : r.continue();
  });
}
async function open(page: Page, url: string) {
  await page.goto(url);
  await page.getByRole("button", { name: "Ask Fetch", exact: true }).click();
  return page.getByRole("dialog", { name: "Ask Fetch" });
}
async function ask(page: Page, question: string) {
  const input = page.getByRole("textbox", { name: "Ask Fetch a question" });
  await input.fill(question);
  await input.press("Enter");
}
test("a saved comparison continues across editions, backup restore and fresh data", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await fixtures(context);
  let dialog = await open(page, baseURL + "/texas/potter");
  const question = "Compare GDP in Potter County, Texas and Randall County, Texas in 2020";
  await ask(page, question);
  await expect(dialog.getByRole("region", { name: "Potter County, TX" })).toContainText("$1.2M");
  await dialog.getByRole("button", { name: "Past chats" }).click();
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Save a backup" }).click();
  const bytes = await readFile((await (await download).path())!);
  const backup = JSON.parse(bytes.toString());
  expect(backup.chats[0].turns[0].text).toContain("$1.2M");
  await page.close();
  const another = await context.newPage();
  dialog = await open(another, baseURL + "/");
  await dialog.getByRole("button", { name: "Continue last chat" }).click();
  await expect(dialog.getByRole("link", { name: "BEA via FRED" }).first()).toHaveAttribute(
    "href",
    "https://example.org/series",
  );
  await ask(another, "Add Lubbock");
  await expect(dialog.getByRole("region", { name: "Lubbock County, TX" })).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Year", exact: true })).toHaveValue("2020");
  const other = await browser.newContext();
  try {
    await fixtures(other, 3400);
    const device = await other.newPage();
    const d = await open(device, baseURL + "/");
    await expect(d.getByRole("button", { name: "Continue last chat" })).toHaveCount(0);
    await d.getByRole("button", { name: "Past chats" }).click();
    for (let i = 0; i < 2; i++) {
      await d
        .getByLabel("Fetch backup file")
        .setInputFiles({ name: "chats.json", mimeType: "application/json", buffer: bytes });
      await expect(d.getByText(/Chats restored/)).toBeVisible();
    }
    await d.getByRole("button", { name: question, exact: true }).click();
    await expect(d.locator(".fetch-saved-answer")).toHaveCount(1);
    await expect(d.locator(".fetch-saved-answer")).toContainText("$1.2M");
    await d.getByRole("button", { name: "Check for updates" }).click();
    await expect(d.getByRole("region", { name: "Potter County, TX" })).toContainText("$3.4M");
    await ask(device, "Add Lubbock");
    for (const name of ["Potter", "Randall", "Lubbock"])
      await expect(d.getByRole("region", { name: name + " County, TX" })).toBeVisible();
    await expect(d.getByRole("combobox", { name: "Year", exact: true })).toHaveValue("2020");
    await d.getByRole("button", { name: "Past chats" }).click();
    await d.getByRole("button", { name: question, exact: true }).click();
    await expect(d.locator(".fetch-saved-answer")).toHaveCount(3);
    await expect(d.locator(".fetch-saved-answer").first()).toContainText("$1.2M");
    await expect(d.locator(".fetch-saved-answer").nth(1)).toContainText("$3.4M");
  } finally {
    await other.close();
  }
});
test("private questions stay out of backups, deletion persists, and invalid imports leave chats intact", async ({
  page,
  context,
  baseURL,
}) => {
  await fixtures(context);
  const d = await open(page, baseURL + "/");
  await ask(page, "Compare population in Texas and Oklahoma");
  await d.getByRole("button", { name: "Private chat", exact: true }).click();
  await ask(page, "Private question about tomorrow’s weather in Potter County, Texas");
  await open(page, baseURL + "/texas/potter");
  await expect(d.getByText("Private chat · history is off")).toBeVisible();
  await ask(page, "Private question about Texas");
  await d.getByRole("button", { name: "Past chats" }).click();
  await expect(d.getByRole("button", { name: /Private question/ })).toHaveCount(0);
  const download = page.waitForEvent("download");
  await d.getByRole("button", { name: "Save a backup" }).click();
  const saved = await readFile((await (await download).path())!, "utf8");
  expect(saved).not.toContain("Private question");
  await d.getByLabel("Fetch backup file").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(d.getByText(/Could not restore/)).toBeVisible();
  await d.getByRole("button", { name: /Delete chat · Compare population/ }).click();
  await d.getByRole("button", { name: "Confirm deletion" }).click();
  await expect(d.getByText("No saved chats yet.")).toBeVisible();
  await open(page, baseURL + "/");
  await d.getByRole("button", { name: "Past chats" }).click();
  await expect(d.getByText("No saved chats yet.")).toBeVisible();
});

test("a recalled headline keeps its original position, date and publisher after the feed changes", async ({
  page,
  context,
  baseURL,
}) => {
  await fixtures(context);
  let titles = ["Library expands", "Bridge reopens"];
  await context.route("**/v1/pages/counties/texas/potter?**", (r) =>
    r.fulfill({
      json: {
        scope: { trustedHosts: ["local.example"] },
        sections: {
          localNews: {
            items: titles.map((title, i) => ({
              id: String(i),
              title,
              source: "County Journal",
              publishedAt: "2026-11-18",
              link: "https://local.example/" + i,
              description: "Report on " + title,
            })),
            meta: { stale: false, fetchedAt: "2026-11-19T12:00:00Z" },
          },
        },
      },
    }),
  );
  let d = await open(page, baseURL + "/");
  await ask(page, "Local headlines in Potter County, Texas");
  await expect(d.getByRole("link", { name: "Bridge reopens" })).toBeVisible();
  await d.getByRole("button", { name: "Past chats" }).click();
  await expect(
    d.getByRole("button", { name: "Local headlines in Potter County, Texas", exact: true }),
  ).toBeVisible();
  titles = ["A new story"];
  d = await open(page, baseURL + "/");
  await d.getByRole("button", { name: "Continue last chat" }).click();
  await expect(d.locator(".fetch-saved-answer")).toContainText("Bridge reopens");
  await expect(d.getByRole("link", { name: "Bridge reopens" })).toHaveAttribute(
    "href",
    "https://local.example/1",
  );
  await ask(page, "The second story");
  await expect(d.getByRole("heading", { name: "Bridge reopens" })).toBeVisible();
  await expect(d.getByText("County Journal · Nov 18, 2026")).toBeVisible();
});

test("Fetch still answers when the browser declines to store history", async ({ page, context, baseURL }) => {
  await fixtures(context);
  await page.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new Error("Storage unavailable");
      },
    }),
  );
  const d = await open(page, baseURL + "/");
  await ask(page, "Compare population in Texas and Oklahoma");
  await expect(d.getByRole("combobox", { name: "State 1", exact: true })).toHaveValue("texas");
  await expect(d.getByText(/could not save your chat|storage is unavailable/)).toBeVisible();
});

test("a closed browser profile reopens its last chat and two tabs can continue it independently", async ({
  playwright,
  browserName,
  baseURL,
}, info) => {
  // This exercise starts and stops two real browser processes on the same disk profile.
  test.setTimeout(75000);
  const profile = info.outputPath("reader-profile");
  const launch = () =>
    playwright[browserName].launchPersistentContext(profile, {
      executablePath:
        browserName === "chromium"
          ? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (process.env.CI ? undefined : "/usr/bin/chromium")
          : undefined,
    });
  let context = await launch();
  try {
    await fixtures(context);
    const page = await context.newPage();
    const d = await open(page, baseURL + "/");
    await ask(page, "Compare population in Texas and Oklahoma");
    await d.getByRole("button", { name: "Past chats" }).click();
    await expect(
      d.getByRole("button", { name: "Compare population in Texas and Oklahoma", exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
  context = await launch();
  try {
    await fixtures(context);
    const a = await context.newPage(),
      b = await context.newPage();
    const [first, second] = await Promise.all([open(a, baseURL + "/"), open(b, baseURL + "/")]);
    await Promise.all(
      [first, second].map((d) => d.getByRole("button", { name: "Continue last chat" }).click()),
    );
    await Promise.all([first, second].map((d) => expect(d.locator(".fetch-saved-answer")).toHaveCount(1)));
    await a.bringToFront();
    await ask(a, "Add Kansas");
    await b.bringToFront();
    await ask(b, "Add Iowa");
    await expect(first.getByRole("combobox", { name: "State 3", exact: true })).toHaveValue("kansas");
    await expect(second.getByRole("combobox", { name: "State 3", exact: true })).toHaveValue("iowa");
    await Promise.all([first, second].map((d) => d.getByRole("button", { name: "Past chats" }).click()));
    await second
      .getByRole("button", { name: "Compare population in Texas and Oklahoma", exact: true })
      .click();
    for (const prompt of ["Add Kansas", "Add Iowa"])
      await expect(second.locator(".fetch-question").filter({ hasText: prompt })).toBeVisible();
    await a.bringToFront();
    await first.getByRole("button", { name: /Delete chat · Compare population/ }).click();
    await first.getByRole("button", { name: "Confirm deletion" }).click();
    await expect(first.getByText("No saved chats yet.")).toBeVisible();
    await b.bringToFront();
    await ask(b, "Add Utah");
    await expect(second.getByText(/This chat was deleted in another tab/)).toBeVisible();
    await second.getByRole("button", { name: "Past chats" }).click();
    await expect(second.getByText("No saved chats yet.")).toBeVisible();
  } finally {
    await context.close();
  }
});
