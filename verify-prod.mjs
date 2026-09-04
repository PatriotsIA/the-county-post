import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
await page.goto("https://thecountypost.com/texas/potter", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(9000);

const cards = page.locator(".feed-card:not(.feed-ad-card)");
const n = await cards.count();
console.log("story cards:", n);
for (let i = 0; i < Math.min(n, 6); i++) {
  const c = cards.nth(i);
  const pub = (await c.locator(".feed-publisher").textContent().catch(() => "(none)"))?.trim();
  const mark = (await c.locator(".feed-source-mark").textContent().catch(() => "(has image)"))?.trim();
  const link = await c.locator(".feed-title").getAttribute("href").catch(() => "");
  console.log(`  [${i}] publisher=${JSON.stringify(pub)} thumb=${JSON.stringify(mark)}`);
  console.log(`       link=${String(link).slice(0, 78)}`);
}
const body = (await page.locator("main").textContent()) ?? "";
console.log("\ncontains 'BingNews':", body.includes("BingNews"));
console.log("contains 'local news OR':", body.includes("local news OR"));
await page.screenshot({ path: "/tmp/claude-1000/-home-telephoneheater/b641f007-1a39-4e51-be34-f256aaf88df2/scratchpad/prod-cards.png", clip: { x: 0, y: 380, width: 1280, height: 620 } });
await browser.close();
