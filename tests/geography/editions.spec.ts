import { expect, test } from "@playwright/test";
import { counties } from "../../src/data/counties";
import { states } from "../../src/data/states";
import places from "../../src/data/fetch-city-counties.json" with { type: "json" };

import crime from "../../src/data/county-crime.json" with { type: "json" };

const editions = counties.map((c) => ({
  path: "/" + c.state.slug + "/" + c.slug,
  label: c.displayName + ", " + c.state.abbr,
  fips: c.fips,
  state: c.state.slug,
}));

test.describe.configure({ mode: "parallel" });

test("every published edition has its own route and five-digit county identifier", () => {
  expect(states).toHaveLength(51);
  expect(editions).toHaveLength(3143);
  expect(new Set(editions.map((c) => c.path)).size).toBe(editions.length);
  expect(new Set(editions.map((c) => c.fips)).size).toBe(editions.length);
  expect(editions.filter((c) => !/^\d{5}$/.test(c.fips))).toEqual([]);
  const mapped = new Set(
    Object.values(places)
      .flat()
      .flatMap((group) => group.split(" ")),
  );
  expect(mapped).toEqual(new Set(editions.map((c) => c.fips)));
});

test("every published edition has a sourced county crime record or an explicit gap", () => {
  expect(new Set(Object.keys(crime.counties))).toEqual(new Set(editions.map(c => c.fips)));
  expect(new Set(Object.keys(crime.states))).toEqual(new Set(states.map(s => s.abbr)));
  const errors: string[] = [];
  for (const [fips, row] of Object.entries(crime.counties)) {
    if (row === null) continue;
    if (!["agency", "returnA", "chr", "ct"].includes(row.source) || row.year > 2025 ||
        !Number.isFinite(row.violent) || row.violent < 0 ||
        ("property" in row && (!Number.isFinite(row.property) || row.property < 0)) ||
        ("coverage" in row && (row.coverage <= 0 || row.coverage > 100))) errors.push(fips);
  }
  expect(errors).toEqual([]);
  expect(Object.values(crime.states).every(pair => pair.length === 2 && pair.every(v => Number.isFinite(v) && v >= 0))).toBe(true);
});

for (const state of states) {
  const inState = editions.filter((c) => c.state === state.slug);
  if (!inState.length) throw new Error("Empty edition directory for " + state.name);
  for (let start = 0; start < inState.length; start += 32) {
    const local = inState.slice(start, start + 32);
    test(
      state.name + " editions from " + local[0].label + " through " + local.at(-1)!.label,
      async ({ page }) => {
        test.setTimeout(60_000 + 2_500 * local.length);
        await page.route("**/*", (r) =>
          ["127.0.0.1", "localhost"].includes(new URL(r.request().url()).hostname) &&
          !["image", "font", "media"].includes(r.request().resourceType())
            ? r.continue()
            : r.abort(),
        );
        // Serve identifiable observations by requested endpoint. The reader's
        // question and the fixture never share a county lookup.
        await page.addInitScript((editions) => {
          const byPath = new Map(editions.map((c) => ["/v1/counties" + c.path + "/weather", c]));
          const original = window.fetch.bind(window);
          window.fetch = async (resource, init) => {
            const url = new URL(resource instanceof Request ? resource.url : resource, location.href);
            const county = byPath.get(url.pathname);
            if (county)
              return Response.json({
                county: { fips: county.fips },
                location: { timeZone: "UTC" },
                currentObservation: {
                  temperature: { value: 42 },
                  textDescription: "Observation " + county.fips,
                },
                zones: {},
                forecast: [],
                hourly: [],
                alerts: [],
                warnings: [],
                meta: {
                  cacheTtlSeconds: 60,
                  alertsCacheTtlSeconds: 60,
                  source: { links: { points: "https://api.weather.gov/" } },
                },
              });
            if (url.pathname.startsWith("/v1/pages/")) return Response.json({ sections: {}, scope: {} });
            if (url.pathname.startsWith("/v1/")) return new Response(null, { status: 404 });
            return original(resource, init);
          };
        }, editions);
        await page.goto("/" + state.slug);
        await page.getByRole("button", { name: "Ask Fetch" }).click();
        await expect(page.locator(".fetch-edition")).toHaveText(state.name);
        const input = page.getByRole("textbox", { name: "Ask Fetch a question" });
        await input.fill("What is the population of " + state.name + "?");
        await input.press("Enter");
        await expect(page.locator(".fetch-content dt")).toContainText([state.name]);

        // Exercise the same router and mounted launcher used by an edition link.
        // Running the loop inside the browser avoids a protocol round trip per render.
        const offset = Math.floor(editions.length / 2);
        const firstEdition = editions.indexOf(local[0]);
        const pairs = local.map((home, i) => ({
          home,
          away: editions[(firstEdition + i + offset) % editions.length],
        }));
        expect(pairs.every(({ home, away }) => home.state !== away.state)).toBe(true);
        await page.evaluate(async (pairs) => {
          async function until<T>(read: () => T | null | undefined | false, message: string): Promise<T> {
            const deadline = performance.now() + 8000;
            do {
              const value = read();
              if (value) return value;
              await new Promise((resolve) => setTimeout(resolve, 10));
            } while (performance.now() < deadline);
            throw new Error(
              location.pathname +
                " " +
                message +
                " " +
                document.querySelector(".fetch-content")?.textContent?.slice(0, 300),
            );
          }
          const launcher = () => document.querySelector<HTMLButtonElement>(".fetch-launcher");
          const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
          const weather = (c: (typeof pairs)[number]["home"]) =>
            until(() => {
              const answer = document.querySelector(".fetch-answer");
              return (
                answer?.textContent?.includes("Observation " + c.fips) &&
                answer.querySelector('a[href="' + c.path + '/weather"]')
              );
            }, "expected weather for " + c.label);
          for (const { home, away } of pairs) {
            const previous = launcher();
            history.replaceState(history.state, "", home.path);
            dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
            const open = await until(() => launcher() !== previous && launcher(), "missing county launcher");
            open.click();
            await until(
              () => document.querySelector(".fetch-edition")?.textContent === home.label,
              "wrong county edition",
            );
            const button = Array.from(
              document.querySelectorAll<HTMLButtonElement>("#fetch-guide button"),
            ).find((b) => b.textContent === "Check the weather");
            if (!button) throw new Error(home.path + " missing weather shortcut");
            button.click();
            await weather(home);
            const input = document.querySelector<HTMLInputElement>(".fetch-form input")!;
            set.call(input, "Weather in " + away.label + "?");
            input.dispatchEvent(new Event("input", { bubbles: true }));
            await Promise.resolve();
            input.form!.requestSubmit();
            await weather(away);
          }
        }, pairs);
      },
    );
  }
}
