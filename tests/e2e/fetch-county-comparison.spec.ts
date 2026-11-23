import { expect, test, type Page } from "@playwright/test";
import { counties } from "../../src/data/counties";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (r) =>
    ["localhost", "127.0.0.1"].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort(),
  );
});

async function start(page: Page, path = "/") {
  await page.goto(path);
  await page.getByRole("button", { name: "Ask Fetch" }).click();
  return page.getByRole("dialog", { name: "Ask Fetch" });
}
async function ask(page: Page, question: string) {
  const input = page.getByRole("textbox", { name: "Ask Fetch a question" });
  await input.fill(question);
  await input.press("Enter");
}

async function economy(page: Page) {
  await page.route("**/v1/counties/*/*/economic-data", (r) => {
    const slug = new URL(r.request().url()).pathname.split("/")[4];
    const potter = slug === "potter";
    const fips = { potter: "48375", randall: "48381", king: "48269", lubbock: "48303" }[slug] || "";
    return r.fulfill({
      json: {
        county: { fips },
        metrics: [
          {
            key: "gross-domestic-product",
            frequency: "Annual",
            valueKind: "currency-thousands",
            units: "Thousands of dollars",
            latest: { date: potter ? "2024-01-01" : "2023-01-01", value: potter ? 4000 : 3000 },
            observations: [{ date: "2020-01-01", value: potter ? 1200 : 2000 }],
            source: "BEA",
            seriesId: "GDP" + fips,
            seriesUrl: "https://fred.stlouisfed.org/series/GDP" + fips,
          },
        ],
      },
    });
  });
}

test("compares a shared state and year, preserves both counties and explains mismatched dates", async ({
  page,
}) => {
  await economy(page);
  const d = await start(page);
  await ask(page, "Compare GDP in Potter and Randall counties in Texas in 2020");
  await expect(d.getByText(/Randall County, TX has the higher published figure by \$800,000/)).toBeVisible();
  await expect(
    d.getByRole("region", { name: "Potter County, TX" }).getByRole("link", { name: "BEA via FRED" }),
  ).toHaveAttribute("href", /GDP48375$/);
  const extraRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/economic-data")) extraRequests.push(r.url());
  });
  await d.getByRole("combobox", { name: "Year", exact: true }).selectOption("2023");
  await expect(d.getByText("No published figure for 2023.")).toBeVisible();
  await ask(page, "And in 1990?");
  await expect(d.getByText("No published figure for 1990.")).toHaveCount(2);
  await ask(page, "Latest");
  await expect(d.getByText(/direct difference is unavailable/)).toBeVisible();
  await expect(d.getByText(/higher published figure/)).toHaveCount(0);
  expect(extraRequests).toEqual([]);
  await ask(page, "Show weather in Seattle, WA");
  await expect(d.getByRole("link", { name: "Open full weather report" })).toHaveAttribute(
    "href",
    "/washington/king/weather",
  );
});

test("resolves ambiguous counties by state, keeps cross-state qualifiers, and preserves missing records", async ({
  page,
}) => {
  const asked: string[] = [];
  await page.route("**/v1/counties/*/*/atlas/housing", (r) => {
    const path = new URL(r.request().url()).pathname;
    asked.push(path);
    const state = path.split("/")[3],
      slug = path.split("/")[4];
    const fips =
      state === "oregon" ? "41067" : state === "utah" ? "49053" : slug === "randall" ? "48381" : "42105";
    if (state === "utah") return r.fulfill({ status: 503, body: "unavailable" });
    return r.fulfill({
      json: {
        county: { fips, slug, stateSlug: state },
        domain: { slug: "housing" },
        meta: { version: "1", cacheTtlSeconds: 60 },
        metrics: [
          {
            key: "median-gross-rent",
            value: slug === "randall" ? 1210 : 1200,
            valueKind: "currency",
            unit: "Dollars",
            date: "2024-12-31",
            vintage: "2024 ACS 5-year",
            marginOfError: 30,
            suppressed: state === "pennsylvania",
            source: { name: "Census", id: "acs", url: "https://www.census.gov/" },
          },
        ],
      },
    });
  });
  const d = await start(page);
  await ask(page, "Which county has higher rent, Potter or Randall?");
  await expect(d.getByRole("combobox", { name: "County 1", exact: true })).toHaveValue("");
  expect(asked).toHaveLength(0);
  await ask(page, "Pennsylvania");
  await expect(d.getByRole("region", { name: "Potter County, PA" })).toContainText("Suppressed");
  await expect(d.getByRole("region", { name: "Randall County, TX" })).toContainText("Margin of error ±$30");
  await expect(d.getByText(/higher published figure/)).toHaveCount(0);
  await ask(page, "Compare rent in Washington County, OR and Randall County, TX");
  await expect(
    d.getByText(/higher published figure by \$10. The published margins of error overlap/),
  ).toBeVisible();
  await ask(page, "Compare rent in Washington County, OR and Washington County, UT");
  await expect(d.getByRole("region", { name: "Washington County, OR" })).toContainText("$1,200");
  await expect(d.getByRole("region", { name: "Washington County, UT" })).toContainText(
    "temporarily unavailable",
  );
  await expect(d.getByRole("link", { name: "Open Washington County data" }).last()).toHaveAttribute(
    "href",
    "/utah/washington/data/housing",
  );
});

