import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

async function open(page: Page, path = "/") {
  await page.goto(path);
  await page.getByRole("button", { name: "Ask Fetch" }).click();
  return page.getByRole("dialog", { name: "Ask Fetch" });
}
async function ask(page: Page, question: string) {
  const input = page.getByRole("textbox", { name: "Ask Fetch a question" });
  await input.fill(question);
  await input.press("Enter");
}
test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith("/v1/") || !["localhost", "127.0.0.1"].includes(u.hostname))
      return route.abort();
    return route.continue();
  });
});
for (const history of [true, false]) {
  test(
    "ordinary rent question with " + (history ? "two common periods" : "one common period"),
    async ({ page }) => {
      await page.route("**/v1/counties/texas/*/atlas/housing", (route) => {
        const potter = route.request().url().includes("/potter/");
        return route.fulfill({
          json: {
            county: { fips: potter ? "48375" : "48381" },
            domain: { slug: "housing" },
            meta: { cacheTtlSeconds: 60 },
            metrics: [
              {
                key: "median-gross-rent",
                value: potter ? 1200 : 1300,
                valueKind: "currency",
                unit: "dollars",
                vintage: "2024 ACS 5-year",
                date: "2024-12-31",
                source: { id: "acs", name: "Census", url: "https://www.census.gov/" },
                observations: history ? [{ date: "2019-12-31", value: 1000 }] : [],
              },
            ],
          },
        });
      });
      const d = await open(page);
      await ask(page, "Is rent going up faster in Potter County or Randall County, Texas?");
      if (history) {
        await expect(d.getByText(/2019 to 2024.*Randall County had the larger increase/)).toBeVisible();
        await expect(d.getByText(/Potter County, TX.*\+20%/)).toBeVisible();
      } else {
        await expect(d.getByText(/one comparable year is 2024/)).toBeVisible();
      }
      await d.getByRole("button", { name: "Compare latest rents" }).click();
      await expect(d.getByText(/higher published figure by \$100/)).toBeVisible();
    },
  );
}

const story = (id: string, title: string, description = "") => ({
  id,
  title,
  description,
  source: "Local Journal",
  publishedAt: "2026-01-11",
  link: "https://local.example/" + id,
});
const updated = "2026-05-10T16:00:00Z";
function bundle(items: ReturnType<typeof story>[], stale = false) {
  return {
    scope: { trustedHosts: ["local.example"] },
    sections: { localNews: { items, meta: { stale, fetchedAt: updated } } },
  };
}
test("remembered story finds the matching sentence and earlier reporting in the right county", async ({
  page,
}) => {
  let expanded = false;
  await page.route("**/v1/pages/counties/texas/*?**", (r) => {
    const u = new URL(r.request().url());
    const items = u.pathname.includes("/potter")
      ? [
          story("wedding", "Wedding on a budget"),
          story(
            "school",
            "Board meets",
            "The chair opened the meeting. The school budget includes a library.",
          ),
        ]
      : [];
    if (u.searchParams.get("limit") === "150" && u.pathname.includes("/potter")) {
      expanded = true;
      items.push(
        { ...story("earlier", "School budget proposal from September"), publishedAt: "2025-09-18" },
        { ...story("newer", "New school budget announcement"), publishedAt: "2026-01-12" },
      );
    }
    return r.fulfill({ json: bundle(items, true) });
  });
  const d = await open(page);
  await ask(page, "What was that story about the school budget in Amarillo, Texas?");
  const potter = d.getByRole("region", { name: "Potter County, TX", exact: true });
  await expect(potter.getByRole("link", { name: "Board meets" })).toBeVisible();
  await expect(potter.getByText("The school budget includes a library.", { exact: true })).toBeVisible();
  await expect(potter.getByText(/oldest cached feed update.*May 10, 2026/i)).toBeVisible();
  await expect(potter.getByRole("link", { name: "Wedding on a budget" })).toHaveCount(0);
  await expect(potter.getByText("Site pages and features")).toHaveCount(0);
  await potter.getByRole("button", { name: "Search earlier coverage" }).click();
  await expect(potter.getByRole("link", { name: "School budget proposal from September" })).toBeVisible();
  await expect(potter.getByRole("link", { name: "Board meets" })).toHaveCount(0);
  expect(await potter.ariaSnapshot()).toContain("School budget proposal from September");
  await expect(potter.getByRole("link", { name: "New school budget announcement" })).toHaveCount(0);
  await potter.getByRole("button", { name: "Back to initial matches" }).click();
  await expect(potter.getByRole("link", { name: "Board meets" })).toBeVisible();
  expect(expanded).toBe(true);
});

test("a failed news lookup retries the same question despite client backoff", async ({ page }) => {
  let healthy = false;
  await page.route("**/v1/pages/counties/texas/potter?**", (r) =>
    healthy
      ? r.fulfill({ json: bundle([story("road", "Road repairs approved")]) })
      : r.fulfill({ status: 500, body: "offline" }),
  );
  const d = await open(page);
  await ask(page, "Find articles about road repairs in Potter County, Texas");
  await expect(d.getByRole("button", { name: "Try again" })).toBeVisible();
  healthy = true;
  const retry = d.getByRole("button", { name: "Try again" });
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(d.locator(".fetch-answer h3")).toBeFocused();
  await expect(d.getByRole("link", { name: "Road repairs approved" })).toBeVisible();
  await expect(d.getByRole("button", { name: "Try again" })).toHaveCount(0);
});

