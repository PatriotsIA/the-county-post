// Compare each catalog entry with its rendered County Data card and a typed Fetch answer.
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";

const args = process.argv.slice(2);
const shard = args
  .find((arg) => arg.startsWith("--shard="))
  ?.slice(8)
  .split("/")
  .map(Number);
if (shard && (shard.length !== 2 || !shard.every(Number.isInteger) || shard[0] < 1 || shard[0] > shard[1]))
  throw Error("Use --shard=1/16 through --shard=16/16.");
const ids = args.filter((arg) => /^\d{5}$/.test(arg));
if (args.some((arg) => !/^\d{5}$|^--all$|^--shard=\d+\/\d+$/.test(arg)))
  throw Error("Expected county FIPS codes, --all, or --shard=N/M.");
process.env.VITE_LOCAL_PUBLISHED_NEWS = "true";
process.env.VITE_LOCAL_PUBLISHED_ATLAS = "true";
const server = await createServer({
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, hmr: false },
  cacheDir: "node_modules/.cache/fetch-audit-vite",
});
let browser;
let count = 0,
  desks = 0;
try {
  await server.listen();
  const base = "http://127.0.0.1:" + server.httpServer.address().port;
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (process.env.CI ? undefined : "/usr/bin/chromium"),
  });
  const page = await browser.newPage();
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (
      url.origin !== base ||
      url.pathname.startsWith("/v1/") ||
      ["image", "font", "media"].includes(route.request().resourceType())
    )
      return route.abort();
    return route.continue();
  });
  await page.goto(base + "/robots.txt");
  const directory = await page.evaluate(async () =>
    (await import("/src/data/counties.ts")).counties.map((c) => ({
      path: "/" + c.state.slug + "/" + c.slug,
      fips: c.fips,
      display: c.displayName + ", " + c.state.abbr,
    })),
  );
  const wanted = ids.length ? ids : ["48375", "09001", "02220"];
  let counties =
    args.includes("--all") || shard ? directory : directory.filter((c) => wanted.includes(c.fips));
  if (ids.length) assert.equal(counties.length, new Set(ids).size, "Unknown county FIPS");
  if (shard) counties = counties.filter((_, i) => i % shard[1] === shard[0] - 1);
  assert.ok(counties.length, "No counties selected");
  for (const county of counties) {
    const overview = await page.request.get(base + "/__published-atlas/v1/counties" + county.path + "/atlas");
    assert.ok(overview.ok(), county.path + " overview HTTP " + overview.status());
    const doc = await overview.json();
    assert.equal(doc.county.fips, county.fips);
    const domains = new Set([...doc.domains.map((item) => item.domain.slug), "public-safety"]);
    for (const domain of domains) {
      const path = county.path + "/data/" + domain;
      await page.goto(base + path, { waitUntil: "domcontentloaded" });
      await page.locator("#atlas-metrics-heading").waitFor();
      const { metrics, deskLabel } = await page.evaluate(
        async ({ path, domain }) => {
          const [, state, slug] = path.split("/");
          const county = (await import("/src/data/counties.ts")).getCounty(state, slug);
          const doc = await (await import("/src/lib/fetch-atlas.ts")).fetchGuideAtlasDomain(county, domain);
          if (doc.county.fips !== county.fips || doc.domain.slug !== domain)
            throw Error("Wrong county or desk");
          return {
            metrics: doc.metrics.map((m) => ({ label: m.label, key: m.key, unit: m.unit })),
            deskLabel: doc.domain.label,
          };
        },
        { path, domain },
      );
      const cards = page.locator(".atlas-metric-card");
      await expect(cards).toHaveCount(metrics.length);
      desks++;
      if (!metrics.length) continue;
      await page.getByRole("button", { name: "Ask Fetch" }).click();
      const dialog = page.getByRole("dialog", { name: "Ask Fetch" });
      for (const metric of metrics) {
        const target = "atlas-" + metric.key;
        const card = page.locator("[id=" + JSON.stringify(target) + "]");
        await expect(card.getByRole("heading", { name: metric.label, exact: true })).toBeVisible();
        const year = (await card.locator(".atlas-year").textContent()).replace(/^Latest available:\s*/, "");
        const value = await card.locator(".atlas-metric-value").innerText();
        const vintage = await card.getByText("Vintage", { exact: true }).locator("+ dd").innerText();
        const question = "What is “" + metric.label + "” on the " + deskLabel + " desk?";
        const input = dialog.getByRole("textbox", { name: "Ask Fetch a question" });
        await input.fill(question);
        await input.press("Enter");
        const answer = dialog.getByRole("region", { name: county.display, exact: true });
        const link = answer.locator("[data-fetch-target=" + JSON.stringify(target) + "]");
        await expect(link, county.path + " · " + question).toHaveAttribute("href", path);
        await expect(answer).toContainText(metric.label + " · " + value + " · " + vintage);
        await expect(answer).toContainText("Latest available · " + year);
        if (metric.unit) {
          const unit = await card.getByText("Unit", { exact: true }).locator("+ dd").innerText();
          await expect(answer).toContainText("Unit · " + unit);
        }
        const source = await card.locator(".atlas-provenance a").getAttribute("href");
        const publisher = await card.locator("header .kicker").textContent();
        await expect(answer.getByRole("link", { name: publisher, exact: true })).toHaveAttribute(
          "href",
          source,
        );
        count++;
      }
    }
    console.log(county.fips, county.display, "complete;", count, "measures checked so far");
  }
  console.log(counties.length, "counties,", desks, "desks,", count, "measure answers and targets verified.");
} finally {
  await browser?.close();
  await server.close();
}
