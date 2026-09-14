import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const baseURL = process.env.COUNTY_POST_URL || "http://127.0.0.1:4186";
const outputDirectory = "test-results/panhandle-review";
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
const result = { baseURL, videos: [], partners: [], errors: [], failedRequests: [] };
page.on("pageerror", (error) => result.errors.push(error.message));
page.on("requestfailed", (request) => {
  if (/vimeo/.test(request.url())) result.failedRequests.push({ url: request.url(), error: request.failure()?.errorText });
});

try {
  await page.goto(`${baseURL}/texas`, { waitUntil: "domcontentloaded" });
  const carousel = page.locator(".ad-slot-inline").first();
  await carousel.waitFor({ state: "attached" });
  if (await carousel.locator(".video-ad").count() !== 3) throw new Error("Expected three Texas video creatives");
  if (await page.locator("iframe[src*='player.vimeo.com']").count()) throw new Error("Video player loaded before a reader clicked");

  for (const id of ["quanah-parker", "georgia-okeeffe", "goodnights"]) {
    const card = carousel.locator(`[data-ad-id='panhandle-legends-${id}']`);
    await card.scrollIntoViewIfNeeded();
    await card.locator("img").evaluate((image) => image.decode());
    await card.getByRole("button", { name: /^Play Panhandle Legends:/ }).click();
    const player = card.frameLocator("iframe");
    const video = player.locator("video").first();
    const connectionBlock = player.getByText("We couldn't verify the security of your connection.", { exact: true });
    await video.or(connectionBlock).first().waitFor({ state: "attached", timeout: 30000 });
    if (await connectionBlock.count()) {
      result.videos.push({ id, iframe: await card.locator("iframe").getAttribute("src"), thumbnailLoaded: true,
        playback: "Vimeo blocked this automated browser's connection; full playback could not be verified",
        fallback: await card.getByRole("link", { name: "Watch on Vimeo" }).getAttribute("href") });
      await page.screenshot({ path: `${outputDirectory}/${id}.png` });
      await card.getByRole("button", { name: "Close video", exact: true }).click();
      continue;
    }
    // Verify actual playable media, beyond a successful iframe response.
    await video.evaluate((element) => new Promise((resolve, reject) => {
      if (element.readyState >= 1 && element.duration > 0) return resolve();
      const timer = setTimeout(() => reject(new Error("Video metadata did not load")), 20000);
      element.addEventListener("loadedmetadata", () => { clearTimeout(timer); resolve(); }, { once: true });
    }));
    const media = await video.evaluate((element) => ({ duration: element.duration, readyState: element.readyState, paused: element.paused, error: element.error?.message || null }));
    result.videos.push({ id, title: await card.locator(".video-ad-title").innerText(), iframe: await card.locator("iframe").getAttribute("src"), thumbnailLoaded: true, ...media });
    await page.screenshot({ path: `${outputDirectory}/${id}.png` });
    await card.getByRole("button", { name: "Close video", exact: true }).click();
  }

  for (const path of ["/partners", "/texas/harris/partners", "/texas/randall/partners", "/arkansas/polk/partners"]) {
    await page.goto(`${baseURL}${path}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("main").getByRole("heading", { name: /Partners/, level: 1 }).waitFor();
    const panhandle = await page.getByRole("heading", { name: "Panhandle Legends", exact: true }).count();
    const gear = await page.getByRole("heading", { name: "Guerrilla Gear", exact: true }).count();
    const expected = path.startsWith("/arkansas") ? 0 : 1;
    if (panhandle !== expected || gear !== expected) throw new Error(`Partner targeting mismatch at ${path}`);
    if (await page.getByRole("heading", { name: /Pasture Exchange|PestCon/ }).count()) throw new Error(`Removed advertiser present at ${path}`);
    result.partners.push({ path, panhandle, gear });
  }

  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Bookmark nationwide homepage" }).waitFor();
  result.nationalBookmark = true;
  const cdp = await page.context().newCDPSession(page);
  result.installability = await cdp.send("Page.getInstallabilityErrors");
  result.manifest = await cdp.send("Page.getAppManifest").then(({ url, errors }) => ({ url, errors }));
  await writeFile(`${outputDirectory}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  result.failure = error.message;
  result.frames = await Promise.all(page.frames().map(async (frame) => ({
    url: frame.url(),
    text: frame.url().includes("vimeo") ? await frame.locator("body").innerText().catch(() => "Unavailable") : undefined,
  })));
  await page.screenshot({ path: `${outputDirectory}/failure.png` });
  await writeFile(`${outputDirectory}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