test("a returning mobile reader gets dated news, forecast and next meeting for the saved county", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.route("**/v1/pages/counties/texas/potter?**", (r) =>
    r.fulfill({ json: bundle([story("park", "Park renovation begins")]) }),
  );
  const tomorrow = new Date(Date.now() + 86400000);
  await page.route("**/v1/counties/texas/potter/weather", (r) =>
    r.fulfill({
      json: {
        county: { fips: "48375" },
        location: { timeZone: "America/Chicago" },
        zones: {},
        forecast: [
          {
            name: "Tomorrow",
            startTime: tomorrow.toISOString(),
            endTime: new Date(+tomorrow + 3600000).toISOString(),
            shortForecast: "Clear skies",
          },
        ],
        hourly: [],
        alerts: [],
        warnings: [],
        meta: { cacheTtlSeconds: 60, alertsCacheTtlSeconds: 60, source: { links: {} } },
      },
    }),
  );
  const first = tomorrow.toISOString().slice(0, 10);
  const notice = (title: string, date?: string) => ({
    title,
    id: title,
    countyFips: ["48375"],
    category: "meeting",
    eventDate: date,
    publishedAt: first,
    url: "https://local.example/meeting",
    sourceName: "Clerk",
    geographyLabel: "Potter County",
  });
  await page.route("**/v1/counties/texas/potter/public-notices?**", (r) => {
    const offset = Number(new URL(r.request().url()).searchParams.get("offset"));
    return r.fulfill({
      json: {
        county: { state: "texas", county: "potter", fips: "48375" },
        sources: [],
        items: offset
          ? [notice("First upcoming meeting", first)]
          : [
              notice("Later meeting", "2099-01-01"),
              notice("Past meeting", "2020-01-01"),
              notice("Publication only"),
            ],
        meta: { rollout: "texas", status: "current", offset, hasMore: !offset, totalAvailable: 4 },
      },
    });
  });
  let d = await open(page, "/texas/potter");
  await d.getByRole("button", { name: /Remember Potter County/ }).click();
  d = await open(page, "/ohio");
  await d.getByRole("button", { name: /Catch me up.*Potter County/ }).click();
  await expect(d.getByRole("heading", { name: "County briefing" })).toBeVisible();
  await expect(d.getByRole("link", { name: "Park renovation begins" })).toBeVisible();
  await expect(d.getByText(/Clear skies/)).toBeVisible();
  await expect(d.getByRole("link", { name: "First upcoming meeting" })).toBeVisible();
  await expect(d.getByRole("link", { name: "Later meeting" })).toHaveCount(0);
  await d.getByRole("button", { name: /Forget Potter County/ }).click();
  await ask(page, "Who reported the first story?");
  await expect(d.getByText("Reported by Local Journal.")).toBeVisible();
  d = await open(page);
  await d.getByRole("button", { name: "Catch me up", exact: true }).click();
  await expect(d.getByRole("combobox", { name: "State", exact: true })).toBeVisible();
});

test("the screenshot question compares both city police rates without a feed service", async ({ page }) => {
  const d = await open(page);
  await ask(page, "which has a higher crime rate statistic, Amarillo, Texas or Lubbock, Texas?");
  await expect(
    d.getByText(
      /Lubbock, TX had the higher reported index crime rate in 2025.*3,103\.23 offenses and Amarillo, TX reported 3,006\.43/,
    ),
  ).toBeVisible();
  await expect(d.getByText(/Amarillo Police Department.*3,006.43.*6,149 offenses/)).toBeVisible();
  await expect(d.getByText(/Lubbock Police Department.*3,103.23.*8,556 offenses/)).toBeVisible();
  for (const c of ["potter", "randall", "lubbock"]) {
    await expect(d.locator('a[href="/texas/' + c + '/data/public-safety"]')).toBeVisible();
  }
  await expect(d.getByRole("link", { name: /Texas DPS/ })).toHaveAttribute(
    "href",
    /crimes_by_jurisdiction.xlsx$/,
  );
  await ask(page, "What about violent crime?");
  await expect(d.getByText(/Lubbock, TX had the higher reported violent index crime rate/)).toBeVisible();
  await ask(page, "And in 2020?");
  await expect(d.getByText(/requested period is unavailable/)).toBeVisible();
  await expect(d.getByText(/had the higher reported/)).toHaveCount(0);
});

test("city comparison preserves scope, partial coverage, and ambiguous city names", async ({ page }) => {
  const d = await open(page, "/ohio");
  await ask(page, "Does Amarillo, Texas have a higher crime rate than Lubbock, Texas?");
  await expect(d.getByText(/Lubbock, TX had the higher/)).toBeVisible();
  await ask(page, "Compare crime rates in Lubbock, Texas and Seattle, Washington");
  await expect(d.getByRole("heading", { name: "Seattle, WA" })).toBeVisible();
  await expect(d.getByText(/no verified full-year city police figure/)).toBeVisible();
  await expect(d.getByText(/Lubbock Police Department.*3,103.23/)).toBeVisible();
  await expect(d.getByText(/had the higher reported/)).toHaveCount(0);
  await ask(page, "Compare crime rates in Reno and Lubbock, Texas");
  const choices = d.getByRole("combobox", { name: /Which Reno/ });
  await choices.selectOption({ label: "Reno, TX · Lamar County" });
  await expect(d.getByRole("heading", { name: "Lubbock, TX" })).toBeVisible();
  await expect(d.getByRole("heading", { name: "Reno, TX" })).toBeVisible();
});

test("a two-city rent question keeps the second city's county while narrowing Amarillo", async ({ page }) => {
  const d = await open(page, "/texas/potter");
  await ask(page, "Compare rent in Amarillo and Lubbock, Texas");
  await expect(
    d.getByText(/Amarillo, TX covers Potter County and Randall County.*Lubbock, TX covers Lubbock County/),
  ).toBeVisible();
  await expect(d.getByRole("combobox", { name: "County 2" })).toHaveValue("48303");
  await expect(d.getByRole("combobox", { name: "County 1" }).locator("option")).toHaveCount(3);
});

