import { expect, test } from "@playwright/test";
import { counties } from "../../src/data/counties";
import { states } from "../../src/data/states";
import { countyJurisdictionNames } from "../../src/data/county-geography";

import places from "../../src/data/fetch-city-counties.json" with { type: "json" };

const townForCounty = new Map<string, { name: string; members: string[] }>();
for (const [name, groups] of Object.entries(places)) {
  for (const group of groups) {
    // A name shared by distinct towns within one state requires clarification.
    if (groups.some((other) => other !== group && other.slice(0, 2) === group.slice(0, 2))) continue;
    const members = group.split(" ");
    for (const fips of members) {
      const previous = townForCounty.get(fips);
      if (!previous || members.length < previous.members.length) townForCounty.set(fips, { name, members });
    }
  }
}
const weatherPaths = new Map(counties.map((c) => [c.fips, "/" + c.state.slug + "/" + c.slug + "/weather"]));
const weatherCounties = new Map([...weatherPaths].map(([fips, path]) => ["/v1/counties" + path, fips]));
const byPath = new Map(counties.map((c) => ["/v1/pages/counties/" + c.state.slug + "/" + c.slug, c]));
test.describe.configure({ mode: "parallel" });

for (const state of states) {
  test("national edition finds county news and town weather for " + state.name, async ({ page }) => {
    const local = counties.filter((c) => c.state === state);
    test.setTimeout(60_000 + 2500 * local.length);
    await page.clock.setFixedTime(new Date("2026-11-20T12:00:00Z"));
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      const county = byPath.get(url.pathname);
      if (county) {
        const story = {
          id: county.fips,
          title: "Library adds Saturday hours",
          source: "Local Journal",
          link: "https://local.example/reports/" + county.fips,
          description: "The new hours begin next weekend.",
        };
        return route.fulfill({
          json: {
            scope: { trustedHosts: ["local.example"] },
            sections: {
              localNews: {
                items: [
                  story,
                  {
                    ...story,
                    id: "roundup",
                    title: "Industry roundup",
                    link: "https://wire.example/roundup",
                  },
                ],
              },
            },
          },
        });
      }
      const fips = weatherCounties.get(url.pathname);
      if (fips) return route.fulfill({
        json: {
          county: { fips }, location: { timeZone: "UTC" }, zones: {}, alerts: [], warnings: [], hourly: [],
          forecast: [20, 21].map((day) => ({
            name: day === 20 ? "Friday" : "Saturday",
            startTime: `2026-11-${day}T06:00:00Z`, endTime: `2026-11-${day}T18:00:00Z`,
            isDaytime: true, shortForecast: "Forecast " + fips,
          })),
          meta: { cacheTtlSeconds: 60, alertsCacheTtlSeconds: 60 },
        },
      });
      if (url.pathname.startsWith("/v1/") || !["127.0.0.1", "localhost"].includes(url.hostname))
        return route.abort();
      return route.continue();
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Ask Fetch" }).click();
    const dialog = page.getByRole("dialog", { name: "Ask Fetch" });
    const input = dialog.getByRole("textbox");
    const story = dialog.getByRole("link", { name: "Library adds Saturday hours" });
    for (const county of local) {
      // Also cover local word order for municipalities, boroughs and independent cities.
      const names = countyJurisdictionNames(county);
      const name = names.find((n) => /^(?:city|municipality) /i.test(n)) || county.displayName;
      await input.fill("What’s happening in the local news in " + name + ", " + state.abbr + "?");
      await input.press("Enter");
      await expect(story, county.displayName).toHaveAttribute(
        "href",
        "https://local.example/reports/" + county.fips,
      );
      await expect(dialog.getByRole("link", { name: "Industry roundup" })).toHaveCount(0);
      const town = townForCounty.get(county.fips)!;
      await input.fill("Weather in " + town.name + ", " + state.abbr + " on Saturday?");
      await input.press("Enter");
      const weather = dialog.locator('.fetch-answer a[href$="/weather"]');
      await expect(weather, town.name).toHaveCount(town.members.length);
      expect(
        (await weather.evaluateAll((links) => links.map((link) => link.getAttribute("href")))).sort(),
      ).toEqual(town.members.map((id) => weatherPaths.get(id)).sort());
      for (const fips of town.members) {
        const answer = dialog.locator(".fetch-answer").filter({
          has: page.locator(`a[href="${weatherPaths.get(fips)}"]`),
        });
        await expect(answer.getByText("Saturday — Forecast " + fips, { exact: true })).toBeVisible();
        await expect(answer.getByText(/^Friday —/)).toHaveCount(0);
      }
    }
  });
}