test("County edition pickers and city follow-ups carry the correct county and year", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await economy(page);
  const d = await start(page, "/texas/potter");
  await d.getByRole("button", { name: "Compare counties", exact: true }).click();
  await expect(d.getByRole("combobox", { name: "County 1", exact: true })).toHaveValue("48375");
  await d.getByRole("combobox", { name: "County 2", exact: true }).selectOption("48381");
  await d.getByRole("combobox", { name: "Measure", exact: true }).selectOption("gdp");
  await expect(d.getByText(/direct difference is unavailable/)).toBeVisible();
  expect(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await ask(page, "What was GDP in Amarillo, Texas in 2020?");
  await d.getByRole("button", { name: "Compare these counties" }).click();
  await expect(d.getByText(/higher published figure by \$800,000/)).toBeVisible();
  await ask(page, "What was GDP in Randall County, Texas in 2020?");
  await ask(page, "Compare that with Potter County, Texas");
  await expect(d.getByRole("combobox", { name: "County 1", exact: true })).toHaveValue("48381");
  await expect(d.getByText(/higher published figure by \$800,000/)).toBeVisible();
  await ask(page, "Compare GDP in Potter, Randall and King counties in Texas");
  await expect(d.getByRole("region", { name: "King County, TX" })).toContainText("$3M");
  await ask(page, "And in 2020?");
  await expect(d.getByText(/Highest published figure: Randall County, TX.*King County, TX/)).toBeVisible();
  await ask(page, "Add Lubbock County, Texas");
  await expect(d.getByRole("region", { name: "Lubbock County, TX" })).toContainText("$2M");
  await expect(d.getByRole("combobox", { name: "Year", exact: true })).toHaveValue("2020");
  await d.getByRole("button", { name: "Remove place 2", exact: true }).click();
  await expect(d.getByRole("region", { name: "Randall County, TX" })).toHaveCount(0);
  await expect(d.getByRole("region", { name: "King County, TX" })).toBeVisible();
  await expect(d.getByText(/higher published figure/)).toHaveCount(0);
});

test("county comparisons preserve compound borough names and distinguish independent cities", async ({
  page,
}) => {
  const d = await start(page);
  for (const [question, first, second] of [
    [
      "Compare population in Lake and Peninsula Borough and Denali Borough, AK",
      "Lake and Peninsula Borough, AK",
      "Denali Borough, AK",
    ],
    [
      "Compare rent in Juneau City and Borough and Anchorage Municipality, AK",
      "Juneau City and Borough, AK",
      "Anchorage Municipality, AK",
    ],
    [
      "Compare Newport News City and Richmond City, VA by population",
      "Newport News City, VA",
      "Richmond City, VA",
    ],
  ]) {
    await ask(page, question);
    await expect(d.getByRole("region", { name: first })).toBeVisible();
    await expect(d.getByRole("region", { name: second })).toBeVisible();
  }
});

test("mixed comparisons keep statewide totals and every county even when a source lacks a measure", async ({
  page,
}) => {
  await economy(page);
  const d = await start(page);
  await ask(page, "Compare GDP in Potter County, TX, Randall County, TX and the state of Oklahoma in 2020");
  await expect(d.getByRole("heading", { name: "Compare states and counties" })).toBeVisible();
  await expect(d.getByRole("region", { name: "Potter County, TX" })).toContainText("$1.2M");
  await expect(d.getByRole("region", { name: "Randall County, TX" })).toContainText("$2M");
  await expect(d.getByRole("region", { name: "Oklahoma", exact: true })).toContainText("No statewide figure");
  await ask(page, "What about population in 2025?");
  await expect(d.getByRole("region", { name: "Oklahoma", exact: true })).toContainText("July 1, 2025");
  await d.getByRole("button", { name: "Add another place" }).click();
  await d.getByRole("combobox", { name: "State 4", exact: true }).selectOption("kansas");
  await d.getByRole("combobox", { name: "County 4", exact: true }).selectOption("statewide");
  await expect(d.getByRole("region", { name: "Kansas", exact: true })).toContainText(
    "Census population estimates",
  );
});

test("state lists can grow by prompt or picker, and a long pasted list reaches its last state", async ({
  page,
}) => {
  const d = await start(page);
  await ask(page, "Compare population in Texas, Oklahoma and Kansas");
  await expect(d.locator("dt")).toHaveText(["Texas", "Oklahoma", "Kansas"]);
  await ask(page, "Add New Mexico and Colorado");
  await expect(d.locator("dt")).toHaveText(["Texas", "Oklahoma", "Kansas", "New Mexico", "Colorado"]);
  await d.getByRole("combobox", { name: "Add a state", exact: true }).selectOption("nebraska");
  await expect(d.locator("dt").last()).toHaveText("Nebraska");
  await d.getByRole("combobox", { name: "State 3", exact: true }).selectOption("");
  await expect(d.locator("dt")).toHaveText(["Texas", "Oklahoma", "New Mexico", "Colorado", "Nebraska"]);
  const names = await d
    .getByRole("combobox", { name: "State 1", exact: true })
    .locator("option")
    .allTextContents();
  await ask(page, "Compare population in " + names.slice(1).join(", "));
  await expect(d.locator("dt")).toHaveText(names.slice(1));
});