test("county crime figures agree on the page, in downloads and in Fetch during an API outage", async ({ page }) => {
  await page.goto("/texas/potter/data/public-safety");
  const rate = page.locator(".atlas-metric-card").filter({has: page.getByRole("heading", {name: "Reported violent crime rate", exact: true})});
  await expect(rate.locator(".atlas-metric-value")).toHaveText("538.6 per 100,000 reporting population");
  await expect(page.getByText("5,074 offenses", {exact: true})).toBeVisible();
  for (const format of ["JSON", "CSV"]) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", {name: "Download " + format}).click();
    const contents = await readFile((await (await download).path())!, "utf8");
    if (format === "JSON") {
      const document = JSON.parse(contents);
      expect(document.county.fips).toBe("48375");
      expect(document.metrics).toEqual(expect.arrayContaining([expect.objectContaining({key: "violent-crime-count", value: 1184, coveragePercent: 100})]));
    } else {
      expect(contents).toContain("violent-crime-rate,Reported violent crime rate,538.6");
    }
  }
  const d = await open(page);
  await ask(page, "What is the violent crime rate in Potter County, Texas?");
  await expect(d.getByText(/538.6 per 100,000 reporting population.*2025/)).toBeVisible();
  await expect(d.locator('a[href="/texas/potter/data/public-safety"]')).toBeVisible();
  await ask(page, "Compare violent crime rates in Potter County and Lubbock County, Texas");
  await expect(d.getByText(/655 per 100,000 reporting population/)).toBeVisible();
  await expect(d.getByText(/538.6 per 100,000 reporting population/)).toBeVisible();
  await expect(d.getByText(/Participating agencies in Lubbock County, TX recorded the higher figure.*Reporting coverage is incomplete/i)).toBeVisible();
});

test("county crime history and missing coverage stay labeled on the page and in Fetch", async ({ page }) => {
  await page.goto("/connecticut/tolland/data/public-safety");
  await expect(page.getByText("32.94 per 100,000 residents", {exact:true})).toBeVisible();
  await expect(page.getByText("2024 · historical observation", {exact:true}).first()).toBeVisible();
  await page.goto("/hawaii/kalawao/data/public-safety");
  await expect(page.getByText(/No verified county crime figures are available for Kalawao/)).toBeVisible();
  await expect(page.getByText(/State context only · Hawaii, 2025/)).toBeVisible();
  await expect(page.getByRole("heading", {name: "Reported violent crime rate"})).toHaveCount(0);
  const d = await open(page, "/hawaii/kalawao");
  await ask(page, "What is the violent crime rate here?");
  await expect(d.getByText(/No verified county crime figures are available for Kalawao/)).toBeVisible();
  await expect(d.getByText(/State context only · Hawaii, 2025/)).toBeVisible();
});

test("Fetch opens the individual stock quote and guides the reader to it", async ({ page }) => {
  await page.route("**/tv-single-ticker.js", r => r.fulfill({
    contentType: "text/javascript", headers: { "Access-Control-Allow-Origin": "*" },
    body: `customElements.define("tv-single-ticker",class extends HTMLElement { connectedCallback(){
      this.textContent = this.getAttribute("symbol") + " 123.45 USD";
    }});`,
  }));
  const d = await open(page, "/ohio");
  await ask(page, "What is Apple stock trading at?");
  const card = d.frameLocator('iframe[title="Apple ticker by TradingView"]');
  await expect(card.getByText("NASDAQ:AAPL 123.45 USD")).toBeVisible();
  await d.getByRole("link", { name: "Show Apple on the Market desk" }).click();
  await expect(page).toHaveURL(/\/ohio#market-quote-aapl$/);
  await expect(page.locator("#market-quote-aapl")).toBeFocused();
  await expect(page.locator("#fetch-guide .market-quote-frame")).toHaveCount(0);
  await expect(page.locator("#market-quote-aapl")).toHaveClass(/fetch-arrival-target/);
  await expect(page.locator(".fetch-arrival-dog")).toBeVisible();
  await expect(page.locator("#market-quote-aapl").frameLocator("iframe").getByText("NASDAQ:AAPL 123.45 USD")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".fetch-arrival-dog")).toBeHidden();
  await page.goBack();
  await expect(page.locator(".fetch-arrival-target")).toHaveCount(0);
});

test("steer and heifer questions use the requested USDA weight band and guide to that row", async ({ page }) => {
  await page.route("**/v1/markets/cattle", r => r.fulfill({json: {
    stale: true, partial: true, items: [{key:"feeder-cattle", label:"Feeder cattle", price:300, unit:"Per Cwt", reportDate:"11/16/2026", market:"Test auction", breakdown:[
      {label:"Steers 500–549", price:412.33, unit:"Per Cwt"}, {label:"Steers 600–649", price:387, unit:"Per Cwt"},
      {label:"Heifers 500–549", price:355, unit:"Per Cwt"}]}],
  }}));
  const d = await open(page);
  await ask(page, "How much are 525 pound heifers going for?");
  await expect(d.getByText(/Heifers 500–549 lb.*355.00 per 100 lb.*Test auction.*11\/16\/2026/)).toBeVisible();
  await expect(d.getByText(/Last available USDA report/)).toBeVisible();
  await expect(d.getByText(/412.33/)).toHaveCount(0);
  await ask(page, "What are steers bringing per 100 lb?");
  await expect(d.getByText(/Steers 500–549 lb.*412.33/)).toBeVisible();
  await expect(d.getByText(/Steers 600–649 lb.*387.00/)).toBeVisible();
  await ask(page, "What is the price of a 750 pound steer?");
  await expect(d.getByText(/no price for that class or weight/)).toBeVisible();
  await expect(d.getByText(/387.00/)).toHaveCount(0);
  await ask(page, "Take me to 600 lb steer prices");
  const target = page.locator("#market-steers-600-649");
  await expect(target).toHaveClass(/fetch-arrival-target/);
  await expect(target).toContainText("$387.00");
  await expect(d).toBeHidden();
  await page.getByRole("button", {name:"Ask Fetch"}).click();
  await expect(d.getByText(/Steers 600–649 lb.*387.00/)).toBeVisible();
  await ask(page, "Compare population in Texas and Oklahoma");
  await expect(d.locator("dt")).toHaveText(["Texas","Oklahoma"]);
});

