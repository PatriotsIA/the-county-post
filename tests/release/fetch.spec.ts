import { test, expect } from "@playwright/test";

test("readers can open Fetch, find city weather and a local story, narrow an area, and return to the launcher", async ({
  page,
}) => {
  const answers = new Map([
    ["idaho/ada", ["16001", "Ada County", "Clear"]],
    ["idaho/boise", ["16015", "Boise County", "Cloudy"]],
    ["washington/king", ["53033", "King County", "Showers"]],
    ["texas/potter", ["48375", "Potter County", "Clear"]],
    ["texas/randall", ["48381", "Randall County", "Partly cloudy"]],
  ]);
  const weatherRequests: string[] = [];
  const guideScripts: string[] = [];
  page.on("request", (r) => {
    if (/\/assets\/FetchGuide-[^/]+\.js$/.test(new URL(r.url()).pathname)) guideScripts.push(r.url());
  });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1") return route.continue();
    const weather = url.pathname.match(/^\/v1\/counties\/(.+\/.+)\/weather$/)?.[1];
    const answer = weather && answers.get(weather);
    if (weather && answer) {
      weatherRequests.push(weather);
      return route.fulfill({
        json: {
          county: { fips: answer[0] },
          location: { timeZone: "America/Chicago" },
          currentObservation: { textDescription: answer[2], temperature: { value: 60 } },
          forecast: [],
          hourly: [],
          alerts: [],
          warnings: [],
          zones: {},
          meta: { cacheTtlSeconds: 60, alertsCacheTtlSeconds: 60 },
        },
      });
    }
    if (url.pathname === "/v1/pages/counties/washington/king")
      return route.fulfill({
        json: {
          scope: { places: ["Seattle"], trustedHosts: ["example.org"] },
          sections: {
            localNews: {
              items: [
                {
                  id: "library",
                  title: "Seattle library adds evening hours",
                  source: "Local Desk",
                  link: "https://example.org/library",
                  description: "The branch is open late on Thursdays.",
                },
              ],
            },
          },
        },
      });
    return route.abort();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const launcher = page.getByRole("button", { name: "Ask Fetch" });
  await expect(launcher).toBeVisible();
  expect(guideScripts).toHaveLength(0);
  await launcher.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Ask Fetch" });
  const input = dialog.getByRole("textbox", { name: "Ask Fetch a question" });
  const ask = async (question: string) => {
    await input.fill(question);
    await input.press("Enter");
  };
  for (const [place, key] of [
    ["Boise, Idaho", "idaho/ada"],
    ["Boise County, Idaho", "idaho/boise"],
    ["Seattle, WA", "washington/king"],
  ]) {
    await ask((key === "idaho/ada" ? "What's the weather in " : "What about ") + place + "?");
    const [, county, conditions] = answers.get(key)!;
    const region = dialog.getByRole("region", { name: new RegExp(county) });
    await expect(region).toContainText(conditions);
    await expect(region.getByRole("link", { name: "Open full weather report" })).toHaveAttribute(
      "href",
      "/" + key + "/weather",
    );
  }
  expect(weatherRequests.slice(0, 3)).toEqual(["idaho/ada", "idaho/boise", "washington/king"]);
  await ask("Find library stories in Seattle, Washington");
  await expect(dialog.getByRole("link", { name: "Seattle library adds evening hours" })).toHaveAttribute(
    "href",
    "https://example.org/library",
  );
  await ask("Who published the first story?");
  await expect(dialog.getByText("Local Desk", { exact: true }).first()).toBeVisible();
  await ask("Weather in Amarillo, Texas?");
  await expect(dialog.getByRole("region", { name: "Potter County, TX" })).toContainText("Clear");
  await expect(dialog.getByRole("region", { name: "Randall County, TX" })).toContainText("Partly cloudy");
  await ask("Just Randall County");
  await expect(dialog.getByRole("region", { name: "Randall County, TX" })).toBeVisible();
  await expect(dialog.getByRole("region", { name: "Potter County, TX" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Show all counties in Amarillo" }).click();
  await expect(dialog.getByRole("region", { name: "Potter County, TX" })).toContainText("Clear");
  await expect(dialog.getByRole("region", { name: "Randall County, TX" })).toContainText("Partly cloudy");
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(launcher).toBeFocused();
  expect(guideScripts).toHaveLength(1);
});
