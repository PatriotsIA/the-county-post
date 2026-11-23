import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    return ["127.0.0.1", "localhost"].includes(host) ? route.continue() : route.abort();
  });
  await page.goto("/texas/potter");
});

async function openFetch(page: Page) {
  await page.getByRole("button", { name: "Ask Fetch" }).click();
  return page.getByRole("dialog", { name: "Ask Fetch" });
}

async function ask(page: Page, question: string) {
  const input = page.getByRole("textbox", { name: "Ask Fetch a question" });
  await input.fill(question);
  await input.press("Enter");
}

test("opens the current county desk and keeps Back working", async ({ page }) => {
  await openFetch(page);
  await ask(page, "Take me to public meetings");
  await expect(page).toHaveURL(/\/texas\/potter\/public-notices$/);
  await expect(page.getByRole("dialog", { name: "Ask Fetch" })).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/texas\/potter$/);
});

test("explains a desk and preserves it while clarifying a different county", async ({ page }) => {
  const dialog = await openFetch(page);
  await ask(page, "How do I find Jefferson County weather?");
  await expect(dialog.getByText("Which county did you mean?", { exact: false })).toBeVisible();
  await ask(page, "Texas");
  await dialog.getByRole("button", { name: "Open Weather · Jefferson County" }).click();
  await expect(page).toHaveURL(/\/texas\/jefferson\/weather$/);
});

test("an unlisted county never opens the current edition by mistake", async ({ page }) => {
  const dialog = await openFetch(page);
  await ask(page, "Open the weather in Xylophone County");
  await expect(dialog.getByText("I couldn’t match that place.", { exact: false })).toBeVisible();
  await ask(page, "Randall, TX");
  await expect(page).toHaveURL(/\/texas\/randall\/weather$/);
});

test("recognizes a request for local writers and offers help for a new task", async ({ page }) => {
  await page.route("**/v1/sources/counties/texas/potter", (r) =>
    r.fulfill({
      json: {
        sources: [
          {
            name: "Amarillo Globe-News",
            websiteUrl: "https://www.amarillo.com/",
            outletTypes: ["newspaper"],
          },
        ],
      },
    }),
  );
  const dialog = await openFetch(page);
  await ask(page, "Who else writes about this area?");
  await expect(dialog.getByRole("link", { name: "Amarillo Globe-News" })).toHaveAttribute(
    "href",
    "https://www.amarillo.com/",
  );
  await ask(page, "Can you help me with something else?");
  await dialog.getByRole("button", { name: "Classifieds" }).click();
  await expect(page).toHaveURL(/\/texas\/potter\/classifieds$/);
});

test("national edition asks for a county and remembers the requested desk", async ({ page }) => {
  await page.goto("/");
  await openFetch(page);
  await ask(page, "Open weather");
  await ask(page, "Randall, TX");
  await expect(page).toHaveURL(/\/texas\/randall\/weather$/);
});

test("an indirect request to sell a used item keeps the current county", async ({ page }) => {
  const dialog = await openFetch(page);
  await ask(page, "Where could I put a used lawnmower up for someone to buy?");
  await dialog.getByRole("button", { name: "Open Classifieds · Potter County" }).click();
  await expect(page).toHaveURL(/\/texas\/potter\/classifieds$/);
});

test("mobile tour highlights the real controls and Escape returns focus", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  const dialog = await openFetch(page);
  await dialog.getByRole("button", { name: "Take a tour" }).click();
  await expect(dialog.getByRole("heading", { name: "Find your edition" })).toBeVisible();
  await expect(page.locator(".menu-toggle.fetch-highlight")).toBeVisible();
  await dialog.getByRole("button", { name: "Next step" }).click();
  await expect(page.locator(".context-nav.fetch-highlight")).toBeVisible();
  await dialog.getByRole("button", { name: "Next step" }).click();
  await expect(page.locator(".page-jump-toggle.fetch-highlight")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Ask Fetch" })).toBeFocused();
  await expect(page.locator(".fetch-highlight")).toHaveCount(0);
});

test("the national GDP question combines a state near the city with the named county", async ({ page }) => {
  await page.route("**/v1/counties/texas/potter/economic-data", (route) =>
    route.fulfill({
      json: {
        county: { fips: "48375" },
        metrics: [
          {
            key: "gross-domestic-product",
            valueKind: "currency-thousands",
            latest: { date: "2024-01-01", value: 11378321 },
            source: "BEA",
            seriesId: "GDPALL48375",
            seriesUrl: "https://fred.stlouisfed.org/series/GDPALL48375",
          },
        ],
      },
    }),
  );
  await page.goto("/");
  const dialog = await openFetch(page);
  await expect(dialog.getByText(/include the county and state/)).toBeVisible();
  await ask(page, "What's the GDP of Amarillo, Texas according to Potter County?");
  await expect(dialog.getByText(/Potter County’s GDP was \$11.4B in 2024/)).toBeVisible();
  await expect(dialog.getByText(/City and metro-area GDP use different boundaries/)).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Open county economic data" })).toHaveAttribute(
    "href",
    "/texas/potter/economic-data",
  );
});

for (const start of ["/", "/ohio", "/texas/potter"]) {
  test(`answers named-county weather inline from ${start}`, async ({ page }) => {
    await page.route("**/v1/counties/pennsylvania/potter/weather", (route) =>
      route.fulfill({
        json: {
          county: { fips: "42105" },
          location: { timeZone: "America/New_York" },
          zones: {},
          currentObservation: {
            stationId: "TEST",
            temperature: { value: 42 },
            textDescription: "Light rain",
          },
          forecast: [],
          hourly: [],
          alerts: [],
          warnings: [],
          meta: {
            cacheTtlSeconds: 60,
            alertsCacheTtlSeconds: 60,
            source: { links: { points: "https://api.weather.gov/" } },
          },
        },
      }),
    );
    await page.goto(start);
    const dialog = await openFetch(page);
    await ask(page, "Show me the weather in Potter County, Pennsylvania");
    await expect(dialog.getByText(/42°F · Light rain/)).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Open full weather report" })).toHaveAttribute(
      "href",
      "/pennsylvania/potter/weather",
    );
    await expect(page).toHaveURL((url) => url.pathname === start);
  });
}