test("a third county keeps its own state, and correcting it leaves the other results in place", async ({
  page,
}) => {
  await economy(page);
  const d = await start(page);
  await ask(page, "Compare GDP in Potter County, TX, Missingplace County, TX, and King County, TX in 2020");
  await expect(d.getByText(/Which place did you mean by “Missingplace County”/)).toBeVisible();
  await expect(d.getByRole("region", { name: "King County, TX" })).toContainText("$2M");
  await d.getByRole("combobox", { name: "County 2", exact: true }).selectOption("48381");
  await expect(d.getByText(/Highest published figure: Randall County, TX.*King County, TX/)).toBeVisible();
  await ask(page, "Compare GDP in Washington County, OR, Washington County, UT, and Washington County, PA");
  for (const abbr of ["OR", "UT", "PA"])
    await expect(d.getByRole("region", { name: "Washington County, " + abbr })).toBeVisible();
});

test("a county can join a statewide survey comparison, keeping a common period and source", async ({
  page,
}) => {
  await page.route("**/v1/counties/texas/potter/atlas/housing", (r) =>
    r.fulfill({
      json: {
        county: { fips: "48375" },
        domain: { slug: "housing" },
        meta: { cacheTtlSeconds: 60 },
        metrics: [
          {
            key: "median-gross-rent",
            value: 750,
            valueKind: "currency",
            unit: "Dollars",
            date: "2024-12-31",
            vintage: "2024 ACS 5-year",
            source: {
              name: "American Community Survey",
              id: "census-acs",
              url: "https://www.census.gov/programs-surveys/acs",
            },
          },
        ],
      },
    }),
  );
  const d = await start(page);
  await ask(page, "Compare rent in Texas and Oklahoma in 2024");
  await ask(page, "Add Potter County, TX");
  await expect(d.getByRole("region", { name: "Potter County, TX" })).toContainText("$750");
  await expect(d.getByText(/Highest published figure: Texas.*Lowest: Potter County, TX/)).toBeVisible();
  await ask(page, "Compare rent in Texas, Oklahoma, and Potter County, Texas");
  await expect(d.getByText(/Highest published figure: Texas.*Lowest: Potter County, TX/)).toBeVisible();
  await expect(d.getByRole("region", { name: "Oklahoma", exact: true })).toContainText(
    "2020–2024 survey estimate",
  );
});

test("a pasted comparison retains every county and county equivalent in directory order", async ({
  page,
}) => {
  const d = await start(page);
  const names = counties.map((c) => c.displayName + ", " + c.state.abbr);
  await ask(page, "Compare " + names.join(", "));
  const selections = d.locator(".fetch-state-pickers button");
  await expect(selections).toHaveCount(names.length);
  expect(await selections.allTextContents()).toEqual(names.map((name) => "Edit " + name));
});

test("spoken ranking, removal, and adding a county for a different year keep the comparison", async ({
  page,
}) => {
  await economy(page);
  const d = await start(page);
  await ask(page, "Compare GDP in Potter and Randall counties in Texas");
  await ask(page, "Add King County, Texas for 2020");
  await expect(d.getByRole("combobox", { name: "Year", exact: true })).toHaveValue("2020");
  await expect(d.getByRole("region", { name: "King County, TX" })).toContainText("$2M");
  await ask(page, "Which one has the lowest GDP?");
  await expect(d.getByText(/Lowest published figure: Potter County, TX/)).toBeVisible();
  await ask(page, "Remove Randall County");
  await expect(d.getByText(/Potter County, TX has the lower published figure by \$800,000/)).toBeVisible();
  await expect(d.getByRole("region", { name: "Randall County, TX" })).toHaveCount(0);
  await ask(page, "Compare population in Texas, Oklahoma and New Mexico");
  await ask(page, "Which has the most?");
  await expect(d.getByText(/Highest: Texas.*Lowest: New Mexico/)).toBeVisible();
  await ask(page, "Leave out Oklahoma");
  await expect(d.locator("dt")).toHaveText(["Texas", "New Mexico"]);
  await ask(page, "Which is smaller?");
  await expect(d.getByText(/New Mexico has the lower figure/)).toBeVisible();
});

test("removing a shared county name needs its state and leaves the other selections intact", async ({
  page,
}) => {
  const d = await start(page);
  await ask(page, "Compare GDP in Washington County UT and Washington County OR and Potter County TX");
  await ask(page, "Remove Washington County");
  await expect(d.getByText(/name matches more than one selection/)).toBeVisible();
  await expect(d.locator(".fetch-measure section")).toHaveCount(3);
  await ask(page, "Remove Washington County, UT");
  await expect(d.locator(".fetch-measure section")).toHaveCount(2);
  await expect(d.getByRole("region", { name: "Washington County, OR" })).toBeVisible();
});
