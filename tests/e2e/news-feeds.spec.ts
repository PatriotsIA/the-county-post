import { expect, test, type Page } from "@playwright/test";
import { getCounty } from "../../src/data/counties";
import { buildCountyFallbackFeedUrls } from "../../src/lib/fallback-feed-urls";
import { isTrustedCountyNativeNewsItem } from "../../src/lib/local-news-sources";
import { balancePublisherItems } from "../../src/lib/rss";

test.beforeEach(async ({ page }) => {
  await page.route("http://localhost:8787/v1/pages/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const limit = Number(requestUrl.searchParams.get("limit") || "24");
    const parts = requestUrl.pathname.split("/").filter(Boolean);
    const scope = parts[2];
    const stateSlug = parts[3] || "";
    const countySlug = parts[4] || "";
    const sections = (requestUrl.searchParams.get("sections") || "")
      .split(",")
      .map((section) => section.trim())
      .filter(Boolean);

    const sectionEntries = sections.map((section) => {
      const topicSlug = topicForSection(section);
      const items = makeRouteItems({ scope, stateSlug, countySlug, topicSlug, limit });
      return [
        section,
        {
          scope: {},
          topic: topicSlug,
          items,
          meta: { count: items.length, sourcesUsed: ["test"], fetchedAt: new Date().toISOString(), cacheTtlSeconds: 300 },
        },
      ];
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        scope: {},
        sections: Object.fromEntries(sectionEntries),
        meta: { count: sectionEntries.length, fetchedAt: new Date().toISOString(), cacheTtlSeconds: 300 },
      }),
    });
  });

  await page.route("http://localhost:8787/v1/feeds/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const limit = Number(requestUrl.searchParams.get("limit") || "24");
    const parts = requestUrl.pathname.split("/").filter(Boolean);
    const scope = parts[2];
    const stateSlug = parts[3] || "";
    const countySlug = parts[4] || "";
    const topicSlug = parts.at(-1) || "general";
    const items = makeRouteItems({ scope, stateSlug, countySlug, topicSlug, limit });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        scope: {},
        topic: topicSlug,
        items,
        meta: { count: items.length, sourcesUsed: ["test"], fetchedAt: new Date().toISOString(), cacheTtlSeconds: 300 },
      }),
    });
  });

  await page.route(/http:\/\/localhost:8787\/v1\/counties\/[^/]+\/[^/]+\/weather(?:\?.*)?$/, async (route) => {
    const parts = new URL(route.request().url()).pathname.split("/").filter(Boolean);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeWeatherResponse(parts[2], parts[3])),
    });
  });

  await page.route("http://localhost:8787/v1/counties/**/economic-data", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        county: {
          name: "Polk",
          displayName: "Polk County",
          slug: "polk",
          fips: "05113",
          stateName: "Arkansas",
          stateSlug: "arkansas",
          stateAbbr: "AR",
        },
        metrics: [
          {
            key: "unemployment-rate",
            label: "Unemployment rate",
            description: "Annual share of the county labor force that was unemployed.",
            seriesId: "LAUCN051130000000003A",
            seriesUrl: "https://fred.stlouisfed.org/series/LAUCN051130000000003A",
            units: "Percent",
            frequency: "Annual",
            valueKind: "percent",
            source: "U.S. Bureau of Labor Statistics",
            latest: { date: "2025-01-01", value: 4.5 },
            previous: { date: "2024-01-01", value: 4.2 },
            change: { absolute: 0.3, percent: 7.14 },
            observations: [
              { date: "2024-01-01", value: 4.2 },
              { date: "2025-01-01", value: 4.5 },
            ],
          },
          {
            key: "median-household-income",
            label: "Median household income",
            description: "Estimated annual household income.",
            seriesId: "MHIAR05113A052NCEN",
            seriesUrl: "https://fred.stlouisfed.org/series/MHIAR05113A052NCEN",
            units: "Dollars",
            frequency: "Annual",
            valueKind: "currency",
            source: "U.S. Census Bureau",
            latest: { date: "2024-01-01", value: 47544 },
            previous: { date: "2023-01-01", value: 45100 },
            change: { absolute: 2444, percent: 5.42 },
            observations: [
              { date: "2023-01-01", value: 45100 },
              { date: "2024-01-01", value: 47544 },
            ],
          },
        ],
        meta: {
          source: "FRED",
          sourceName: "Federal Reserve Bank of St. Louis",
          sourceUrl: "https://fred.stlouisfed.org/",
          fetchedAt: "2026-08-17T12:00:00.000Z",
          latestObservationDate: "2025-01-01",
          cacheTtlSeconds: 21600,
        },
      }),
    });
  });

  await page.route(
    /http:\/\/localhost:8787\/v1\/counties\/[^/]+\/[^/]+\/atlas(?:\/[^/?]+)?(?:\?.*)?$/,
    async (route) => {
      const parts = new URL(route.request().url()).pathname.split("/").filter(Boolean);
      const stateSlug = parts[2];
      const countySlug = parts[3];
      const domain = parts[5];

      if (countySlug === "randall") {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Atlas snapshot is being refreshed." }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          domain
            ? makeAtlasDomainDocument(stateSlug, countySlug, domain)
            : makeAtlasOverview(stateSlug, countySlug),
        ),
      });
    },
  );
});

function topicForSection(section: string) {
  if (section === "localNews") return "general";
  if (section === "localSports") return "sports";
  return section;
}

function makeRouteItems({
  scope,
  stateSlug,
  countySlug,
  topicSlug,
  limit,
}: {
  scope: string;
  stateSlug: string;
  countySlug: string;
  topicSlug: string;
  limit: number;
}) {
  const isObituary = topicSlug === "obituaries";
  const isSports = topicSlug === "sports";
  const isCrime = topicSlug === "crime";
  const isWeather = topicSlug === "weather";
  const isBriscoe = countySlug === "briscoe";
  const isArkansas = stateSlug === "arkansas";

  const topic = isObituary ? "Obituary" : isSports ? "Sports" : isCrime ? "Crime" : isWeather ? "Weather" : "Local News";
  return isBriscoe
    ? [
        ...makeItems({ source: "Briscoe County Test", topic, count: Math.min(4, limit), stateLabel: "Texas" }),
        ...makeItems({ source: "Lubbock Daily Test", topic, count: Math.max(0, limit - 4), offset: 4, stateLabel: "Texas" }),
      ]
    : makeItems({
        source:
          isArkansas && scope === "counties"
            ? "Polk County Test"
            : isArkansas
              ? "Arkansas State Test"
              : scope === "national"
                ? "National Test"
                : "Randall County Test",
        topic,
        count: limit,
        stateLabel: isArkansas ? "Arkansas" : "Texas",
      });
}