for (const start of ["/texas/potter", "/ohio", "/"]) {
  test(`answers the Potter County / Amarillo news question with reports from the feed from ${start}`, async ({
    page,
  }) => {
    const story = (id: string, title: string, description: string, day: number) => ({
      id,
      title,
      description,
      source: "County Times",
      link: "https://example.org/" + id,
      publishedAt: `2026-11-${day}T12:00:00Z`,
    });
    await page.route("**/v1/pages/counties/texas/potter?**", (route) =>
      route.fulfill({
        json: {
          scope: { places: ["Amarillo", "Bushland"], trustedHosts: ["example.org"] },
          sections: {
            localNews: {
              items: [
                story("regional", "Regional roundup", "", 19),
                story(
                  "library",
                  "Bushland library opens a reading room",
                  "<p>The room has books &amp; space for after-school programs.</p>",
                  18,
                ),
                story("library-2", "Bushland library unveils new reading room", "", 18),
                story("road", "Amarillo bridge reopens", "Repairs finished on Friday.", 17),
                story("out-of-state", "Ohio bridge reopens", "", 19),
              ],
            },
          },
        },
      }),
    );
    await page.goto(start);
    const dialog = await openFetch(page);
    await ask(page, "what's happening in the local news in Potter County / Amarillo, Texas?");
    const answer = dialog.locator(".fetch-answer");
    await expect(answer.getByRole("heading", { name: "News briefing" })).toBeVisible();
    await expect(answer.locator("li").first().getByRole("link")).toHaveAttribute(
      "href",
      "https://example.org/library",
    );
    await expect(answer.getByText("The room has books & space for after-school programs.")).toBeVisible();
    await expect(answer.getByText("County Times · Nov 18, 2026")).toBeVisible();
    await expect(answer.getByText("Amarillo bridge reopens")).toBeVisible();
    await expect(answer.getByText(/Ohio bridge|unveils new reading/)).toHaveCount(0);
    await expect(page).toHaveURL((url) => url.pathname === start);
    await ask(page, "What’s happening with the bridge in Potter County, Texas?");
    await expect(answer.getByRole("heading", { name: "Articles from the feeds" })).toBeVisible();
    await expect(answer.getByText("Repairs finished on Friday.")).toBeVisible();
    await expect(answer.getByText("Bushland library opens a reading room")).toHaveCount(0);
  });
}

test("an empty news briefing checks the other desks and reports the empty edition inline", async ({
  page,
}) => {
  const sections: string[] = [];
  await page.route("**/v1/pages/counties/texas/potter?**", (route) => {
    sections.push(new URL(route.request().url()).searchParams.get("sections") || "");
    return route.fulfill({ json: { sections: { localNews: { items: [] } } } });
  });
  await page.reload();
  const dialog = await openFetch(page);
  await ask(page, "Catch me up on the local headlines");
  await expect(dialog.getByText("There are no stories in this edition’s current feeds.")).toBeVisible();
  expect(sections.some((section) => section.includes("crime"))).toBe(true);
  await ask(page, "Open the county front page for Randall County, Texas");
  await expect(page).toHaveURL(/\/texas\/randall$/);
});

test("article lookup keeps the question through a county choice and searches beyond the lead feed", async ({
  page,
}) => {
  await page.route("**/v1/pages/counties/texas/jefferson?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const topic = params.get("sections")?.includes("sports") ? "sports" : "localNews";
    const story = (id: string, title: string) => ({
      id,
      title,
      link: "https://example.org/" + id,
      publishedAt: "2026-11-18",
      source: "County Times",
    });
    const items =
      topic === "sports"
        ? [
            story("bridge", "Beaumont railway bridge reopens"),
            story("wrong", "Ohio railway bridge closure"),
            story("noise", "Beaumont school election"),
          ]
        : [];
    return route.fulfill({ json: { scope: { places: ["Beaumont"] }, sections: { [topic]: { items } } } });
  });
  await page.goto("/");
  const dialog = await openFetch(page);
  await ask(page, "Find articles about the railway bridge in Jefferson County");
  await ask(page, "Texas");
  await expect(dialog.getByRole("link", { name: "Beaumont railway bridge reopens" })).toHaveAttribute(
    "href",
    "https://example.org/bridge",
  );
  await expect(dialog.getByText("Ohio railway bridge closure")).toHaveCount(0);
  await expect(dialog.getByText("Beaumont school election")).toHaveCount(0);
});

test("a named Legends episode comes from the published catalog", async ({ page }) => {
  const dialog = await openFetch(page);
  await ask(page, "Find the Panhandle Legends episode about Rick Husband");
  await expect(dialog.getByRole("link", { name: "Rick Husband", exact: true })).toHaveAttribute(
    "href",
    "https://vimeo.com/1165499745",
  );
});

test("the launcher sits above Jump to on desktop and phone", async ({ page }) => {
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 800 });
    const fetch = await page.getByRole("button", { name: "Ask Fetch" }).boundingBox();
    const jump = await page.locator(".page-jump-toggle").boundingBox();
    expect(fetch!.y + fetch!.height).toBeLessThan(jump!.y);
    expect(Math.abs(fetch!.x + fetch!.width - jump!.x - jump!.width)).toBeLessThan(2);
  }
});

test("national and state article searches use the requested edition and distinguish no matches", async ({
  page,
}) => {
  const scopes: string[] = [];
  await page.route("**/v1/pages/**", (route) => {
    const url = new URL(route.request().url());
    scopes.push(url.pathname);
    return route.fulfill({ json: { sections: { general: { items: [] } }, scope: {} } });
  });
  await page.goto("/");
  const dialog = await openFetch(page);
  await ask(page, "Find articles about zeppelins");
  await expect(dialog.getByText(/couldn’t find a match/)).toBeVisible();
  expect(scopes).toContain("/v1/pages/national");
  await ask(page, "Find articles about zeppelins in New Mexico");
  await expect(dialog.locator(".fetch-answer > small")).toHaveText("New Mexico");
  await expect(dialog.getByText(/couldn’t find a match/)).toBeVisible();
  expect(scopes).toContain("/v1/pages/states/new-mexico");
});

test("a suppressed Atlas value stays suppressed and links to its domain", async ({ page }) => {
  const domain = { slug: "demographics", label: "Demographics", metricKeys: ["population"] };
  const geo = { fips: "48375", slug: "potter", stateSlug: "texas", displayName: "Potter County" };
  const meta = { version: "1", partial: true, cacheTtlSeconds: 300 };
  await page.route("**/v1/counties/texas/potter/atlas", (route) =>
    route.fulfill({
      json: { county: geo, domains: [{ domain, available: true, featuredMetrics: [] }], meta },
    }),
  );
  await page.route("**/v1/counties/texas/potter/atlas/demographics", (route) =>
    route.fulfill({
      json: {
        county: geo,
        domain,
        meta,
        metrics: [
          {
            key: "population",
            label: "Population",
            suppressed: true,
            vintage: "2025",
            source: { name: "Census", url: "https://www.census.gov/" },
          },
        ],
      },
    }),
  );
  await page.goto("/");
  const dialog = await openFetch(page);
  await ask(page, "What is the population of Potter County TX?");
  await expect(dialog.getByText(/Population · Suppressed · 2025/)).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Open full desk" })).toHaveAttribute(
    "href",
    "/texas/potter/data/demographics",
  );
});

function report(id: string, title: string, publishedAt: string, description = "") {
  return { id, title, publishedAt, description, source: "County Times", link: "https://example.org/" + id };
}

