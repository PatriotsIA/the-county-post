import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const base = process.argv[2] || "http://127.0.0.1:4187";
const out = "coverage/public-notices";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const checks = [];
const errors = [];
try {
  for (const width of [1280, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push({ message: error.message, stack: error.stack }));
    for (const [county, fips] of [["sabine", "48403"], ["bell", "48027"], ["harris", "48201"], ["potter", "48375"], ["jefferson", "48245"]]) {
      const pending = page.waitForResponse(response => response.url().includes(`/v1/counties/texas/${county}/public-notices`), { timeout: 30000 });
      await page.goto(`${base}/texas/${county}/public-notices`, { waitUntil: "domcontentloaded" });
      const response = await pending;
      assert.equal(response.status(), 200);
      const body = await response.json();
      assert.equal(body.county.fips, fips);
      assert(body.items.every(item => item.countyFips.includes(fips)));
      assert(body.sources.length >= 3);
      const expected = Math.min(12, body.items.length);
      await page.waitForFunction(count => document.querySelectorAll(".notice-card").length === count && !!document.querySelector(".notice-sources"), expected);
      assert.equal(await page.locator(".notice-card").count(), expected);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal(await page.locator(".public-notices [role=alert]").count(), 0);
      if (county === "sabine") await page.locator(".public-notices").screenshot({ path: `${out}/${base.startsWith("https") ? "production" : "local"}-${width}.png` });
      checks.push({ county, width, count: body.items.length, status: body.meta.status, sources: body.sources.length });
    }
    await page.goto(`${base}/florida/jefferson/public-notices`, { waitUntil: "domcontentloaded" });
    await page.getByText("Sources for Jefferson County, Florida are not connected yet.", { exact: false }).waitFor();
    assert.equal(await page.locator(".notice-card").count(), 0);
    checks.push({ county: "jefferson-florida", width, status: "not-yet-supported" });
    await context.close();
  }
  const unexpected = errors.filter(error => !error.message.includes("ResizeObserver loop") && !error.stack?.includes("_replaceScript"));
  assert.deepEqual(unexpected, []);
  const result = { base, checkedAt: new Date().toISOString(), checks, knownExternalErrors: errors };
  await writeFile(`${out}/${base.startsWith("https") ? "production" : "local"}-browser.json`, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ base, passed: checks.length, knownExternalErrors: errors.length, checks }));
} finally { await browser.close(); }
