import { expect, test } from "@playwright/test";
import { getCountiesForState, getCounty, getCountyMarketCities } from "../../src/data/counties";
import { states } from "../../src/data/states";

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
  const isBriscoe = countySlug === "briscoe";
  const isArkansas = stateSlug === "arkansas";

  const topic = isObituary ? "Obituary" : isSports ? "Sports" : isCrime ? "Crime" : "Local News";
  return isBriscoe
    ? [
        ...makeItems({ source: "Briscoe County Test", topic, count: Math.min(4, limit), stateLabel: "Texas" }),
        ...makeItems({ source: "Lubbock Daily Test", topic, count: Math.max(0, limit - 4), offset: 4, stateLabel: "Texas" }),
      ]
    : makeItems({
        source: isArkansas ? "Arkansas State Test" : scope === "national" ? "National Test" : "Randall County Test",
        topic,
        count: limit,
        stateLabel: isArkansas ? "Arkansas" : "Texas",
      });
}

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

test("county feeds merge nearby-market stories, sort newest first, and keep batched sections stable", async ({ page }) => {
  await page.goto("/texas/randall");

  await expect(page.getByRole("heading", { level: 1, name: /Randall County/i })).toBeVisible();
  await expect(page.getByText("Amarillo, TX")).toBeVisible();

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
  await page.goto("/states/arkansas");

  await expect(page.getByRole("heading", { name: /Arkansas/i })).toBeVisible();
  const stateSection = page.locator("section", { has: page.getByRole("heading", { name: "State headlines" }) });
  await expect.poll(async () => stateSection.locator(".feed-card").count()).toBeGreaterThanOrEqual(12);
  await expect(stateSection.locator(".feed-card").first()).toContainText("Arkansas");
  await expect(stateSection.locator(".feed-card").first().locator(".feed-meta")).toContainText("Jun 26, 2026");
});

test("rural counties expand to nearby hubs while keeping county matches first", async ({ page }) => {
  await page.goto("/texas/briscoe");

  await expect(page.getByRole("heading", { level: 1, name: /Briscoe County/i })).toBeVisible();
  await expect(page.getByText("Amarillo, TX")).toBeVisible();
  await expect(page.getByText(/expands to nearby markets including Amarillo and Lubbock/i).first()).toBeVisible();
  await expect(page.getByText(/Houston Daily Test/)).toHaveCount(0);

  const localSection = page.locator("section", { has: page.getByRole("heading", { name: "Local headlines" }) });
  const localCards = localSection.locator(".feed-card");
  await expect.poll(async () => localCards.count()).toBeGreaterThanOrEqual(16);
  await expect(localCards.first()).toContainText("Briscoe County Test");
  await expect(localSection).toContainText("Lubbock Daily Test");
});

test("one sampled county in every state receives an in-state fallback market", () => {
  for (const state of states) {
    const county = getCountiesForState(state.slug)[0];
    expect(county, `${state.name} should have counties`).toBeTruthy();

    const markets = getCountyMarketCities(county, 2);
    expect(markets.length, `${county.displayName}, ${state.name} should have fallback markets`).toBeGreaterThan(0);
  }

  const briscoe = getCounty("texas", "briscoe");
  expect(briscoe).toBeTruthy();
  expect(getCountyMarketCities(briscoe!, 2)).toEqual(["Amarillo", "Lubbock"]);
});

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