test("Fetch marks the requested measure after a route change and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const d = await open(page);
  await ask(page, "What is the violent crime rate in Potter County, Texas?");
  await d.getByRole("link", {name:"Open full desk"}).click();
  const metric = page.locator("#atlas-violent-crime-rate");
  await expect(metric).toBeFocused();
  await expect(metric).toHaveCSS("animation-name", "none");
  await expect(page.locator(".fetch-arrival-dog")).toHaveAttribute("src", /fetch-collie.*webp/);
  await expect(metric).not.toHaveClass(/fetch-arrival-target/, {timeout: 7500});
  await page.reload();
  await expect(page.locator(".fetch-arrival-dog")).toBeHidden();
});

test("all ticker symbols resolve and mixed stock and metal questions retain available quotes", async ({ page }) => {
  const { marketInstruments, marketRequest } = await import("../../src/data/market-instruments");
  expect(marketInstruments).toHaveLength(20);
  for (const m of marketInstruments) {
    expect(marketRequest("Price of " + m.name).instruments).toContain(m);
    expect(marketRequest(m.ticker).matches).toBe(true);
    expect(marketRequest(m.symbol).instruments).toEqual([m]);
  }
  expect(marketRequest("Weather in Silver City today").matches).toBe(false);
  expect(marketRequest("What’s Apple at?").matches).toBe(true);
  expect(marketRequest("Market prices")).toMatchObject({equities:true, includeMetals:true, cattle:true});
  expect(marketRequest("Feeder cattle market prices").equities).toBe(false);
  const d = await open(page);
  await ask(page, "Show stock prices");
  const picker = d.getByLabel("Market symbol");
  await expect(picker.locator("option")).toHaveCount(21);
  await picker.selectOption("BITSTAMP:BTCUSD");
  await expect(d.getByRole("heading",{name:"Bitcoin · BTCUSD"})).toBeVisible();
  await ask(page, "What are the prices of gold and Nvidia?");
  await expect(d.getByRole("heading",{name:"Nvidia · NVDA"})).toBeVisible();
  await expect(d.getByText("Metal spot prices are temporarily unavailable.")).toBeVisible();
  await expect(d.getByRole("link",{name:"See metal prices"})).toHaveAttribute("href","/itm-trading");
});

test("city lists preserve every jurisdiction, partial coverage and a separate shared state", async ({
  page,
}) => {
  const d = await open(page);
  for (const question of [
    "Which has a higher crime rate, Amarillo, Texas, Lubbock, Texas, or Dallas, Texas?",
    "Compare crime rates in Amarillo, Lubbock, and Dallas, Texas",
  ]) {
    await ask(page, question);
    await expect(d.locator("h4")).toHaveText(["Amarillo, TX", "Lubbock, TX", "Dallas, TX"]);
    await expect(
      d.getByText(/Highest reported index crime rate.*Dallas, TX.*Lowest: Amarillo, TX/),
    ).toBeVisible();
  }
  await ask(page, "Which has the lower crime rate, Lubbock, Texas or Amarillo, Texas?");
  await expect(d.getByText(/Amarillo, TX had the lower reported index crime rate/)).toBeVisible();
  await ask(page, "Compare crime rates in Austin, Houston and Dallas, Texas");
  await expect(d.locator("h4")).toHaveText(["Austin, TX", "Houston, TX", "Dallas, TX"]);
  await ask(page, "Compare crime rates in Amarillo, TX, Seattle, WA, and Dallas, TX");
  await expect(d.locator("h4")).toHaveText(["Amarillo, TX", "Seattle, WA", "Dallas, TX"]);
  await expect(d.getByText(/no verified full-year city police figure/)).toBeVisible();
  await expect(d.getByText(/highest reported/i)).toHaveCount(0);
  await ask(page, "Compare crime rates in Amarillo, TX, Imaginaryville, TX, and Dallas, TX");
  await expect(d.getByText(/couldn’t match every city.*Imaginaryville/)).toBeVisible();
  await expect(d.getByText(/highest reported/i)).toHaveCount(0);
});

test("a housing comparison keeps the other cities while clarifying an ambiguous city", async ({ page }) => {
  const d = await open(page, "/ohio");
  await ask(page, "Compare rent in Reno, Amarillo and Lubbock, Texas");
  await d.getByRole("combobox", { name: "Which Reno?" }).selectOption({ label: "Reno, TX · Lamar County" });
  await expect(
    d.getByText(
      /Reno, TX covers Lamar County.*Amarillo, TX covers Potter County and Randall County.*Lubbock, TX covers Lubbock County/,
    ),
  ).toBeVisible();
  await expect(d.getByRole("combobox", { name: "County 3", exact: true })).toHaveValue("48303");
  await ask(page, "Compare median rent in Portland OR and Seattle WA and Denver CO");
  await expect(
    d.getByText(/Portland, OR covers .*Seattle, WA covers King County.*Denver, CO covers Denver County/),
  ).toBeVisible();
});

