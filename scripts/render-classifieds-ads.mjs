// Draws The County Post Classifieds house ads from the Classifieds logo, in the
// masthead's navy and red, at the sizes the ad slots use: a 980×300 banner and
// a 300×300 square, rendered at twice that resolution. Run when the copy or the
// logo changes:  node scripts/render-classifieds-ads.mjs
// Needs Chromium (CHROMIUM_PATH, default /usr/bin/chromium) and ImageMagick.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const logo = `data:image/webp;base64,${readFileSync(resolve(root, "src/assets/county-post-classifieds-logo.webp")).toString("base64")}`;
const fonts = "https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Playfair+Display:wght@700&family=Roboto+Mono:wght@500;700&display=block";

const page = (width, height, body) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${fonts}">
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${width}px; height: ${height}px; }
  body { overflow: hidden; color: #fff; background: linear-gradient(120deg, #08264e, #123c73 60%, #174f93); }
  .frame { position: absolute; inset: 0; border: 4px solid #a8191d; }
  .kicker { font: 700 13px/1 "Roboto Mono", monospace; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(255,255,255,0.82); }
  .title { font: 700 58px/1 "Playfair Display", serif; letter-spacing: 0.08em; text-transform: uppercase; }
  .rule { width: 72px; height: 3px; background: #a8191d; }
  .line { font: 400 20px/1.35 "Libre Baskerville", serif; }
  .cta { display: inline-block; border: 2px solid #fff; padding: 10px 16px; background: #a8191d; font: 700 15px/1 "Roboto Mono", monospace; letter-spacing: 0.14em; text-transform: uppercase; white-space: nowrap; }
  .note { font: 500 11px/1 "Roboto Mono", monospace; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.78); }
</style></head><body><div class="frame"></div>${body}</body></html>`;

const banner = page(980, 300, `
  <div style="position:absolute; inset:0; display:grid; grid-template-columns:240px minmax(0, 1fr) auto; align-items:center; gap:24px; padding:0 34px 0 26px;">
    <img src="${logo}" alt="" style="width:240px; height:240px; object-fit:contain;">
    <div style="display:grid; gap:14px;">
      <p class="kicker">The County Post</p>
      <p class="title" style="font-size:50px;">Classifieds</p>
      <div class="rule"></div>
      <p class="line" style="font-size:18px;">Buy · Sell · Find it local — in every county</p>
    </div>
    <div style="display:grid; justify-items:center; gap:12px;">
      <span class="cta" style="font-size:14px;">Browse listings ›</span>
      <span class="note">Free personal listings</span>
    </div>
  </div>`);

const square = page(300, 300, `
  <div style="position:absolute; inset:0; display:grid; justify-items:center; align-content:center; gap:9px; padding:18px; text-align:center;">
    <img src="${logo}" alt="" style="width:104px; height:104px; object-fit:contain;">
    <p class="kicker" style="font-size:10px;">The County Post</p>
    <p class="title" style="font-size:32px;">Classifieds</p>
    <p class="line" style="font-size:13px;">Buy · Sell · Find it local</p>
    <span class="cta" style="font-size:11px; padding:7px 11px;">Browse listings ›</span>
    <span class="note" style="font-size:8px;">Free personal listings</span>
  </div>`);

const work = mkdtempSync(join(tmpdir(), "classifieds-ads-"));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });
try {
  for (const [name, html, width, height] of [["banner", banner, 980, 300], ["square", square, 300, 300]]) {
    const tab = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    await tab.setContent(html, { waitUntil: "networkidle" });
    await tab.evaluate(() => document.fonts.ready);
    const png = join(work, `${name}.png`);
    await tab.screenshot({ path: png });
    const out = resolve(root, `ad-assets/county-post-classifieds-${name}.webp`);
    execFileSync("magick", [png, "-quality", "90", out]);
    console.log(`wrote ${out}`);
    await tab.close();
  }
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