test("numbered follow-ups use the displayed list and preserve its county on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const items = [
    report("road", "Bushland bridge opens", "2026-11-18", "The west lane reopened."),
    report("library", "Amarillo library moves downtown", "2026-11-17", "The library moved to Main Street."),
    report("books", "Bushland volunteers deliver library books", "2026-11-16"),
  ];
  await page.route("**/v1/pages/counties/texas/potter?**", (r) =>
    r.fulfill({
      json: {
        scope: { places: ["Bushland", "Amarillo"] },
        sections: { localNews: { items } },
      },
    }),
  );
  await page.reload();
  const dialog = await openFetch(page);
  await ask(page, "What’s happening in Potter County?");
  await expect(dialog.getByRole("heading", { name: "News briefing" })).toBeVisible();
  await expect(dialog.getByRole("listitem").nth(1)).toContainText("Amarillo library moves downtown");
  await ask(page, "Tell me more about the second story");
  await expect(dialog.getByRole("heading", { name: items[1].title })).toBeVisible();
  await expect(dialog.getByText(items[1].description)).toBeVisible();
  await ask(page, "Who reported that?");
  await expect(dialog.getByText("Reported by County Times.")).toBeVisible();
  await page.context().route("https://example.org/**", (r) => r.fulfill({ body: "Publisher" }));
  const popup = page.waitForEvent("popup");
  await ask(page, "Open the second story");
  await expect(await popup).toHaveURL(items[1].link);
  await ask(page, "Show me more like the second story");
  await expect(dialog.getByRole("link", { name: items[2].title })).toBeVisible();
  await expect(dialog.getByRole("link", { name: items[1].title })).toHaveCount(0);
  await ask(page, "Open the fifth story");
  await expect(dialog.getByRole("heading", { name: "Which story did you mean?" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: items[2].title })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Ask Fetch" })).toBeFocused();
});