test("changing the question or closing Fetch cancels a late navigation request", async ({ page }) => {
  // Simulate a provider that finishes even after the reader has canceled.
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    const pending: (() => void)[] = [];
    Object.assign(window, { pendingCattle: pending });
    window.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      if (url.pathname !== "/v1/markets/cattle") return original(input, init);
      return new Promise<Response>((resolve) =>
        pending.push(() =>
          resolve(
            Response.json({
              partial: true,
              items: [
                {
                  key: "feeder-cattle",
                  label: "Feeder cattle",
                  price: 300,
                  unit: "Per Cwt",
                  breakdown: [{ label: "Steers 600–649", price: 375, unit: "Per Cwt" }],
                },
              ],
            }),
          ),
        ),
      );
    };
  });
  const d = await open(page);
  const pending = () =>
    page.evaluate(() => (window as Window & { pendingCattle?: unknown[] }).pendingCattle?.length || 0);
  const release = () =>
    page.evaluate(() => {
      const requests = (window as Window & { pendingCattle?: (() => void)[] }).pendingCattle;
      for (const finish of requests?.splice(0) || []) finish();
      return new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
  // The masthead may also request this provider. Clear its initial request before the reader asks.
  await release();
  for (const action of ["new question", "close"]) {
    await ask(page, "Take me to 600 lb steer prices");
    await expect.poll(pending).toBeGreaterThan(0);
    if (action === "new question") {
      await ask(page, "Compare population in Texas, Utah and Oregon");
      await expect(d.locator("dt")).toHaveText(["Texas", "Utah", "Oregon"]);
    } else {
      await d.getByRole("button", { name: "Close Fetch" }).click();
      await expect(page.getByRole("button", { name: "Ask Fetch" })).toBeFocused();
    }
    await release();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(".fetch-arrival-target")).toHaveCount(0);
    if (action === "new question") await expect(d.locator("dt")).toHaveText(["Texas", "Utah", "Oregon"]);
    else await expect(d).toBeHidden();
  }
});

test("a national reader can ask about weekend and night forecasts across the Amarillo counties", async ({
  page,
}) => {
  // Already Saturday in UTC, still Friday in both county editions.
  await page.clock.setFixedTime(new Date("2026-11-21T04:30:00Z"));
  const forecast = [
    ["Friday Night", 20, 18, "Clear"],
    ["Saturday", 21, 6, "Rain"],
    ["Saturday Night", 21, 18, "Showers"],
    ["Sunday", 22, 6, "Sunny"],
    ["Sunday Night", 22, 18, "Cloudy"],
  ].map(([name, day, hour, shortForecast]) => {
    const start = Date.UTC(2026, 10, Number(day), Number(hour) + 6);
    return {
      name,
      isDaytime: hour === 6,
      startTime: new Date(start),
      endTime: new Date(start + 12 * 3600000),
      shortForecast,
    };
  });
  await page.route("**/v1/counties/texas/*/weather", (route) =>
    route.fulfill({
      json: {
        county: { fips: route.request().url().includes("/potter/") ? "48375" : "48381" },
        location: { timeZone: "America/Chicago" },
        zones: {},
        forecast,
        hourly: [],
        alerts: [],
        warnings: [],
        currentObservation: { textDescription: "Friday observation" },
        meta: { cacheTtlSeconds: 60, alertsCacheTtlSeconds: 60 },
      },
    }),
  );
  const d = await open(page);
  await ask(page, "Will it rain in Amarillo, Texas this weekend?");
  for (const name of [
    "Saturday — Rain",
    "Saturday Night — Showers",
    "Sunday — Sunny",
    "Sunday Night — Cloudy",
  ])
    await expect(d.getByText(name, { exact: true })).toHaveCount(2);
  await expect(d.getByText(/Friday observation|Friday Night — Clear/)).toHaveCount(0);
  await ask(page, "What about Saturday night?");
  await expect(d.getByText("Saturday Night — Showers")).toHaveCount(2);
  await expect(d.getByText(/Saturday — Rain|Sunday —/)).toHaveCount(0);
  await ask(page, "Tonight?");
  await expect(d.getByText("Friday Night — Clear")).toHaveCount(2);
  await expect(d.getByText(/Saturday Night —/)).toHaveCount(0);
  await ask(page, "And Monday?");
  await expect(d.getByText(/forecast.*unavailable.*Monday|Monday.*forecast.*unavailable/i)).toHaveCount(2);
  await expect(d.getByText(/— (Clear|Rain|Showers|Sunny|Cloudy)/)).toHaveCount(0);
});