test("pins the County Post op-ed first on national, state, and county opinion desks", async ({ page }) => {
  const opinionDesks = [
    { path: "/op-eds", heading: "National opinion" },
    { path: "/arkansas/op-eds", heading: "Arkansas State Op-Eds" },
    { path: "/arkansas/polk/op-eds", heading: "Local opinion" },
  ];

  for (const desk of opinionDesks) {
    await page.goto(desk.path);
    const section = page.locator("section", { has: page.getByRole("heading", { name: desk.heading, exact: true }) });
    const firstCard = section.locator(".feed-card").first();
    await expect(firstCard.locator(".feed-title")).toHaveText("The Data Centers and the Rest of Us");
    await expect(firstCard.locator(".feed-title")).toHaveAttribute("href", "/op-eds/the-data-centers-and-the-rest-of-us");
    await expect(firstCard.locator(".feed-meta")).toContainText("The County Post");
    await expect(section.locator(".feed-meta", { hasText: "The County Post" })).toHaveCount(1);
  }

  await page.goto("/op-eds/the-data-centers-and-the-rest-of-us");
  await expect(page.getByRole("heading", { level: 1, name: "The Data Centers and the Rest of Us" })).toBeVisible();
  await expect(page.getByText("By Dan Rogers, The County Post", { exact: true })).toBeVisible();
  await expect(page.getByText("What a Thursday night with a spreadsheet taught me", { exact: false })).toBeVisible();
  await expect(page.getByText("Dan Rogers is the publisher of The County Post and a Texas Panhandle cattleman.")).toBeVisible();
  await expect(page.getByText(/letter from the editor/i)).toHaveCount(0);
});

test("county RSS fallback targets reviewed Polk outlets and local sources nationwide", () => {
  const polk = getCounty("arkansas", "polk");
  const harris = getCounty("texas", "harris");
  expect(polk).toBeDefined();
  expect(harris).toBeDefined();

  const polkUrls = buildCountyFallbackFeedUrls(polk!, "general");
  const polkSportsUrls = buildCountyFallbackFeedUrls(polk!, "sports");
  const decodedPolkUrls = polkUrls.map((url) => decodeURIComponent(url).replace(/\+/g, " "));
  const decodedHarrisUrls = buildCountyFallbackFeedUrls(harris!, "general").map((url) =>
    decodeURIComponent(url).replace(/\+/g, " "),
  );

  expect(polkUrls).toContain("https://mypulsenews.com/feed/");
  expect(polkUrls).toContain("https://mypulsenews.com/feed/?paged=4");
  expect(polkUrls).toContain("https://mypulsenews.com/category/news/feed/");
  expect(polkSportsUrls).toContain("https://mypulsenews.com/category/sports/feed/");
  expect(polkSportsUrls).not.toContain("https://mypulsenews.com/feed/?paged=2");
  expect(decodedPolkUrls.some((url) => url.includes("site:menastar.com"))).toBe(true);
  expect(decodedPolkUrls.some((url) => url.includes("site:mypulsenews.com"))).toBe(true);
  expect(decodedHarrisUrls.some((url) => url.includes('"local newspaper"'))).toBe(true);
  expect(decodedHarrisUrls.some((url) => url.includes("menastar.com"))).toBe(false);

  expect(
    isTrustedCountyNativeNewsItem(
      {
        id: "mena-star",
        title: "School board approves its new calendar",
        link: "https://news.google.com/rss/articles/mena-star",
        source: "The Mena Star",
      },
      "Arkansas",
      "Polk County",
    ),
  ).toBe(true);
});

test("county RSS fallback reserves half of a 50-story feed for other publishers", () => {
  const dominant = Array.from({ length: 40 }, (_, index) => ({
    id: `pulse-${index}`,
    title: `My Pulse story ${index}`,
    link: `https://mypulsenews.com/story-${index}`,
    source: "My Pulse News / KENA",
    publishedAt: new Date(Date.now() - index * 60_000).toISOString(),
  }));
  const alternatives = Array.from({ length: 30 }, (_, index) => ({
    id: `alternative-${index}`,
    title: `Alternative story ${index}`,
    link: `https://publisher-${index % 3}.example/story-${index}`,
    source: `Alternative Publisher ${index % 3}`,
    publishedAt: new Date(Date.now() - (index + 40) * 60_000).toISOString(),
  }));

  const balanced = balancePublisherItems([...dominant, ...alternatives], 50);

  expect(balanced).toHaveLength(50);
  expect(balanced.filter((item) => item.link.includes("mypulsenews.com"))).toHaveLength(25);
  expect(balanced.filter((item) => !item.link.includes("mypulsenews.com"))).toHaveLength(25);
});

test("county feeds retain separately dated recurring local reports", async ({ page }) => {
  const items = ["2026-08-24T15:15:01Z", "2026-08-14T18:16:08Z", "2026-08-06T15:27:08Z"].map(
    (publishedAt, index) => ({
      id: `mena-police-${index}`,
      title: "Mena Police Reports",
      link: `https://mypulsenews.com/mena-police-reports-${index}`,
      source: "My Pulse News / KENA",
      publishedAt,
      description: "Mena Arkansas weekly police activity.",
      categories: ["Police Reports", "Polk County Arkansas"],
    }),
  );
  await page.route("http://localhost:8787/v1/pages/counties/arkansas/polk**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        scope: {},
        sections: {
          localNews: {
            scope: {},
            topic: "general",
            items,
            meta: { count: items.length, sourcesUsed: ["direct:My Pulse News / KENA"] },
          },
        },
        meta: { count: items.length },
      }),
    });
  });

  await page.goto("/arkansas/polk");

  await expect(page.locator("a.feed-title", { hasText: "Mena Police Reports" })).toHaveCount(3);
});

