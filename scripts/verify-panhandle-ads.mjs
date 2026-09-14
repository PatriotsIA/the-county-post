import { chromium } from "playwright";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseURL = process.env.COUNTY_POST_URL || "http://127.0.0.1:4186";
const checkPlayback = !process.argv.includes("--skip-playback");
// The complete https://vimeo.com/showcase/12112279 membership, verified 2026-09-14.
const showcaseVideoIds = [
  "1165499745", "1165499670", "1165499251", "1165499027", "1165498956",
  "1165498523", "1165498343", "1206153465", "1215218560",
].sort();
const outputDirectory = "test-results/panhandle-review";
await mkdir(outputDirectory, { recursive: true });
// A normal, temporary profile is required: browsers disable app installation
// in the incognito contexts used by browser.newPage().
const profileDirectory = await mkdtemp(join(tmpdir(), "county-post-review-"));
const browserContext = await chromium.launchPersistentContext(profileDirectory, {
  executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"],
  viewport: { width: 1280, height: 900 }, reducedMotion: "reduce",
});
const page = await browserContext.newPage();
const result = { baseURL, catalog: [], editions: [], videos: [], partners: [], errors: [], failedRequests: [] };
if (!checkPlayback) result.playbackCheck = "Skipped: Vimeo's connection restriction was already recorded in this environment";
page.on("pageerror", (error) => result.errors.push(error.message));
page.on("requestfailed", (request) => {
  if (/vimeo/.test(request.url())) result.failedRequests.push({ url: request.url(), error: request.failure()?.errorText });
});

async function verifyEditionCatalog(path) {
  await page.goto(`${baseURL}${path}`, { waitUntil: "domcontentloaded" });
  const carousels = page.locator(".ad-slot-inline");
  await carousels.first().waitFor({ state: "attached" });
  const counts = [];
  for (const carousel of await carousels.all()) {
    const videos = await carousel.locator(".video-ad").evaluateAll(async (cards) => Promise.all(cards.map(async (card) => {
      const image = card.querySelector("img");
      image.loading = "eager";
      await image.decode();
      return {
        id: card.dataset.adId,
        title: card.querySelector(".video-ad-title").textContent,
        watchUrl: card.querySelector("a[href^='https://vimeo.com/']").href,
        thumbnailLoaded: image.naturalWidth > 0 && image.naturalHeight > 0,
      };
    })));
    const ids = videos.map((video) => video.watchUrl.split("/").pop()).sort();
    if (ids.join(",") !== showcaseVideoIds.join(",")) throw new Error(`Incomplete showcase at ${path}: ${ids.join(",")}`);
    if (videos.some((video) => !video.thumbnailLoaded)) throw new Error(`Missing video thumbnail at ${path}`);
    counts.push(videos.length);
    if (path === "/texas") result.catalog = videos;
  }
  if (await page.locator("iframe[src*='player.vimeo.com']").count()) throw new Error("Video player loaded before a reader clicked");
  result.editions.push({ path, carouselVideoCounts: counts, thumbnailsLoaded: true });
}

try {
  await verifyEditionCatalog("/texas");
  // The carousel follows three news sections. Wait for those sections to
  // settle so their initial expansion does not scroll the player out of view.
  if (checkPlayback) await page.locator(".feed-source").nth(2).waitFor({ state: "attached", timeout: 30000 });
  const carousel = page.locator(".ad-slot-inline").first();

  for (const { id } of checkPlayback ? result.catalog : []) {
    const card = carousel.locator(`[data-ad-id='${id}']`);
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

  for (const path of ["/texas/randall", "/texas/harris"]) await verifyEditionCatalog(path);

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
  result.bookmarkPopup = await page.locator(".bookmark-toast").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, right: innerWidth - bounds.right, bottom: innerHeight - bounds.bottom };
  });
  if (result.bookmarkPopup.width > 330 || result.bookmarkPopup.right !== 16 || result.bookmarkPopup.bottom !== 16) {
    throw new Error("The compact bottom-right popup is not being served");
  }
  await page.screenshot({ path: `${outputDirectory}/national-popup.png` });
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
  await browserContext.close();
  await rm(profileDirectory, { recursive: true, force: true });
}