test("early Sunday forecasts distinguish tonight from overnight and highlight the requested hour", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-22T07:30:00Z")); // 1:30 a.m. in Chicago.
  const period = (name: string, startTime: string, endTime: string, isDaytime: boolean) => ({
    name,
    startTime,
    endTime,
    isDaytime,
    shortForecast: name + " conditions",
  });
  const forecast = [
    period("Overnight", "2026-11-22T01:00:00-06:00", "2026-11-22T06:00:00-06:00", false),
    period("Sunday", "2026-11-22T06:00:00-06:00", "2026-11-22T18:00:00-06:00", true),
    period("Sunday Night", "2026-11-22T18:00:00-06:00", "2026-11-23T06:00:00-06:00", false),
  ];
  const hourly = [5, 6, 7, 12].map((hour) => {
    const local = (h: number) => "2026-11-22T" + String(h).padStart(2, "0") + ":00:00-06:00";
    return period("Hour " + hour, local(hour), local(hour + 1), hour >= 6);
  });
  await page.route("**/v1/counties/texas/potter/weather", (route) =>
    route.fulfill({
      json: {
        county: { fips: "48375", displayName: "Potter County" },
        location: { timeZone: "America/Chicago" },
        zones: {},
        forecast,
        hourly,
        alerts: [],
        warnings: [],
        meta: { cacheTtlSeconds: 60, alertsCacheTtlSeconds: 60 },
      },
    }),
  );
  const d = await open(page, "/texas/potter");
  await ask(page, "Weather for Sunday night?");
  await expect(d.getByText("Sunday Night — Sunday Night conditions")).toBeVisible();
  await expect(d.getByText(/Overnight conditions/)).toHaveCount(0);
  await d.getByRole("button", { name: "This weekend" }).click();
  await expect(d.getByText("Sunday — Sunday conditions")).toBeVisible();
  await expect(d.getByText(/unavailable for Saturday/)).toHaveCount(0);
  await ask(page, "And this morning?");
  await expect(d.getByText(/6:00 AM CST — Hour 6 conditions/)).toBeVisible();
  await expect(d.getByText(/7:00 AM CST — Hour 7 conditions/)).toBeVisible();
  await expect(d.getByText(/Hour (5|12) conditions/)).toHaveCount(0);
  await d.getByRole("link", { name: "Open full weather report" }).click();
  const row = page.getByRole("row").filter({ hasText: "Hour 6 conditions" });
  await expect(row).toBeFocused();
  await expect(row).toHaveClass(/fetch-arrival-target/);

  await page.goto("/");
  await page.getByRole("button", { name: "Ask Fetch" }).click();
  await ask(page, "Take me to tonight’s forecast in Potter County, Texas");
  await expect(page).toHaveURL(/\/texas\/potter\/weather$/);
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Sunday Night" }) });
  await expect(card).toBeFocused();
  await expect(card).toHaveClass(/fetch-arrival-target/);

  await page.getByRole("button", { name: "Ask Fetch" }).click();
  await ask(page, "Open the forecast for Tuesday");
  await expect(d.getByText(/forecast is unavailable for Tuesday/)).toBeVisible();
});

test("weekday ranges include intervening days and identify the missing day when a report has only local offsets", async ({
  page,
}) => {
  // Saturday in UTC, Friday evening in Honolulu. This report omits the optional zone name.
  await page.clock.setFixedTime(new Date("2026-11-21T04:30:00Z"));
  const forecast = [
    {
      name: "Tonight",
      startTime: "2026-11-20T18:00:00-10:00",
      endTime: "2026-11-21T06:00:00-10:00",
      isDaytime: false,
      shortForecast: "Light wind",
    },
    {
      name: "Saturday",
      startTime: "2026-11-21T06:00:00-10:00",
      endTime: "2026-11-21T18:00:00-10:00",
      isDaytime: true,
      shortForecast: "Showers",
    },
  ];
  await page.route("**/v1/counties/hawaii/honolulu/weather", (route) =>
    route.fulfill({
      json: {
        county: { fips: "15003" },
        location: {},
        zones: {},
        forecast,
        hourly: [],
        alerts: [],
        warnings: [],
        meta: { cacheTtlSeconds: 60, alertsCacheTtlSeconds: 60, partial: true },
      },
    }),
  );
  const d = await open(page, "/hawaii");
  await ask(page, "Weather in Honolulu on Friday?");
  await expect(d.getByText("Tonight — Light wind")).toBeVisible();
  await expect(d.getByText(/Saturday —/)).toHaveCount(0);
  await ask(page, "Friday through Sunday?");
  await expect(d.getByText("Tonight — Light wind")).toBeVisible();
  await expect(d.getByText("Saturday — Showers")).toBeVisible();
  await expect(d.getByText(/forecast is unavailable for Sunday, Nov 22/)).toBeVisible();
  await expect(d.getByText(/weather service returned a partial report/)).toBeVisible();
  await ask(page, "Find articles about the storm");
  await expect(d.getByRole("heading", { name: "Articles from the feeds" })).toBeVisible();
});

test("a reader can identify a story by its excerpt, publication date, or a numbered choice", async ({
  page,
}) => {
  const items = [
    story("crossing", "Repairs begin Monday", "Crews will replace the crossing on First Street."),
    {
      ...story(
        "workshop",
        "Evening workshop returns",
        "The library will host a workshop about train crossings.",
      ),
      publishedAt: "",
    },
    story("games", "Sports scores"),
  ];
  await page.route("**/v1/pages/counties/texas/potter?**", (r) => r.fulfill({ json: bundle(items) }));
  const d = await open(page, "/texas/potter");
  await ask(page, "Show me local headlines");
  await expect(d.getByRole("link", { name: items[2].title })).toBeVisible();
  await d.getByRole("button", { name: "Choose a story" }).press("Enter");
  await expect(d.getByRole("heading", { name: "Which story did you mean?" })).toBeFocused();
  await d.getByRole("button", { name: items[2].title }).press("Enter");
  await expect(d.getByRole("heading", { name: items[2].title })).toBeFocused();
  await d.getByRole("button", { name: "Choose another story" }).click();
  await ask(page, "Show me the one about First Street");
  await expect(d.getByRole("heading", { name: items[0].title })).toBeVisible();
  await ask(page, "When was that published?");
  await expect(d.getByText("Published Jan 11, 2026.")).toBeVisible();
  await ask(page, "Tell me about the one about crossings");
  const choices = d.locator(".fetch-story-choices");
  await expect(choices.getByRole("button")).toHaveCount(2);
  await expect(choices.getByRole("button", { name: items[2].title })).toHaveCount(0);
  await ask(page, "2");
  await expect(d.getByRole("heading", { name: items[1].title })).toBeVisible();
  await ask(page, "When did it come out?");
  await expect(d.getByText("The feed didn’t provide a publication date for this story.")).toBeVisible();
  await ask(page, "Open weather");
  await expect(page).toHaveURL(/\/texas\/potter\/weather$/);
});