test("county ticker links current conditions and only shows active alerts", async ({ page }) => {
  await page.goto("/arkansas/polk");

  const weatherTicker = page.locator(".market-weather-weather-bar");
  const weatherLink = weatherTicker.getByRole("link", { name: /Mena.*72°F.*Clear.*Wind 8 mph/i });
  await expect(weatherLink).toBeVisible();
  await expect(weatherLink).toHaveAttribute("href", "/arkansas/polk/weather");

  const alertStrip = page.getByRole("alert").filter({ hasText: "Severe Thunderstorm Warning" });
  await expect(alertStrip).toBeVisible();
  await expect(alertStrip).toContainText("Severe weather alert");
  await expect(alertStrip).toContainText("Expires");
  await expect(alertStrip.getByRole("link")).toHaveAttribute("href", "/arkansas/polk/weather");
  await expect(page.getByRole("alert").filter({ hasText: "Flood Watch" })).toBeVisible();

  await page.goto("/texas/briscoe");
  await expect(page.locator(".market-weather-weather-bar")).toContainText("Silverton");
  await expect(page.locator(".county-weather-alert")).toHaveCount(0);
});

test("Potter County shows drought conditions without mislabeling them as an NWS alert", async ({ page }) => {
  await page.goto("/texas/potter");

  await expect(page.locator(".county-weather-alert[role='alert']")).toHaveCount(0);
  const droughtNotice = page.locator(".county-drought-condition");
  await expect(droughtNotice).toBeVisible();
  await expect(droughtNotice).toContainText("USDM D3");
  await expect(droughtNotice).toContainText("Extreme Drought affects 68.5% of Potter County");
  await expect(droughtNotice.getByRole("link")).toHaveAttribute("href", "/texas/potter/weather");

  await droughtNotice.getByRole("link").click();
  await expect(page).toHaveURL(/\/texas\/potter\/weather$/);
  const droughtSection = page.locator(".weather-drought-section");
  await expect(droughtSection.getByRole("heading", { name: "Drought conditions" })).toBeVisible();
  await expect(droughtSection).toContainText("100% of the county is in moderate drought or worse");
  await expect(droughtSection.getByRole("link", { name: "View official county drought conditions" })).toHaveAttribute(
    "href",
    "https://www.drought.gov/states/Texas/county/Potter",
  );
});

test("county weather page shows alerts, forecasts, hourly data, sources, and stories", async ({ page }) => {
  const weatherRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/v1\/counties\/arkansas\/polk\/weather$/.test(request.url())) weatherRequests.push(request.url());
  });

  await page.goto("/arkansas/polk/weather");

  await expect(page.getByRole("heading", { level: 1, name: "Polk County Weather" })).toBeVisible();
  const currentConditions = page.locator(".weather-current-section");
  await expect(currentConditions.getByText("72°F", { exact: true })).toBeVisible();
  await expect(currentConditions.getByText("Clear", { exact: true })).toBeVisible();

  const rainfall = page.locator(".weather-rainfall-section");
  await expect(rainfall.getByRole("heading", { name: "Fourteen-day precipitation" })).toBeVisible();
  await expect(rainfall).toContainText("NASA's Precipitation data is on a 3 day delay.");
  await expect.poll(() =>
    page.evaluate(() => {
      const rainfallSection = document.querySelector(".weather-rainfall-section");
      const current = document.querySelector(".weather-current-section");
      if (!rainfallSection || !current) return false;
      return Boolean(rainfallSection.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING);
    }),
  ).toBe(true);
  await expect(rainfall).toContainText("2.67 in");
  await expect(rainfall).toContainText("7 above 0.01 in");
  await expect(rainfall).toContainText("Aug 25, 2026");
  await expect(rainfall.locator(".weather-rainfall-chart li")).toHaveCount(14);
  await expect(rainfall.getByRole("link", { name: "Open NASA POWER precipitation data" })).toHaveAttribute(
    "href",
    /power\.larc\.nasa\.gov/,
  );

  const alerts = page.locator(".weather-alerts-section");
  await expect(alerts.getByRole("heading", { name: "Severe Thunderstorm Warning for Polk County" })).toBeVisible();
  const officialAlert = alerts
    .locator(".weather-alert-card", { has: page.getByRole("heading", { name: "Severe Thunderstorm Warning for Polk County" }) })
    .getByRole("link", { name: "Open official NWS alert" });
  await expect(officialAlert).toHaveAttribute("href", "https://api.weather.gov/alerts/test-alert");
  await expect(officialAlert).toHaveAttribute("target", "_blank");

  const forecast = page.locator(".weather-forecast-section");
  await expect(forecast.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(forecast.getByRole("heading", { name: "Tonight" })).toBeVisible();
  await expect(forecast.getByText("Sunny", { exact: true }).first()).toBeVisible();

  const hourlyTable = page.getByRole("table", { name: /Next-hours forecast/ });
  await expect(hourlyTable).toBeVisible();
  await expect(hourlyTable.getByRole("row")).toHaveCount(25);
  await expect(hourlyTable).toContainText("20%");

  const stories = page.locator("section", { has: page.getByRole("heading", { name: "Polk County weather stories" }) });
  await expect(stories.locator(".feed-card").first()).toContainText("Arkansas Weather story 01");
  await expect(page.getByRole("link", { name: "Environment & disasters atlas" }).first()).toHaveAttribute(
    "href",
    "/arkansas/polk/data/environment-disasters",
  );
  await expect(page.getByRole("link", { name: "NWS API documentation" })).toHaveAttribute("target", "_blank");
  await expect(page.locator(".weather-source-details")).toContainText("America/Chicago");
  await expect.poll(() => weatherRequests.length).toBe(1);
});

test("county weather direct reload preserves the report", async ({ page }) => {
  await page.goto("/arkansas/polk/weather");
  await expect(page.getByRole("heading", { level: 1, name: "Polk County Weather" })).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(/\/arkansas\/polk\/weather$/);
  await expect(page.getByRole("heading", { name: "Forecast periods" })).toBeVisible();
  await expect(page.getByRole("table", { name: /Next-hours forecast/ })).toBeVisible();
});