test("national ambiguity, state context, and a city spanning two counties", async ({ page }) => {
  await page.goto("/");
  let dialog = await openFetch(page);
  await ask(page, "What's happening in Potter County?");
  await expect(dialog.getByRole("button", { name: "Potter County, PA" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Potter County, TX" })).toBeVisible();
  await page.goto("/texas");
  dialog = await openFetch(page);
  await ask(page, "News in Potter County?");
  await expect(dialog.locator(".fetch-answer > small")).toHaveText("Potter County, TX");
  await ask(page, "Weather in Amarillo, Texas?");
  await expect(dialog.getByRole("button", { name: "Potter County, TX" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Randall County, TX" })).toBeVisible();
  await ask(page, "Randall");
  await expect(dialog.locator(".fetch-answer > small")).toHaveText("Randall County, TX");
});

test("date windows use publication time and identify an earlier report in a sparse county", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 10, 19, 16));
  const stamp = (d: number, h = 12) => new Date(2026, 10, d, h).toISOString();
  const items = [
    report("undated", "Silverton school update", ""),
    report("old", "Silverton school roof replaced", stamp(12)),
    report("newer", "Silverton school gym repairs", stamp(18, 23)),
    report("current", "Silverton bridge reopened", stamp(19, 0)),
    report("future", "Silverton school fundraiser", stamp(20)),
  ];
  await page.route("**/v1/pages/counties/texas/briscoe?**", (r) =>
    r.fulfill({
      json: {
        scope: { places: ["Silverton"] },
        sections: { localNews: { items } },
      },
    }),
  );
  await page.goto("/texas/randall");
  const dialog = await openFetch(page);
  await ask(page, "Today's headlines in Briscoe County, Texas");
  await expect(dialog.getByText(/Published today/)).toBeVisible();
  await expect(dialog.getByRole("listitem")).toHaveCount(1);
  await expect(dialog.getByRole("link", { name: items[3].title })).toBeVisible();
  await ask(page, "Find school stories today in Briscoe County, Texas");
  await expect(dialog.getByText(/latest earlier match/)).toBeVisible();
  await expect(dialog.getByRole("listitem")).toHaveCount(1);
  await expect(dialog.getByRole("link", { name: items[2].title })).toBeVisible();
  await ask(page, "This week's headlines in Briscoe County, Texas");
  await expect(dialog.getByText(/Published this week/)).toBeVisible();
  await expect(dialog.getByRole("listitem")).toHaveCount(2);
});

test("a visible RSS fallback report can be retrieved while the API is down", async ({ page }) => {
  await page.route("**/v1/pages/**", (r) => r.fulfill({ status: 404 }));
  await page.route("**/v1/feeds/**", (r) => r.fulfill({ status: 404 }));
  await page.route("**/api.json?**", (r) =>
    r.fulfill({
      json: {
        status: "ok",
        feed: { title: "County Times" },
        items: [
          {
            guid: "rss",
            title: "Amarillo library restores evening hours",
            link: "https://example.org/hours",
            author: "County Times",
            pubDate: new Date().toISOString(),
            description: "Potter County, Texas readers can visit after work.",
          },
        ],
      },
    }),
  );
  await page.reload();
  await expect(
    page.locator(".feed-card").getByRole("link", { name: "Amarillo library restores evening hours" }).first(),
  ).toBeVisible();
  const dialog = await openFetch(page);
  await ask(page, "Find stories about evening library hours in Potter County");
  await expect(dialog.getByRole("link", { name: "Amarillo library restores evening hours" })).toHaveAttribute(
    "href",
    "https://example.org/hours",
  );
  await expect(
    dialog.getByText("Some news sources were unavailable. These results may be incomplete."),
  ).toBeVisible();
  await ask(page, "Find stories about evening library hours in Briscoe County, Texas");
  await expect(dialog.getByText(/couldn’t check all the feeds/)).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Amarillo library restores evening hours" })).toHaveCount(0);
});

test("pilot outcomes count completed turns once and contain only routing, outcome and timing", async ({
  page,
}) => {
  const events: Record<string, unknown>[] = [];
  await page.exposeFunction("capturePilotOutcome", (data: Record<string, unknown>) => events.push(data));
  await page.addInitScript(() =>
    window.addEventListener("fetch-pilot-outcome", (event) => {
      (window as Window & { capturePilotOutcome: (value: unknown) => void }).capturePilotOutcome(
        (event as CustomEvent).detail,
      );
    }),
  );
  await page.route("**/v1/pages/**", (r) => r.fulfill({ json: { sections: { general: { items: [] } } } }));
  await page.goto("/");
  const dialog = await openFetch(page);
  await ask(page, "Find library stories in Potter County");
  await expect(dialog.getByRole("button", { name: "Potter County, PA" })).toBeVisible();
  await ask(page, "Pennsylvania");
  await expect(dialog.getByText(/couldn’t find a match/)).toBeVisible();
  await expect.poll(() => events.map((e) => e.outcome)).toEqual(["clarification", "empty"]);
  for (const event of events) {
    expect(Object.keys(event).sort()).toEqual(["duration_ms", "outcome", "route"]);
    expect(event.route).toBe("local");
    expect(event.duration_ms).toEqual(expect.any(Number));
  }
});

test("a story in the national desk displayed on a county page keeps its national attribution", async ({
  page,
}) => {
  const national = report("instruments", "Museum restores vintage instruments", "2026-11-18");
  await page.route("**/v1/pages/**", (route) =>
    route.fulfill({
      json: {
        sections: {
          localNews: { items: [] },
          general: { items: [] },
        },
      },
    }),
  );
  await page.route("**/v1/feeds/**", (route) =>
    route.fulfill({
      json: {
        items: route.request().url().includes("/feeds/national/general") ? [national] : [],
      },
    }),
  );
  await page.reload();
  await expect(page.locator(".feed-card").getByRole("link", { name: national.title }).first()).toBeVisible();
  const dialog = await openFetch(page);
  await ask(page, "Find the story on this page about vintage museum instruments");
  await expect(dialog.locator(".fetch-answer > small")).toHaveText("National edition");
  await expect(dialog.getByRole("link", { name: national.title })).toHaveAttribute("href", national.link);
  await ask(page, "Find stories about vintage museum instruments in Potter County");
  await expect(dialog.locator(".fetch-answer > small")).toHaveText("Potter County, TX");
  await expect(dialog.getByRole("link", { name: national.title })).toHaveCount(0);
});

test("provider failures in a successful HTTP response are distinguished from an empty edition", async ({
  page,
}) => {
  await page.route("**/v1/pages/**", (route) =>
    route.fulfill({
      json: {
        sections: {
          general: { items: [], meta: { retrieval: { attempted: 2, failed: 2 }, stale: true } },
        },
      },
    }),
  );
  await page.goto("/");
  const dialog = await openFetch(page);
  await ask(page, "National headlines today");
  await expect(dialog.getByText(/couldn’t check all the feeds/)).toBeVisible();
  await expect(dialog.getByText(/cached reports/)).toBeVisible();
  await expect(dialog.getByText(/no stories|no matching report/i)).toHaveCount(0);
});

test("a reader can compare two states, change the measure and return to a tour lesson", async ({ page }) => {
  await page.goto("/");
  const dialog = await openFetch(page);
  await dialog.getByRole("button", { name: "Take a tour" }).click();
  await dialog.getByLabel("Jump to a lesson").selectOption({ label: "6. Compare places" });
  await dialog.getByRole("button", { name: /Try .*Compare rent/ }).click();
  await expect(dialog.getByRole("heading", { name: "Median monthly gross rent" })).toBeVisible();
  await expect(dialog.getByText("$1,403", { exact: false })).toBeVisible();
  await expect(dialog.getByText(/differ by \$389\./)).toBeVisible();
  await expect(dialog.getByText(/\$78,476/)).toBeVisible();
  await expect(dialog.getByText("2020–2024 survey estimate")).toHaveCount(2);
  await expect(dialog.getByRole("link", { name: /B25064/ })).toHaveAttribute("href", /ACSDT5Y2024.B25064$/);
  await ask(page, "What about population growth from 2020 to 2025?");
  await expect(dialog.getByRole("heading", { name: "Population change, 2020–2025" })).toBeVisible();
  await expect(dialog.getByText("31,709,821", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Back to tour" }).click();
  await expect(dialog.getByRole("heading", { name: "Compare places" })).toBeVisible();
});

test("state selections work without typing and distinguish overlapping names and unavailable figures", async ({
  page,
}) => {
  const dialog = await openFetch(page);
  await dialog.getByRole("button", { name: "Compare states" }).click();
  await dialog.getByLabel("State 1").selectOption("west-virginia");
  await dialog.getByLabel("State 2").selectOption("virginia");
  await dialog.getByRole("combobox", { name: "Measure", exact: true }).selectOption("population");
  await expect(dialog.locator("dt")).toHaveText(["West Virginia", "Virginia"]);
  await ask(page, "Compare average rent in West Virginia and Virginia");
  await expect(dialog.getByText(/state measures available/)).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Median monthly gross rent" })).toHaveCount(0);
  await ask(page, "What about population in 1990?");
  await expect(dialog.getByText(/No figure for the requested year/)).toBeVisible();
  await ask(page, "Compare the population in TX and OK");
  await expect(dialog.locator("dt")).toHaveText(["Texas", "Oklahoma"]);
});

test("national readers can pick weather by county without entering text on a small phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  const dialog = await openFetch(page);
  await dialog.getByRole("button", { name: "Check the weather" }).click();
  await dialog.getByRole("combobox", { name: "State", exact: true }).selectOption("texas");
  await dialog.getByRole("combobox", { name: "County", exact: true }).selectOption("randall");
  await expect(dialog.getByRole("link", { name: "Open full weather report" })).toHaveAttribute(
    "href",
    "/texas/randall/weather",
  );
  await expect(dialog.getByRole("textbox")).toBeInViewport();
  await dialog.getByRole("button", { name: "Start over" }).click();
  await ask(page, "I'm lost");
  await expect(dialog.getByRole("heading", { name: "Browse the site" })).toBeVisible();
  await dialog.locator("summary", { hasText: "Classifieds, email" }).click();
  await dialog.getByRole("link", { name: "Get the Morning Post email" }).click();
  await expect(page).toHaveURL(/\/morning-post$/);
});

test("the published Atlas catalog exposes measures by button, including newly supplied keys", async ({
  page,
}) => {
  const county = { slug: "potter", stateSlug: "texas", displayName: "Potter County", fips: "48375" };
  const domain = { slug: "housing", label: "Housing", metricKeys: [] };
  const meta = { version: "1", partial: false, cacheTtlSeconds: 300 };
  await page.route("**/potter/atlas", (r) =>
    r.fulfill({ json: { county, domains: [{ domain, available: true, featuredMetrics: [] }], meta } }),
  );
  await page.route("**/potter/atlas/housing", (r) =>
    r.fulfill({
      json: {
        county,
        domain,
        metrics: [
          {
            key: "new-housing-index",
            label: "New housing index",
            unit: "index",
            valueKind: "index",
            value: 47,
            vintage: "2025",
            source: { name: "Census", url: "https://www.census.gov/" },
          },
        ],
        meta,
      },
    }),
  );
  const dialog = await openFetch(page);
  await dialog.getByRole("button", { name: "Browse the site" }).click();
  await dialog.locator("summary", { hasText: "Population, housing" }).click();
  await dialog.getByRole("button", { name: "Explore county figures in Fetch" }).click();
  await dialog.getByLabel("Explore a data desk").selectOption({ label: "Housing" });
  await dialog.getByLabel("Explore a measure").selectOption({ label: "New housing index" });
  await expect(dialog.getByText("New housing index · 47 · 2025")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Open full desk" })).toHaveAttribute(
    "href",
    "/texas/potter/data/housing",
  );
});

test("historical county income uses the requested FRED observation", async ({ page }) => {
  await page.route("**/potter/economic-data", (r) =>
    r.fulfill({
      json: {
        county: { fips: "48375" },
        metrics: [
          {
            key: "per-capita-personal-income",
            label: "Per capita personal income",
            valueKind: "currency",
            seriesId: "PCPI48375",
            seriesUrl: "https://fred.stlouisfed.org/series/PCPI48375",
            source: "BEA",
            latest: { date: "2024-01-01", value: 45000 },
            observations: [{ date: "2018-01-01", value: 38123 }],
          },
        ],
      },
    }),
  );
  const dialog = await openFetch(page);
  await ask(page, "What was per capita personal income in 2018?");
  await expect(dialog.getByText("Per capita personal income · $38,123 · 2018")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "PCPI48375" })).toBeVisible();
});

test("everyday names open the corresponding desk in the requested edition", async ({ page }) => {
  await page.goto("/");
  await openFetch(page);
  await ask(page, "Where are the obits in Potter County, Texas?");
  await expect(page).toHaveURL(/\/texas\/potter#desk-obituaries$/);
  await expect(page.locator("#desk-obituaries")).toBeInViewport();
});

test("a broad topic offers choices and keeps the named county on the selected desk", async ({ page }) => {
  await page.goto("/");
  const dialog = await openFetch(page);
  await ask(page, "Housing in Randall County, Texas");
  await expect(dialog.getByRole("heading", { name: "What would you like to find?" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Find housing stories" })).toBeVisible();
  await dialog.getByRole("button", { name: "Browse local listings" }).click();
  await expect(page).toHaveURL(/\/texas\/randall\/classifieds$/);
});

test("free text matches a published measure absent from the overview and a story in the same edition", async ({
  page,
}) => {
  const domain = { slug: "infrastructure", label: "Infrastructure", metricKeys: [] };
  const county = { fips: "48375", stateSlug: "texas", slug: "potter", displayName: "Potter County" };
  const meta = { version: "1", partial: false, cacheTtlSeconds: 300 };
  await page.route("**/potter/atlas", (r) =>
    r.fulfill({ json: { county, domains: [{ domain, available: true, featuredMetrics: [] }], meta } }),
  );
  await page.route("**/potter/atlas/infrastructure", (r) =>
    r.fulfill({
      json: {
        county,
        domain,
        meta,
        metrics: [
          {
            key: "footbridges",
            label: "Footbridges",
            source: { name: "County survey", url: "https://example.org/survey" },
            value: 12,
            unit: "count",
            valueKind: "number",
            vintage: "2025",
          },
        ],
      },
    }),
  );
  await page.route("**/v1/pages/counties/texas/potter?**", (r) =>
    r.fulfill({
      json: {
        scope: { places: ["Amarillo"], trustedHosts: ["example.org"] },
        sections: {
          localNews: { items: [report("bridge", "Amarillo restores its footbridges", "2026-11-18")] },
        },
      },
    }),
  );
  const dialog = await openFetch(page);
  await ask(page, "footbridgs");
  await expect(dialog.getByRole("link", { name: "Amarillo restores its footbridges" })).toBeVisible();
  await dialog.getByLabel("Explore a measure").selectOption({ label: "Footbridges" });
  await expect(dialog.getByText("Footbridges · 12 · 2025")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "County survey" })).toHaveAttribute(
    "href",
    "https://example.org/survey",
  );
});

test("a remembered helicopter story matches the published headline and supplies its real source", async ({
  page,
}) => {
  await page.route("**/v1/pages/counties/texas/potter?**", (r) =>
    r.fulfill({
      json: {
        scope: { places: ["Amarillo"], trustedHosts: ["example.org"] },
        sections: {
          localNews: {
            items: [
              report("air", "Amarillo plant receives first Black Hawk replacement fuselage", "2026-11-18"),
              report("school", "Amarillo schools open new library", "2026-11-19"),
            ],
          },
        },
      },
    }),
  );
  const dialog = await openFetch(page);
  await ask(page, "What was that helicopter story in Potter County, Texas?");
  await expect(dialog.getByRole("link", { name: /first Black Hawk/ })).toHaveAttribute(
    "href",
    "https://example.org/air",
  );
  await expect(dialog.getByRole("link", { name: /schools open/ })).toHaveCount(0);
});

test("a specific hearing can be on a later notice page and unrelated hearings stay out", async ({ page }) => {
  const record = (title: string, id: string) => ({
    id,
    title,
    url: "https://example.org/" + id,
    sourceName: "County Clerk",
    category: "hearing",
    geographyLabel: "Potter County",
    countyFips: ["48375"],
  });
  await page.route("**/texas/potter/public-notices?**", (r) => {
    const offset = Number(new URL(r.request().url()).searchParams.get("offset"));
    return r.fulfill({
      json: {
        county: { fips: "48375", state: "texas", county: "potter" },
        items: [offset ? record("Drainage hearing", "drain") : record("Annexation hearing", "other")],
        sources: [],
        meta: { status: "current", rollout: "texas", offset, hasMore: offset === 0, totalAvailable: 2 },
      },
    });
  });
  const dialog = await openFetch(page);
  await ask(page, "Are there public hearings about drainage?");
  await expect(dialog.getByRole("link", { name: "Drainage hearing" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Annexation hearing" })).toHaveCount(0);
  await ask(page, "Are there public hearings about zoning?");
  await expect(dialog.getByText(/no matching official notice/)).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Drainage hearing" })).toHaveCount(0);
});

test("a failed county data service leaves matching site pages usable in free-text search", async ({
  page,
}) => {
  await page.route("**/v1/counties/texas/potter/atlas", (r) => r.fulfill({ status: 503, json: {} }));
  await page.route("**/v1/pages/**", (r) => r.fulfill({ json: { sections: { general: { items: [] } } } }));
  const dialog = await openFetch(page);
  await ask(page, "Search the site for monetary policy");
  await expect(dialog.getByRole("link", { name: "Monetary Policy", exact: true })).toHaveAttribute(
    "href",
    "/texas/potter/monetary-policy",
  );
  await expect(dialog.getByText(/Some county data desks could not be checked/)).toBeVisible();
});

test("a typed choice preserves the edition for a vague publishing request", async ({ page }) => {
  await page.goto("/");
  const dialog = await openFetch(page);
  await ask(page, "How do I put something in the paper in Randall County, Texas?");
  await expect(dialog.getByRole("button", { name: "Send a story or news tip" })).toBeVisible();
  await ask(page, "the second one please");
  await expect(page).toHaveURL(/\/texas\/randall\/classifieds$/);
});

test("edition search can find an official record and a first-party column by words inside its text", async ({
  page,
}) => {
  const item = {
    title: "Aquifer hearing",
    url: "https://example.org/aquifer",
    category: "hearing",
    countyFips: ["48375"],
    sourceName: "County Clerk",
  };
  await page.route("**/texas/potter/public-notices?**", (r) =>
    r.fulfill({
      json: {
        county: { fips: "48375", state: "texas", county: "potter" },
        sources: [],
        items: [item],
        meta: { status: "current", rollout: "texas", hasMore: false, totalAvailable: 1 },
      },
    }),
  );
  await page.route("**/v1/pages/**", (r) => r.fulfill({ json: { sections: { general: { items: [] } } } }));
  const dialog = await openFetch(page);
  await ask(page, "Search the site for aquifer");
  await expect(dialog.getByRole("link", { name: "Aquifer hearing" })).toHaveAttribute(
    "href",
    "https://example.org/aquifer",
  );
  await expect(dialog.getByRole("link", { name: "The Data Centers and the Rest of Us" })).toBeVisible();
  await expect(
    dialog
      .locator("li")
      .filter({ has: page.getByRole("link", { name: "The Data Centers and the Rest of Us" }) })
      .getByText(/electric bill and your aquifer/),
  ).toBeVisible();
});

for (const start of ["/", "/texas/potter"]) {
  test(`a city forecast shows both counties before narrowing from ${start}`, async ({ page }) => {
    await page.route("**/v1/counties/texas/*/weather", (route) => {
      const isPotter = route.request().url().includes("/potter/");
      return route.fulfill({
        json: {
          county: { fips: isPotter ? "48375" : "48381" },
          location: { timeZone: "America/Chicago" },
          currentObservation: { temperature: { value: isPotter ? 51 : 54 }, textDescription: "Clear" },
          forecast: [],
          hourly: [],
          alerts: [],
          warnings: [],
          zones: {},
          meta: { cacheTtlSeconds: 60, alertsCacheTtlSeconds: 60 },
        },
      });
    });
    await page.goto(start);
    const dialog = await openFetch(page);
    await ask(page, start === "/" ? "What’s the weather in the Amarillo area, Texas?" : "Amarillo weather");
    const answers = dialog.locator(".fetch-answer");
    await expect(answers).toHaveCount(2);
    await expect(answers.filter({ hasText: "Potter County" })).toContainText("51°F · Clear");
    await expect(answers.filter({ hasText: "Randall County" })).toContainText("54°F · Clear");
    if (start === "/") await ask(page, "just Randall County please");
    else await dialog.getByRole("button", { name: "Randall County, TX" }).click();
    await expect(answers).toHaveCount(1);
    await expect(answers).toContainText("54°F · Clear");
    await ask(page, "Show me local news");
    await expect(answers.locator("small").first()).toHaveText("Randall County, TX");
  });
}

test("Dallas geography includes all five county parts and an explicit county overrides the city", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = await openFetch(page);
  await ask(page, "Open classifieds in Dallas, TX");
  const areas = ["Collin", "Dallas", "Denton", "Kaufman", "Rockwall"];
  for (const county of areas)
    await expect(
      dialog.getByRole("button", { name: "Open Classifieds · " + county + " County" }),
    ).toBeVisible();
  await ask(page, "Open classifieds in Dallas County, TX");
  await expect(page).toHaveURL(/\/texas\/dallas\/classifieds$/);
});

test("separate cities sharing a name can be narrowed by state before looking up their county data", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = await openFetch(page);
  await ask(page, "What's the GDP of Kansas City in 2020?");
  await expect(dialog.getByRole("button", { name: "Kansas City, KS" })).toBeVisible();
  await ask(page, "Missouri");
  await expect(dialog.getByRole("heading", { name: "Kansas City, MO" })).toBeVisible();
  await expect(dialog.locator(".fetch-answer")).toHaveCount(4);
  await expect(dialog.getByRole("button", { name: "Wyandotte County, KS" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Platte County, MO" }).click();
  await expect(dialog.getByRole("link", { name: "Open county economic data" })).toHaveAttribute(
    "href",
    "/missouri/platte/economic-data",
  );
});

test("multi-county GDP keeps the requested year and another county’s outage isolated", async ({ page }) => {
  await page.route("**/v1/counties/texas/potter/economic-data", (route) =>
    route.fulfill({
      json: {
        county: { fips: "48375" },
        metrics: [
          {
            key: "gross-domestic-product",
            valueKind: "currency-thousands",
            latest: { date: "2024-01-01", value: 20000 },
            observations: [{ date: "2020-01-01", value: 12000 }],
            source: "BEA",
            seriesId: "GDPALL48375",
            seriesUrl: "https://fred.stlouisfed.org/series/GDPALL48375",
          },
        ],
      },
    }),
  );
  await page.route("**/v1/counties/texas/randall/economic-data", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  const dialog = await openFetch(page);
  await ask(page, "What was the GDP of Amarillo, Texas in 2020?");
  await expect(dialog.locator(".fetch-answer").filter({ hasText: "Potter County" })).toContainText("in 2020");
  await expect(dialog.locator(".fetch-answer").filter({ hasText: "Randall County" })).toContainText(
    "couldn’t reach",
  );
});

test("a city topic search checks each county feed and retains the subject when narrowed", async ({
  page,
}) => {
  await page.route("**/v1/pages/counties/georgia/*?**", (route) => {
    const county = new URL(route.request().url()).pathname.split("/").pop()!;
    return route.fulfill({
      json: {
        scope: { places: ["Atlanta"], trustedHosts: ["example.org"] },
        sections: {
          localNews: { items: [report(county, `Atlanta library opens in ${county}`, "2026-11-19")] },
        },
      },
    });
  });
  const dialog = await openFetch(page);
  await ask(page, "Find articles about libraries in Atlanta, Georgia");
  for (const county of ["dekalb", "fulton"])
    await expect(dialog.getByRole("link", { name: "Atlanta library opens in " + county })).toBeVisible();
  await dialog.getByRole("button", { name: "Fulton County, GA" }).click();
  await expect(dialog.getByRole("link", { name: "Atlanta library opens in fulton" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: /dekalb/ })).toHaveCount(0);
});

test("a typed city and state preserve the pending desk, and New York City has five county editions", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = await openFetch(page);
  await ask(page, "Show me the weather in Kansas City");
  await ask(page, "Kansas City, MO");
  await expect(dialog.getByRole("heading", { name: "County weather" })).toHaveCount(4);
  await ask(page, "New York City classifieds");
  for (const name of ["Bronx", "Kings", "New York", "Queens", "Richmond"])
    await expect(
      dialog.getByRole("button", { name: "Open Classifieds · " + name + " County" }),
    ).toBeVisible();
});

test("a single-county city resolves from another edition and keeps the county for a follow-up", async ({
  page,
}) => {
  const dialog = await openFetch(page);
  await ask(page, "Weather in Boise, Idaho?");
  await expect(dialog.getByRole("link", { name: "Open full weather report" })).toHaveAttribute(
    "href",
    "/idaho/ada/weather",
  );
  await ask(page, "Show me local news");
  await expect(dialog.getByRole("region", { name: "Ada County, ID" })).toBeVisible();
  await ask(page, "What was the GDP of Boise City, Oklahoma?");
  await expect(dialog.getByRole("link", { name: "Open county economic data" })).toHaveAttribute(
    "href",
    "/oklahoma/cimarron/economic-data",
  );
});

test("a misspelled city needs confirmation and an unknown city cannot become a statewide figure", async ({
  page,
}) => {
  const dialog = await openFetch(page);
  await ask(page, "What was the GDP of Seatle, Washington in 2020?");
  await expect(dialog.getByText(/couldn’t match “Seatle, Washington” exactly/)).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Open county economic data" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Seattle, WA", exact: true }).click();
  await expect(dialog.getByRole("link", { name: "Open county economic data" })).toHaveAttribute(
    "href",
    "/washington/king/economic-data",
  );
  await ask(page, "What is the population of Xylophone, Iowa?");
  await expect(dialog.getByText(/I couldn’t match that place/)).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Compare states" })).toHaveCount(0);
  await ask(page, "What is the GDP of Xylophone?");
  await expect(dialog.getByText(/I couldn’t match that place/)).toBeVisible();
});

test("same-name towns keep the original desk when the reader supplies just the state", async ({ page }) => {
  await page.goto("/");
  const dialog = await openFetch(page);
  await ask(page, "Weather in Springfield?");
  await expect(dialog.getByRole("button", { name: "Springfield, IL", exact: true })).toBeVisible();
  await ask(page, "Illinois");
  await expect(dialog.getByRole("link", { name: "Open full weather report" })).toHaveAttribute(
    "href",
    "/illinois/sangamon/weather",
  );
});

test("a topic that shares a town name stays a search in the current edition", async ({ page }) => {
  const dialog = await openFetch(page);
  await ask(page, "Search the site for Independence");
  await expect(dialog.getByRole("region", { name: "Potter County, TX" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Which place did you mean?" })).toHaveCount(0);
});

test("asking which county covers a city answers inline before offering its edition", async ({ page }) => {
  await page.goto("/");
  const dialog = await openFetch(page);
  await ask(page, "What county is Seattle in?");
  await expect(dialog.getByText("Seattle, Washington is covered by the King County edition.")).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await dialog.getByRole("button", { name: "Open County Home · King County" }).click();
  await expect(page).toHaveURL(/\/washington\/king$/);
});

test("a specific featured measure can be found for both counties without scanning every domain", async ({
  page,
}) => {
  const domain = { slug: "housing", label: "Housing", metricKeys: ["median-gross-rent"] };
  const metric = { key: "median-gross-rent", label: "Median gross rent", domain: "housing" };
  const detailRequests: string[] = [];
  await page.route("**/v1/counties/texas/*/atlas", (r) => {
    const slug = new URL(r.request().url()).pathname.split("/")[4];
    const county = { slug, displayName: slug + " County", fips: slug === "potter" ? "48375" : "48381" };
    return r.fulfill({
      json: {
        county,
        domains: [{ domain, available: true, featuredMetrics: [metric] }],
        meta: { version: "1", cacheTtlSeconds: 300 },
      },
    });
  });
  await page.route("**/v1/counties/texas/*/atlas/*", (r) => {
    detailRequests.push(r.request().url());
    return r.abort();
  });
  await page.goto("/");
  const dialog = await openFetch(page);
  await ask(page, "Search the site for gross rent in Amarillo, Texas");
  await expect(dialog.getByRole("combobox", { name: "Explore a measure" })).toHaveCount(2);
  expect(detailRequests).toHaveLength(0);
  await dialog
    .getByRole("combobox", { name: "Explore a measure" })
    .last()
    .selectOption({ label: "Median gross rent" });
  await expect
    .poll(() => detailRequests.some((url) => url.endsWith("/texas/randall/atlas/housing")))
    .toBe(true);
});

test("GDP follow-ups keep the year, measure and counties through a move or a missing observation", async ({
  page,
}) => {
  const countyFips: Record<string, string> = { potter: "48375", randall: "48381", king: "53033" };
  await page.route("**/v1/counties/*/*/economic-data", (route) => {
    const fips = countyFips[new URL(route.request().url()).pathname.split("/")[4]];
    return route.fulfill({
      json: {
        county: { fips },
        metrics: [
          {
            key: "real-gross-domestic-product",
            valueKind: "currency-thousands",
            latest: { date: "2024-01-01", value: 3000 },
            observations: [{ date: "2020-01-01", value: 2000 }],
            seriesId: "TEST" + fips,
            seriesUrl: "https://example.org/" + fips,
            source: "BEA",
          },
        ],
      },
    });
  });
  await page.goto("/");
  const dialog = await openFetch(page);
  await ask(page, "How much was real GDP in Amarillo, Texas in 2024?");
  await ask(page, "And in 2020?");
  await expect(dialog.getByText(/real GDP was .* in 2020/)).toHaveCount(2);
  await ask(page, "What about Seattle, Washington?");
  await expect(dialog.getByText(/King County’s real GDP was .* in 2020/)).toBeVisible();
  await ask(page, "And Amarillo, Texas in 2010?");
  await expect(dialog.getByText(/no published observation for 2010/)).toHaveCount(2);
  await ask(page, "Just Randall");
  await expect(dialog.getByText(/no published observation for 2010/)).toHaveCount(1);
  await ask(page, "And the latest figure?");
  await expect(dialog.getByText(/Randall County’s real GDP was .* in 2024/)).toBeVisible();
  await ask(page, "Both counties again?");
  await expect(dialog.getByText(/real GDP was .* in 2024/)).toHaveCount(2);
  await dialog.getByRole("button", { name: "Start over" }).click();
  await ask(page, "And in 2020?");
  await expect(dialog.getByRole("heading", { name: "County economic data" })).toHaveCount(0);
});

test("briefing follow-ups keep the subject and publication day when switching county", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-20T19:00:00Z"));
  await page.route("**/v1/pages/counties/*/*?**", (route) => {
    const slug = new URL(route.request().url()).pathname.split("/").pop()!;
    const town = slug === "ada" ? "Boise" : "Amarillo";
    return route.fulfill({
      json: {
        scope: { places: [town], trustedHosts: ["example.org"] },
        sections: {
          localNews: {
            items: [
              report(slug + "1", town + " library plans book fair", "2026-11-19T18:00:00Z"),
              report(slug + "2", town + " library hosts poets", "2026-11-20T18:00:00Z"),
              report(slug + "3", town + " bus fares change", "2026-11-19T18:00:00Z"),
            ],
          },
        },
      },
    });
  });
  const dialog = await openFetch(page);
  await ask(page, "Find library articles today in Potter County, Texas");
  await expect(dialog.getByRole("link", { name: "Amarillo library hosts poets" })).toBeVisible();
  await ask(page, "Yesterday?");
  await expect(dialog.getByRole("link", { name: "Amarillo library plans book fair" })).toBeVisible();
  await ask(page, "What about Boise, Idaho?");
  await expect(dialog.getByRole("link", { name: "Boise library plans book fair" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: /hosts poets|fares change/ })).toHaveCount(0);
  await ask(page, "And in my county?");
  await expect(dialog.getByRole("link", { name: "Amarillo library plans book fair" })).toBeVisible();
  await ask(page, "Weather in my county");
  await expect(dialog.getByRole("link", { name: "Open full weather report" })).toHaveAttribute(
    "href",
    "/texas/potter/weather",
  );
});

test("forecast follow-ups use the county calendar across a daylight-saving change", async ({ page }) => {
  // 11:30 p.m. in Amarillo the night before the spring clock change.
  await page.clock.setFixedTime(new Date("2026-03-08T05:30:00Z"));
  const forecast = [
    ["Tonight", "2026-03-07T18:00:00-06:00", "2026-03-08T06:00:00-05:00", "Clear skies"],
    ["Sunday", "2026-03-08T06:00:00-05:00", "2026-03-08T18:00:00-05:00", "Light showers"],
    ["Monday", "2026-03-09T06:00:00-05:00", "2026-03-09T18:00:00-05:00", "Partly cloudy"],
  ].map(([name, startTime, endTime, shortForecast]) => ({ name, startTime, endTime, shortForecast }));
  await page.route("**/v1/counties/texas/potter/weather", (route) =>
    route.fulfill({
      json: {
        county: { fips: "48375" },
        location: { timeZone: "America/Chicago" },
        forecast,
        hourly: [],
        alerts: [],
        zones: {},
        warnings: [],
        meta: { cacheTtlSeconds: 60, alertsCacheTtlSeconds: 60 },
      },
    }),
  );
  await page.goto("/");
  const dialog = await openFetch(page);
  await ask(page, "Forecast in Potter County, Texas");
  await dialog.getByRole("button", { name: "Tomorrow’s forecast" }).click();
  await expect(dialog.getByText("Sunday — Light showers")).toBeVisible();
  await expect(dialog.getByText(/Monday —|Tonight —/)).toHaveCount(0);
  await ask(page, "And today?");
  await expect(dialog.getByText("Tonight — Clear skies")).toBeVisible();
  await expect(dialog.getByText(/Monday —|Sunday —/)).toHaveCount(0);
  await ask(page, "Show me local news");
  await expect(dialog.getByRole("region", { name: "Potter County, TX" })).toBeVisible();
});

test("qualified jurisdictions, state abbreviations and county codes keep their geographic meaning", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = await openFetch(page);
  for (const [question, path] of [
    ["Weather in the Municipality of Anchorage?", "/alaska/anchorage/weather"],
    ["Weather in Kalaupapa, Hawaii?", "/hawaii/kalawao/weather"],
    ["Weather in Toano, Virginia?", "/virginia/james-city/weather"],
    ["Weather in Norge, Oklahoma?", "/oklahoma/grady/weather"],
    ["Weather in Barrington, Rhode Island?", "/rhode-island/bristol/weather"],
    ["Weather in Andover, Connecticut?", "/connecticut/tolland/weather"],
    ["Weather in Newport News city, VA?", "/virginia/newport-news/weather"],
    ["weather in washington county, or?", "/oregon/washington/weather"],
    ["WEATHER IN POTTER COUNTY, TX?", "/texas/potter/weather"],
    ["Weather in Washington, D.C.?", "/district-of-columbia/district-of-columbia/weather"],
    ["Weather for county FIPS 01001?", "/alabama/autauga/weather"],
  ]) {
    await ask(page, question);
    await expect(dialog.getByRole("link", { name: "Open full weather report" })).toHaveAttribute(
      "href",
      path,
    );
  }
  await ask(page, "Weather for county FIPS 01001 in California?");
  await expect(dialog.getByText(/couldn’t match that place/)).toBeVisible();
  await ask(page, "FIPS 01001");
  await expect(dialog.getByRole("link", { name: "Open full weather report" })).toHaveAttribute(
    "href",
    "/alabama/autauga/weather",
  );
  await ask(page, "Weather in 02110?");
  await expect(dialog.getByText(/city and state for a ZIP code/)).toBeVisible();
});

test("the District can answer as a state or provide a county-only desk without another place prompt", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = await openFetch(page);
  await ask(page, "Compare the population of Washington, D.C. with Washington state");
  await expect(dialog.locator("dt")).toContainText(["District of Columbia", "Washington"]);
  await ask(page, "Find headlines in the District of Columbia");
  await expect(dialog.locator(".fetch-answer > small")).toHaveText("District of Columbia");
  await ask(page, "What is the weather in D.C.?");
  await expect(dialog.getByRole("link", { name: "Open full weather report" })).toHaveAttribute(
    "href",
    "/district-of-columbia/district-of-columbia/weather",
  );
});

test("historic Connecticut county population cites the decennial count and respects the requested year", async ({
  page,
}) => {
  const domain = { slug: "demographics", label: "Demographics", metricKeys: [], sourceIds: [] };
  const county = { fips: "09003" };
  const meta = { cacheTtlSeconds: 60 };
  await page.route("**/v1/counties/connecticut/hartford/atlas", (r) =>
    r.fulfill({
      json: { county, domains: [{ domain, available: false, featuredMetrics: [] }], meta },
    }),
  );
  await page.route("**/v1/counties/connecticut/hartford/atlas/demographics", (r) =>
    r.fulfill({
      json: { county, domain, metrics: [], meta },
    }),
  );
  const d = await openFetch(page);
  await ask(page, "How many people live in Hartford County, Connecticut?");
  await expect(d.locator(".fetch-answer")).toContainText(
    "899,498 people · 2020 Census · historical county boundaries",
  );
  await expect(d.getByRole("link", { name: /U.S. Census Bureau/ })).toHaveAttribute(
    "href",
    /county_2020_tab20_ct\.html$/,
  );
  await ask(page, "And in 2024?");
  await expect(d.locator(".fetch-answer")).toContainText("No observation published for 2024");
  await expect(d.locator(".fetch-answer")).not.toContainText("899,498");
  await page.route("**/v1/counties/connecticut/hartford/atlas/housing", (r) =>
    r.fulfill({
      json: { county, domain: { slug: "housing", label: "Housing" }, metrics: [], meta },
    }),
  );
  await ask(page, "How much is rent in Hartford County, Connecticut?");
  await expect(d.locator(".fetch-answer")).toContainText(
    "no published figures on this desk for Hartford County",
  );
  await d.getByRole("combobox", { name: "Explore a data desk" }).selectOption({ label: "Demographics" });
  await d.getByRole("combobox", { name: "Explore a measure" }).selectOption({ label: "Population" });
  await expect(d.locator(".fetch-answer")).toContainText("899,498 people · 2020 Census");
});