test("everyday news terms retrieve the published story and preserve the county when choosing between editions", async ({
  page,
}) => {
  await page.route("**/v1/pages/counties/texas/*?**", (r) => {
    const potter = r.request().url().includes("/potter");
    const items = [
      story(
        potter ? "mill" : "factory",
        potter ? "Mill plans layoffs" : "Factory announces layoffs",
        "Staff received letters after the budget review.",
      ),
      story("student", "Student job fair", "Students can meet employers."),
    ];
    return r.fulfill({ json: bundle(items) });
  });
  const d = await open(page);
  await ask(page, "I remember reading something about job cuts in Amarillo, Texas");
  await expect(d.getByRole("link", { name: "Mill plans layoffs" })).toBeVisible();
  await expect(d.getByRole("link", { name: "Factory announces layoffs" })).toBeVisible();
  await expect(d.getByRole("link", { name: "Student job fair" })).toHaveCount(0);
  await ask(page, "Who published the one about the letters?");
  await expect(d.getByRole("button", { name: "Factory announces layoffs · Randall County" })).toBeVisible();
  await ask(page, "The second one");
  await expect(d.getByRole("heading", { name: "Factory announces layoffs" })).toBeVisible();
  await expect(d.getByText("Reported by Local Journal.")).toBeVisible();
  await expect(d.getByRole("link", { name: "Read the original story" })).toHaveAttribute(
    "href",
    "https://local.example/factory",
  );
});

test("place correction keeps the other selections and the requested year", async ({ page }) => {
  const d = await open(page);
  await ask(page, "Compare rent in Potter County, Texas and Randall County, Texas in 2020");
  await expect(d.getByRole("combobox", { name: "County 1", exact: true })).toHaveValue("48375");
  await ask(page, "No, I meant Potter County in Pennsylvania");
  await expect(d.getByRole("combobox", { name: "County 1", exact: true })).toHaveValue("42105");
  await expect(d.getByRole("combobox", { name: "County 2", exact: true })).toHaveValue("48381");
  await expect(d.getByRole("heading", { name: /Median monthly gross rent.*2020/ })).toBeVisible();
  await d.getByRole("button", { name: /Change place 1/ }).click();
  await expect(d.getByRole("combobox", { name: "State 1", exact: true })).toBeFocused();
});

test("compound county comparisons keep the reference, both conditions and coverage gaps", async ({
  page,
}) => {
  const places: Record<string, [string, number, number]> = {
    potter: ["48375", 1000, 40000],
    randall: ["48381", 800, 50000],
    lubbock: ["48303", 900, 0],
  };
  await page.route("**/v1/counties/texas/*/atlas/housing", (r) => {
    const [fips, value] = places[new URL(r.request().url()).pathname.split("/")[4]];
    return r.fulfill({
      json: {
        county: { fips },
        domain: { slug: "housing" },
        metrics: [
          {
            key: "median-gross-rent",
            label: "Median gross rent",
            value,
            valueKind: "currency",
            unit: "dollars",
            vintage: "2024 ACS",
            date: "2024-12-31",
            source: { id: "acs", name: "Census" },
          },
        ],
        meta: { cacheTtlSeconds: 60 },
      },
    });
  });
  await page.route("**/v1/counties/texas/*/economic-data", (r) => {
    const [fips, , value] = places[new URL(r.request().url()).pathname.split("/")[4]];
    return r.fulfill({
      json: {
        county: { fips },
        metrics: value
          ? [
              {
                key: "median-household-income",
                latest: { date: "2024-01-01", value },
                valueKind: "currency",
                source: "Census",
                units: "Dollars",
                frequency: "Annual",
                seriesUrl: "https://example.org/income",
              },
            ]
          : [],
      },
    });
  });
  const d = await open(page, "/texas/potter");
  await ask(
    page,
    "Where is rent lower and household income higher than in Potter County, Texas among Randall and Lubbock counties in Texas?",
  );
  await expect(d.getByRole("region", { name: "Randall County, TX" })).toContainText("Meets all conditions");
  await expect(d.getByRole("region", { name: "Lubbock County, TX" })).toContainText("Incomplete comparison");
  await expect(d.getByRole("region", { name: "Potter County, TX" })).toContainText("Reference place");
});

test("returning to the exact answer replays the highlight and keeps the story order", async ({ page }) => {
  let changed = false;
  await page.route("**/v1/pages/counties/texas/potter?**", (r) =>
    r.fulfill({
      json: bundle(
        changed
          ? [story("other", "Replacement headlines")]
          : [story("a", "Library opens"), story("b", "Bridge opens")],
      ),
    }),
  );
  const d = await open(page);
  await ask(page, "Local headlines in Potter County, Texas");
  await expect(d.getByRole("link", { name: "Bridge opens" })).toBeVisible();
  changed = true;
  await d.getByRole("link", { name: "Open edition" }).click();
  await expect(page).toHaveURL(/\/texas\/potter$/);
  await page.getByRole("button", { name: "Show me again" }).click();
  await expect(page.locator(".fetch-arrival-target")).toHaveAttribute("id", "desk-general");
  await page.getByRole("button", { name: "Back to my results" }).click();
  await expect(d.locator("ol li a")).toHaveText(["Library opens", "Bridge opens"]);
  await ask(page, "The second story");
  await expect(d.getByRole("heading", { name: "Bridge opens" })).toBeVisible();
});