test("county weather remains keyboard usable at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/arkansas/polk/weather");

  const weatherNavigation = page.getByRole("navigation", { name: "Polk County pages" }).getByRole("link", { name: "Weather" });
  await weatherNavigation.focus();
  await expect(weatherNavigation).toBeFocused();

  const marketToggle = page.getByRole("button", { name: /Market desk/i });
  await marketToggle.focus();
  await expect(marketToggle).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(marketToggle).toHaveAttribute("aria-expanded", "true");

  const alertLink = page.locator(".county-weather-alert").getByRole("link").first();
  await alertLink.focus();
  await expect(alertLink).toBeFocused();
  await expect(alertLink).toContainText("Severe Thunderstorm Warning");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/arkansas\/polk\/weather$/);

  const rainfallStrip = page.getByLabel("Scrollable daily precipitation chart for Polk County");
  await rainfallStrip.focus();
  await expect(rainfallStrip).toBeFocused();
  await page.keyboard.press("ArrowRight");

  const hourlyStrip = page.getByLabel("Scrollable hourly forecast");
  await hourlyStrip.focus();
  await expect(hourlyStrip).toBeFocused();
  await page.keyboard.press("ArrowRight");
});

test("the existing FRED economic data profile remains functional", async ({ page }) => {
  await page.goto("/arkansas/polk/economic-data");

  await expect(page.getByRole("heading", { name: /Polk County Economic Data/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unemployment rate" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Median household income" })).toBeVisible();
  const historyLink = page.getByRole("link", { name: /Unemployment rate: See Historical Data/ });
  await expect(historyLink).toHaveAttribute("target", "_blank");
  await expect(historyLink).toHaveAttribute("href", "https://fred.stlouisfed.org/series/LAUCN051130000000003A");
  await expect(page.getByText(/FRED series LAUCN/)).toHaveCount(0);
});