test("last visit separates publication time from meeting time and permits another starting day", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-23T18:00:00Z"));
  await page.addInitScript(() =>
    localStorage.setItem("fetch.visit.48375", String(Date.parse("2026-11-22T12:00:00Z"))),
  );
  await page.route("**/v1/pages/counties/texas/potter?**", (r) =>
    r.fulfill({
      json: bundle([
        { ...story("new", "New headline"), publishedAt: "2026-11-23" },
        { ...story("old", "Older headline"), publishedAt: "2026-11-20" },
        { ...story("future", "Future headline"), publishedAt: "2026-11-24" },
      ]),
    }),
  );
  await page.route("**/v1/counties/texas/potter/public-notices?**", (r) =>
    r.fulfill({
      json: {
        county: { fips: "48375", state: "texas", county: "potter" },
        sources: [],
        items: ["2026-11-20", "2026-11-23"].map((publishedAt) => ({
          url: "https://example.org/" + publishedAt,
          title: "Meeting announced " + publishedAt,
          sourceName: "County clerk",
          category: "meeting",
          countyFips: ["48375"],
          eventDate: "2026-12-01",
          publishedAt,
        })),
        meta: { offset: 0, hasMore: false, status: "current", rollout: "texas", totalAvailable: 2 },
      },
    }),
  );
  const d = await open(page, "/texas/potter");
  await d.getByRole("button", { name: "Since my last visit" }).click();
  await expect(d.getByRole("link", { name: "New headline" })).toBeVisible();
  await expect(d.getByRole("link", { name: "Older headline" })).toHaveCount(0);
  await expect(d.getByRole("link", { name: "Meeting announced 2026-11-23" })).toBeVisible();
  await expect(d.getByRole("link", { name: "Meeting announced 2026-11-20" })).toHaveCount(0);
  await d.getByLabel("Show changes since").fill("2026-11-19");
  await expect(d.getByRole("link", { name: "Older headline" })).toBeVisible();
  await expect(d.getByRole("link", { name: "Future headline" })).toHaveCount(0);
  await expect(d.getByRole("link", { name: "Meeting announced 2026-11-20" })).toBeVisible();
});

test("replacing a state preserves the measure, order and other states", async ({ page }) => {
  const dialog = await open(page);
  await ask(page, "Compare population in Texas, Oklahoma and Kansas in 2020");
  await ask(page, "Replace Oklahoma with Iowa");
  await expect(dialog.getByRole("combobox", { name: "State 1", exact: true })).toHaveValue("texas");
  await expect(dialog.getByRole("combobox", { name: "State 2", exact: true })).toHaveValue("iowa");
  await expect(dialog.getByRole("combobox", { name: "State 3", exact: true })).toHaveValue("kansas");
  await expect(dialog.getByRole("combobox", { name: "Measure", exact: true })).toHaveValue("population");
  await expect(dialog.getByText(/2020/).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Change place 2 · Iowa" }).click();
  await expect(dialog.getByRole("combobox", { name: "State 2", exact: true })).toBeFocused();
});

test("correcting the county keeps the news subject and offers a county picker", async ({ page }) => {
  await page.route("**/v1/pages/counties/*/*?**", (r) => {
    const title = r.request().url().includes("/pennsylvania/")
      ? "Pennsylvania library expands"
      : "Texas library expands";
    return r.fulfill({ json: bundle([story("library", title), story("other", "Bridge repairs")]) });
  });
  const dialog = await open(page);
  await ask(page, "Find articles about the library in Potter County, Texas");
  await expect(dialog.getByRole("link", { name: "Texas library expands" })).toBeVisible();
  await ask(page, "No, I meant Potter County in Pennsylvania");
  await expect(dialog.getByRole("link", { name: "Pennsylvania library expands" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Bridge repairs" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Change place", exact: true }).click();
  await expect(dialog.getByText("Choose the state and county for this question.")).toBeVisible();
});

test("desk navigation keeps the visit cutoff and returning to the county starts a new visit", async ({
  page,
}) => {
  const first = new Date("2026-11-20T12:00:00Z");
  const next = new Date("2026-11-23T12:00:00Z");
  await page.clock.setFixedTime(first);
  await page.route("**/v1/pages/counties/texas/potter?**", (r) =>
    r.fulfill({
      json: bundle([
        { ...story("later", "Library weekend update"), publishedAt: "2026-11-22" },
        { ...story("old", "Prior update"), publishedAt: "2026-11-19" },
      ]),
    }),
  );
  await page.route("**/v1/counties/texas/potter/public-notices?**", (r) =>
    r.fulfill({
      json: {
        county: { fips: "48375", state: "texas", county: "potter" },
        sources: [],
        items: [],
        meta: { offset: 0, hasMore: false, status: "current", rollout: "texas", totalAvailable: 0 },
      },
    }),
  );
  const dialog = await open(page, "/texas/potter");
  await dialog.getByRole("button", { name: "Since my last visit" }).click();
  await expect(dialog.getByText(/first recorded visit/)).toBeVisible();
  await dialog.getByRole("button", { name: "Close Fetch" }).click();
  await page.clock.setFixedTime(next);
  const stored = () => page.evaluate(() => Number(localStorage.getItem("fetch.visit.48375")));
  await page
    .locator('a[href="/texas/potter/data"]')
    .first()
    .evaluate((a: HTMLAnchorElement) => a.click());
  await expect(page).toHaveURL(/\/texas\/potter\/data$/);
  expect(await stored()).toBe(first.getTime());
  await page.locator('a.wordmark[href="/"]').first().click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "Ask Fetch" }).click();
  await expect(dialog.getByText("National edition", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/texas\/potter\/data$/);
  await expect.poll(stored).toBe(next.getTime());
  await page.getByRole("button", { name: "Ask Fetch" }).click();
  await dialog.getByRole("button", { name: "Since my last visit" }).click();
  await expect(dialog.getByRole("link", { name: "Library weekend update" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Prior update" })).toHaveCount(0);
});