test("county atlas snapshot links through the hub to domain details", async ({ page }) => {
  await page.goto("/arkansas/polk");

  await expect(page.getByRole("heading", { name: "Polk County at a glance" })).toBeVisible();
  await expect(page.getByText("$47,544").first()).toBeVisible();
  await page.getByRole("link", { name: "Explore all county data" }).click();

  await expect(page).toHaveURL(/\/arkansas\/polk\/data$/);
  await expect(page.getByRole("heading", { name: "Polk County Data Atlas" })).toBeVisible();
  await expect(page.getByText("Partial coverage", { exact: true })).toHaveCount(0);
  const domainNavigation = page.getByRole("navigation", { name: "Polk County data domains" });
  await expect(domainNavigation).toBeVisible();
  await expect(domainNavigation).toHaveCount(1);
  await expect.poll(() =>
    page.evaluate(() => {
      const contextNav = document.querySelector(".context-nav");
      const domainNav = document.querySelector(".atlas-domain-nav");
      if (!contextNav || !domainNav) return false;
      return Boolean(contextNav.compareDocumentPosition(domainNav) & Node.DOCUMENT_POSITION_FOLLOWING);
    }),
  ).toBe(true);
  const meterBox = await page.locator(".show-up-meter").boundingBox();
  expect(meterBox?.width).toBeLessThanOrEqual(782);
  expect(await page.evaluate(() => {
    const page = document.querySelector(".atlas-page");
    const meter = document.querySelector(".county-show-up-section");
    return Boolean(page && meter && page.lastElementChild === meter);
  })).toBe(true);
  const economyCard = page.locator(".atlas-domain-card", {
    has: page.getByRole("heading", { name: "Economy & Income" }),
  });
  await economyCard.getByRole("link", { name: "Open Economy data" }).click();

  await expect(page).toHaveURL(/\/arkansas\/polk\/data\/economy$/);
  await expect(page.getByRole("heading", { level: 1, name: /Polk County Economy & Income/ })).toBeVisible();
  await expect(page.getByText("Latest available: 2025").first()).toBeVisible();
  await expect(page.getByRole("table", { name: "Unemployment rate trend data" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Median household income county, state, and national comparison" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Employment by industry category data" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Labor force status category data" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Local Area Unemployment Statistics/ }).first()).toHaveAttribute(
    "href",
    "https://www.bls.gov/lau/",
  );
});

test("atlas renders sparse county and partial coverage states without invented zeroes", async ({ page }) => {
  await page.goto("/texas/briscoe/data");

  await expect(page.getByRole("heading", { name: "Partial county atlas" })).toBeVisible();
  await expect(page.getByText("1 of 12 domains available")).toBeVisible();
  await expect(page.getByText("No county measures are available in this domain yet.").first()).toBeVisible();
  await expect(page.getByText("$0")).toHaveCount(0);

  await page.goto("/texas/briscoe/data/housing");
  await expect(page.getByRole("heading", { name: "Partial domain coverage" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No measures are available yet" })).toBeVisible();
});

test("atlas shows a graceful fallback when its API is unavailable", async ({ page }) => {
  await page.goto("/texas/randall/data");

  await expect(page.getByRole("heading", { name: "The county atlas is temporarily unavailable" })).toBeVisible();
  await expect(page.getByText("Atlas snapshot is being refreshed.")).toBeVisible();
  await expect(page.getByText("No substitute values are shown")).toBeVisible();
});

test("atlas domain routes survive a direct reload", async ({ page }) => {
  await page.goto("/arkansas/polk/data/economy");
  await expect(page.getByRole("heading", { level: 1, name: /Polk County Economy & Income/ })).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(/\/arkansas\/polk\/data\/economy$/);
  await expect(page.getByRole("heading", { name: "Median household income" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download CSV" })).toBeVisible();
  await expect(page.getByText("Modeled estimate").first()).toBeVisible();
});

test("atlas domain navigation remains keyboard usable at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/arkansas/polk/data");

  const domainNav = page.getByRole("navigation", { name: "Polk County data domains" });
  const economyLink = domainNav.getByRole("link", { name: "Economy & Income" });
  await expect(domainNav).toBeVisible();
  await economyLink.focus();
  await expect(economyLink).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/arkansas\/polk\/data\/economy$/);
});

test("county and atlas pages reflow without horizontal page overflow on phones", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto("/texas/potter");

  const marketToggle = page.getByRole("button", { name: /Market desk/i });
  await expect(marketToggle).toHaveAttribute("aria-expanded", "false");
  await marketToggle.click();
  await expect(marketToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".market-panel-content")).toBeVisible();
  await expect(page.locator(".show-up-meter")).toBeVisible();
  await expect(page.locator(".show-up-meter-cta a")).toHaveAttribute("href", "https://patriotsinaction.com");
  await expect(page.locator(".ad-slot-meter")).toHaveCount(1);
  await expectElementWithinViewport(page, ".show-up-meter");
  await expectNoPageOverflow(page);

  await page.goto("/texas/potter/data");
  await expect(page.getByRole("heading", { name: "Potter County Data Atlas" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Potter County data domains" })).toBeVisible();
  await expect(page.locator(".show-up-meter")).toBeVisible();
  await expectElementWithinViewport(page, ".show-up-meter");
  await expectNoPageOverflow(page);
});

test("market navigation and county layouts remain usable at 320px and desktop widths", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/arkansas/polk");

  const mobileMarketToggle = page.getByRole("button", { name: /Market desk/i });
  await mobileMarketToggle.focus();
  await expect(mobileMarketToggle).toBeFocused();
  await expectNoPageOverflow(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await expect(page.getByRole("button", { name: /Market desk/i })).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".market-panel-content")).toBeVisible();
  await expect(page.locator(".county-edition-hero")).toBeVisible();
  await expect(page.getByLabel("Polk County pages")).toBeVisible();
  await expect.poll(() =>
    page.evaluate(() => {
      const masthead = document.querySelector(".masthead");
      const hero = document.querySelector(".county-edition-hero");
      const nav = document.querySelector(".context-nav");
      if (!masthead || !hero || !nav) return false;
      const heroInMasthead = masthead.contains(hero);
      const dateBeforeHero = Boolean(
        document.querySelector(".masthead-kicker")?.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
      const heroBeforePrimaryNav = Boolean(
        hero.compareDocumentPosition(document.querySelector(".masthead .nav") || document.createElement("div")) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      );
      const heroBeforeContextNav = Boolean(hero.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING);
      return heroInMasthead && dateBeforeHero && heroBeforePrimaryNav && heroBeforeContextNav;
    }),
  ).toBe(true);
  await expect(page.getByRole("img", { name: /Polk County highlighted on the Arkansas county map/i })).toBeVisible();
  await expectNoPageOverflow(page);

  const localHeadlines = page.getByRole("button", { name: /Hide stories/i }).first();
  await localHeadlines.click();
  await expect(page.getByRole("button", { name: /Show stories/i }).first()).toBeVisible();

  await page.goto("/arkansas/polk/weather");
  await expect(page.getByRole("button", { name: /Market desk/i })).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".county-edition-hero")).toHaveCount(0);
});

test("county feeds stay county-only, sort newest first, and keep batched sections stable", async ({ page }) => {
  await page.goto("/texas/randall");

  await expect(page.getByRole("heading", { level: 1, name: /Randall County/i })).toBeVisible();
  await expect(page.getByText("County stories only")).toBeVisible();
  await expect(page.getByText("Every source. One place.")).toBeVisible();

  const localSection = page.locator("section", { has: page.getByRole("heading", { name: "Local headlines" }) });
  const localCards = localSection.locator(".feed-card");
  await expect.poll(async () => localCards.count()).toBeGreaterThanOrEqual(16);
  const initialLocalCount = await localCards.count();
  await expect(localCards.first()).toContainText("story 01");
  await expect(localSection).not.toContainText("Obituary notice should be filtered");
  await expect(localCards.first().locator("a")).toHaveAttribute("target", "_blank");
  await expect(localCards.first().locator(".feed-meta")).toContainText("Jun 26, 2026");
  await expect(localCards).toHaveCount(initialLocalCount);

  const obituarySection = page.locator("section", { has: page.getByRole("heading", { name: "Obituaries & public notices" }) });
  await expect(obituarySection.locator(".feed-card").first()).toContainText("Obituary story 01");

  const opinionSection = page.locator("section", { has: page.getByRole("heading", { name: "Opinion & op-eds" }) });
  await expect(opinionSection).not.toContainText("Tennessee op-ed should be filtered");
});

test("state pages populate state headlines from broad in-state feeds", async ({ page }) => {
  await page.goto("/arkansas");

  await expect(page.locator(".masthead .masthead-hero")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /Arkansas/i })).toBeVisible();
  await expect.poll(() =>
    page.evaluate(() => {
      const kicker = document.querySelector(".masthead-kicker");
      const hero = document.querySelector(".masthead .masthead-hero");
      const nav = document.querySelector(".masthead .nav");
      if (!kicker || !hero || !nav) return false;
      return Boolean(
        (kicker.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING) &&
          (hero.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING),
      );
    }),
  ).toBe(true);
  const stateSection = page.locator("section", { has: page.getByRole("heading", { name: "State headlines" }) });
  await expect.poll(async () => stateSection.locator(".feed-card").count()).toBeGreaterThanOrEqual(12);
  await expect(stateSection.locator(".feed-card").first()).toContainText("Arkansas");
  await expect(stateSection.locator(".feed-card").first().locator(".feed-meta")).toContainText("Jun 26, 2026");
});

test("rural counties remain sparse instead of showing nearby-market stories", async ({ page }) => {
  await page.goto("/texas/briscoe");

  await expect(page.getByRole("heading", { level: 1, name: /Briscoe County/i })).toBeVisible();
  await expect(page.getByText("County stories only")).toBeVisible();
  await expect(page.getByText(/Houston Daily Test/)).toHaveCount(0);

  const localSection = page.locator("section", { has: page.getByRole("heading", { name: "Local headlines" }) });
  const articleCards = localSection.locator(".feed-card:not(.feed-ad-card)");
  await expect(articleCards).toHaveCount(4);
  await expect(articleCards.first()).toContainText("Briscoe County Test");
  await expect(localSection).not.toContainText("Lubbock Daily Test");
});

test("county RSS fallback does not add nearby media markets", () => {
  const briscoe = getCounty("texas", "briscoe");
  expect(briscoe).toBeTruthy();
  const queries = buildCountyFallbackFeedUrls(briscoe!, "general").map((url) => decodeURIComponent(url).replace(/\+/g, " "));
  expect(queries.every((url) => url.includes('"Briscoe County"'))).toBe(true);
  expect(queries.some((url) => url.includes("Amarillo") || url.includes("Lubbock") || url.includes("Midland"))).toBe(false);
});

test("county Local Sources lists reviewed outlets and keeps unknown directories honest", async ({ page }) => {
  await page.goto("/arkansas/polk/local-sources");

  await expect(page.getByRole("heading", { level: 1, name: "Polk County Local Sources", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Local Sources" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The Mena Star" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My Pulse News / KENA" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Visit news outlet" })).toHaveCount(2);

  await page.goto("/texas/harris/local-sources");
  await expect(page.getByRole("heading", { level: 1, name: "Harris County Local Sources", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No reviewed local sources are listed yet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Submit a local source" })).toHaveAttribute("href", "/texas/harris/submit");
});

async function expectNoPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}

async function expectElementWithinViewport(page: Page, selector: string) {
  await expect.poll(() => page.evaluate((target) => {
    const element = document.querySelector(target);
    if (!element) return false;
    const { left, right } = element.getBoundingClientRect();
    return left >= -1 && right <= window.innerWidth + 1;
  }, selector)).toBe(true);
}

const atlasDomainLabels: Record<string, [string, string]> = {
  demographics: ["Demographics", "People"],
  economy: ["Economy & Income", "Economy"],
  housing: ["Housing", "Housing"],
  "jobs-business": ["Jobs & Business", "Jobs"],
  education: ["Education", "Schools"],
  health: ["Health", "Health"],
  "civic-elections": ["Civic Life & Elections", "Civic"],
  "public-safety": ["Public Safety", "Safety"],
  agriculture: ["Agriculture", "Farms"],
  "environment-disasters": ["Environment & Disasters", "Environment"],
  "government-finance": ["Government & Public Finance", "Government"],
  infrastructure: ["Infrastructure & Connectivity", "Infrastructure"],
};

const atlasSource = {
  id: "census-acs",
  name: "American Community Survey 5-Year Estimates",
  agency: "U.S. Census Bureau",
  url: "https://www.census.gov/programs-surveys/acs",
  cadence: "Annual",
  methodology: "Survey estimates include margins of error and should not be treated as exact counts.",
};

const blsSource = {
  id: "bls-laus",
  name: "Local Area Unemployment Statistics",
  agency: "U.S. Bureau of Labor Statistics",
  url: "https://www.bls.gov/lau/",
  cadence: "Monthly and annual",
  methodology: "Model-based labor-force estimates that may be revised.",
};

function makeAtlasOverview(stateSlug: string, countySlug: string) {
  const sparse = countySlug === "briscoe";
  const county = makeAtlasCounty(stateSlug, countySlug);
  return {
    county,
    domains: Object.keys(atlasDomainLabels).map((domain) => {
      const available = !sparse || domain === "demographics";
      return {
        domain: makeAtlasDomainInfo(domain),
        featuredMetrics: available ? [makeFeaturedMetric(domain)] : [],
        available,
        warnings: available ? [] : ["This domain is not included in the current county snapshot."],
      };
    }),
    meta: {
      version: "2026-08-17-wave-1",
      generatedAt: "2026-08-17T12:00:00.000Z",
      retrievedAt: "2026-08-17T12:05:00.000Z",
      sources: [atlasSource, blsSource],
      partial: sparse,
      cacheTtlSeconds: 21600,
    },
  };
}

function makeAtlasDomainDocument(stateSlug: string, countySlug: string, domain: string) {
  const sparse = countySlug === "briscoe";
  return {
    county: makeAtlasCounty(stateSlug, countySlug),
    domain: makeAtlasDomainInfo(domain),
    metrics: sparse ? [] : domain === "economy" ? makeEconomyMetrics() : [makeFeaturedMetric(domain)],
    warnings: sparse ? ["County-level housing measures are not available in this source wave."] : [],
    meta: {
      version: "2026-08-17-wave-1",
      generatedAt: "2026-08-17T12:00:00.000Z",
      retrievedAt: "2026-08-17T12:05:00.000Z",
      sources: [atlasSource, blsSource],
      partial: sparse,
      cacheTtlSeconds: 21600,
    },
  };
}

function makeAtlasCounty(stateSlug: string, countySlug: string) {
  const isArkansas = stateSlug === "arkansas";
  const name = countySlug === "briscoe" ? "Briscoe" : countySlug === "randall" ? "Randall" : "Polk";
  return {
    name,
    displayName: `${name} County`,
    slug: countySlug,
    fips: isArkansas ? "05113" : countySlug === "briscoe" ? "48045" : "48381",
    stateName: isArkansas ? "Arkansas" : "Texas",
    stateSlug,
    stateAbbr: isArkansas ? "AR" : "TX",
  };
}

function makeAtlasDomainInfo(domain: string) {
  const [label, shortLabel] = atlasDomainLabels[domain] || [domain, domain];
  return {
    slug: domain,
    label,
    shortLabel,
    description: `Official county measures for ${label.toLowerCase()}.`,
    sourceIds: ["census-acs"],
    metricKeys: [],
  };
}

function makeFeaturedMetric(domain: string) {
  if (domain === "demographics") {
    return {
      key: "population",
      domain,
      label: "Population",
      description: "Estimated resident population.",
      unit: "People",
      valueKind: "number",
      chart: "comparison",
      value: 19490,
      date: "2024",
      vintage: "2024 ACS 5-year",
      geographyVintage: "2024",
      marginOfError: 230,
      source: atlasSource,
      benchmarks: [
        { geography: "state", label: "Arkansas", value: 3088354 },
        { geography: "nation", label: "United States", value: 340110988 },
      ],
    };
  }
  if (domain === "economy") {
    return {
      key: "median-household-income",
      domain,
      label: "Median household income",
      description: "Estimated annual household income.",
      unit: "Dollars",
      valueKind: "currency",
      chart: "comparison",
      value: 47544,
      date: "2024",
      vintage: "2024 ACS 5-year",
      modeledEstimate: true,
      coveragePercent: 96.4,
      source: atlasSource,
      benchmarks: [
        { geography: "state", label: "Arkansas", value: 58773 },
        { geography: "nation", label: "United States", value: 80610 },
      ],
    };
  }
  if (domain === "housing") {
    return {
      key: "median-home-value",
      domain,
      label: "Median home value",
      description: "Estimated median value of owner-occupied homes.",
      unit: "Dollars",
      valueKind: "currency",
      chart: "none",
      value: 138400,
      date: "2024",
      vintage: "2024 ACS 5-year",
      source: atlasSource,
    };
  }
  return {
    key: `${domain}-featured`,
    domain,
    label: atlasDomainLabels[domain]?.[1] || domain,
    description: `Latest available ${domain} measure.`,
    unit: "Count",
    valueKind: "number",
    chart: "none",
    value: 12,
    date: "2024",
    vintage: "2024",
    source: atlasSource,
  };
}

function makeEconomyMetrics() {
  return [
    {
      key: "unemployment-rate",
      domain: "economy",
      label: "Unemployment rate",
      description: "Annual share of the county labor force that was unemployed.",
      unit: "Percent",
      valueKind: "percent",
      chart: "trend",
      value: 4.5,
      date: "2025",
      vintage: "2025 annual",
      modeledEstimate: true,
      preliminary: true,
      coveragePercent: 98.2,
      source: blsSource,
      observations: [
        { date: "2022", value: 4.9 },
        { date: "2023", value: 4.4 },
        { date: "2024", value: 4.2 },
        { date: "2025", value: 4.5 },
      ],
    },
    makeFeaturedMetric("economy"),
    {
      key: "employment-by-industry",
      domain: "economy",
      label: "Employment by industry",
      description: "Distribution of covered employment across selected industry groups.",
      unit: "Percent",
      valueKind: "percent",
      chart: "distribution",
      value: 100,
      date: "2024",
      vintage: "2024 annual",
      source: blsSource,
      distribution: [
        { key: "services", label: "Services", value: 43.2, unit: "Percent" },
        { key: "goods", label: "Goods", value: 31.8, unit: "Percent" },
        { key: "government", label: "Government", value: 25, unit: "Percent" },
      ],
    },
    {
      key: "labor-force-status",
      domain: "economy",
      label: "Labor force status",
      description: "Composition of the working-age population by labor force status.",
      unit: "Percent",
      valueKind: "percent",
      chart: "composition",
      value: 100,
      date: "2024",
      vintage: "2024 ACS 5-year",
      source: atlasSource,
      distribution: [
        { key: "employed", label: "Employed", value: 56.1, unit: "Percent" },
        { key: "unemployed", label: "Unemployed", value: 2.8, unit: "Percent" },
        { key: "not-in-labor-force", label: "Not in labor force", value: 41.1, unit: "Percent" },
      ],
    },
  ];
}

function makeWeatherResponse(stateSlug: string, countySlug: string) {
  const isArkansas = stateSlug === "arkansas";
  const isBriscoe = countySlug === "briscoe";
  const isPotter = countySlug === "potter";
  const countyName = isBriscoe ? "Briscoe" : isPotter ? "Potter" : countySlug === "randall" ? "Randall" : "Polk";
  const stateName = isArkansas ? "Arkansas" : "Texas";
  const stateAbbr = isArkansas ? "AR" : "TX";
  const city = isBriscoe ? "Silverton" : isArkansas ? "Mena" : "Amarillo";
  const measurement = (value: number | null, unit: "F" | "mph" | "percent" | "degrees" | "Pa") => ({
    value,
    unit,
    source: { value, unitCode: `wmoUnit:${unit}`, rawValue: value },
  });
  const forecast = Array.from({ length: 14 }, (_, index) => ({
    number: index + 1,
    name: index === 0 ? "Today" : index === 1 ? "Tonight" : `${index % 2 ? "Night" : "Day"} ${Math.ceil((index + 1) / 2)}`,
    startTime: `2026-08-${String(19 + Math.floor(index / 2)).padStart(2, "0")}T${index % 2 ? "18" : "06"}:00:00-05:00`,
    endTime: `2026-08-${String(19 + Math.floor(index / 2)).padStart(2, "0")}T${index % 2 ? "23" : "17"}:00:00-05:00`,
    isDaytime: index % 2 === 0,
    temperature: measurement(index % 2 === 0 ? 84 - index : 66 - index, "F"),
    windSpeed: measurement(10, "mph"),
    windDirection: "S",
    precipitationProbability: measurement(index === 0 ? 20 : 10, "percent"),
    shortForecast: index === 0 ? "Sunny" : index === 1 ? "Mostly Clear" : "Partly Cloudy",
    detailedForecast: "Seasonable conditions are expected across the county.",
  }));
  const hourly = Array.from({ length: 24 }, (_, index) => ({
    number: index + 1,
    name: "",
    startTime: `2026-08-${index < 11 ? "19" : "20"}T${String((13 + index) % 24).padStart(2, "0")}:00:00-05:00`,
    endTime: `2026-08-${index < 10 ? "19" : "20"}T${String((14 + index) % 24).padStart(2, "0")}:00:00-05:00`,
    isDaytime: index < 7,
    temperature: measurement(72 + (index < 6 ? index : 12 - index), "F"),
    windSpeed: measurement(8, "mph"),
    windDirection: "S",
    precipitationProbability: measurement(index < 4 ? 20 : 10, "percent"),
    shortForecast: index < 7 ? "Sunny" : "Mostly Clear",
    detailedForecast: "Hourly test forecast.",
  }));
  const rainfallValues = [0, 0.12, 0, 0.35, 0.01, 0, 0.48, 0.72, 0, 0.04, 0, 0.2, 0, 0.75];
  const rainfallDaily = rainfallValues.map((precipitationInches, index) => ({
    date: `2026-08-${String(12 + index).padStart(2, "0")}`,
    precipitationInches,
  }));

  return {
    county: {
      name: countyName,
      displayName: `${countyName} County`,
      slug: countySlug,
      fips: isArkansas ? "05113" : isBriscoe ? "48045" : isPotter ? "48375" : "48381",
      stateName,
      stateSlug,
      stateAbbr,
    },
    location: {
      latitude: isArkansas ? 34.49 : 34.5,
      longitude: isArkansas ? -94.23 : -101.3,
      city,
      state: stateAbbr,
      gridOffice: isArkansas ? "SHV" : "AMA",
      gridX: 42,
      gridY: 61,
      timeZone: "America/Chicago",
    },
    zones: {
      forecast: { id: isArkansas ? "ARZ040" : "TXZ016", link: `https://api.weather.gov/zones/forecast/${isArkansas ? "ARZ040" : "TXZ016"}` },
      county: { id: isArkansas ? "ARC113" : "TXC045", link: `https://api.weather.gov/zones/county/${isArkansas ? "ARC113" : "TXC045"}` },
    },
    currentObservation: {
      stationId: isArkansas ? "KMEZ" : "KAMA",
      stationName: `${city} Municipal Airport`,
      observedAt: "2026-08-19T13:00:00-05:00",
      textDescription: "Clear",
      temperature: measurement(72, "F"),
      relativeHumidity: measurement(48, "percent"),
      windSpeed: measurement(8, "mph"),
      windGust: measurement(14, "mph"),
      windDirection: measurement(180, "degrees"),
      barometricPressure: measurement(101325, "Pa"),
    },
    forecast,
    hourly,
    alerts: isBriscoe || isPotter
      ? []
      : [{
          id: "test-alert",
          event: "Severe Thunderstorm Warning",
          headline: `Severe Thunderstorm Warning for ${countyName} County`,
          description: "A severe thunderstorm is moving through the county.",
          instruction: "Move indoors and stay away from windows.",
          severity: "Severe",
          urgency: "Immediate",
          certainty: "Observed",
          effective: "2026-08-19T13:15:00-05:00",
          expires: "2026-08-19T15:00:00-05:00",
          link: "https://api.weather.gov/alerts/test-alert",
        }, {
          id: "test-flood-watch",
          event: "Flood Watch",
          headline: `Flood Watch for ${countyName} County`,
          description: "Heavy rain may cause flooding.",
          instruction: "Monitor later forecasts.",
          severity: "Moderate",
          urgency: "Expected",
          certainty: "Likely",
          effective: "2026-08-19T13:00:00-05:00",
          expires: "2026-08-20T01:00:00-05:00",
          link: "https://api.weather.gov/alerts/test-flood-watch",
        }],
    droughtCondition: isPotter
      ? {
          category: "D3",
          label: "Extreme Drought",
          areaPercent: 68.51,
          totalDroughtPercent: 100,
          categories: { d0: 100, d1: 100, d2: 100, d3: 68.51, d4: 0 },
          mapDate: "2026-08-11T00:00:00",
          validStart: "2026-08-11T00:00:00",
          validEnd: "2026-08-17T23:59:59",
          source: {
            name: "U.S. Drought Monitor",
            agency: "National Drought Mitigation Center, NOAA, and USDA",
            url: "https://usdmdataservices.unl.edu/api/CountyStatistics/GetDroughtSeverityStatisticsByAreaPercent?aoi=48375",
            countyUrl: "https://www.drought.gov/states/Texas/county/Potter",
          },
        }
      : undefined,
    rainfallHistory: {
      periodStart: "2026-08-12",
      periodEnd: "2026-08-25",
      dataThrough: "2026-08-25",
      requestedDays: 14,
      availableDays: 14,
      totalInches: 2.67,
      wetDays: 7,
      estimated: true,
      locationBasis: "county-centroid",
      daily: rainfallDaily,
      source: {
        name: "NASA POWER",
        agency: "NASA Langley Research Center",
        url: "https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR",
        documentation: "https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
        parameter: "PRECTOTCORR",
        nativeUnit: "mm/day",
        latencyNote: "NASA POWER meteorological data typically trails the current date by two to three days.",
      },
    },
    warnings: [],
    meta: {
      fetchedAt: "2026-08-19T18:05:00.000Z",
      partial: false,
      cacheTtlSeconds: 600,
      alertsCacheTtlSeconds: 180,
      pointsCacheTtlSeconds: 86400,
      units: {
        temperature: "F",
        windSpeed: "mph",
        precipitationProbability: "percent",
        precipitationHistory: "inches",
      },
      source: {
        name: "National Weather Service",
        documentation: "https://www.weather.gov/documentation/services-web-api",
        alertsDocumentation: "https://www.weather.gov/documentation/services-web-alerts",
        links: {
          points: "https://api.weather.gov/points/34.49,-94.23",
          forecast: "https://api.weather.gov/gridpoints/SHV/42,61/forecast",
          hourly: "https://api.weather.gov/gridpoints/SHV/42,61/forecast/hourly",
          observationStations: "https://api.weather.gov/gridpoints/SHV/42,61/stations",
          latestObservation: "https://api.weather.gov/stations/KMEZ/observations/latest",
          alerts: ["https://api.weather.gov/alerts/active?point=34.49,-94.23"],
        },
      },
    },
  };
}

function makeItems({
  source,
  topic,
  count,
  offset = 0,
  stateLabel,
}: {
  source: string;
  topic: string;
  count: number;
  offset?: number;
  stateLabel: string;
}) {
  return Array.from({ length: count }, (_, index) => {
    const itemNumber = index + offset + 1;
    const itemSource = `${source} ${String(itemNumber).padStart(2, "0")}`;
    const date = new Date(Date.UTC(2026, 5, 27 - itemNumber, 12, 0, 0));
    const title = `${stateLabel} ${topic} story ${String(itemNumber).padStart(2, "0")} dispatch${itemNumber} from ${source}`;

    return {
      id: `${itemSource}-${topic}-${itemNumber}`,
      title,
      link: `https://example.com/${source.toLowerCase().replace(/\s+/g, "-")}/${topic.toLowerCase().replace(/\s+/g, "-")}/${itemNumber}`,
      source: itemSource,
      publishedAt: date.toUTCString(),
      description: title,
      imageUrl: "",
    };
  });
}
