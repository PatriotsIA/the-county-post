import { expect, test, type Page } from "@playwright/test";

/*
 * The pop-out player drives YouTube and Vimeo through their postMessage
 * channels. Real players are not run here (Vimeo turns headless browsers away);
 * these stand-ins speak the same protocols, so the controls, the clock, seeking
 * and auto-advance are exercised end to end.
 */

const channels = [
  { id: "itm-trading", name: "ITM Trading", platform: "youtube", url: "https://www.youtube.com/@ITMTrading" },
  { id: "patriots-in-action-tv", name: "Patriots in Action TV", platform: "vimeo", url: "https://vimeo.com/patriotsinactiontv" },
];
const videos = [
  { id: "AAAAAAAAAA1", channelId: "itm-trading", platform: "youtube", title: "Gold and the dollar", publishedAt: "2026-11-17T16:05:06Z", watchUrl: "https://www.youtube.com/watch?v=AAAAAAAAAA1", embedUrl: "https://www.youtube-nocookie.com/embed/AAAAAAAAAA1?rel=0&playsinline=1&autoplay=1" },
  { id: "1245870309", channelId: "patriots-in-action-tv", platform: "vimeo", title: "Word on the Street", publishedAt: "2026-11-11T16:14:50Z", watchUrl: "https://vimeo.com/1245870309", embedUrl: "https://player.vimeo.com/video/1245870309?h=1&dnt=1&autoplay=1", durationSeconds: 90 },
  { id: "AAAAAAAAAA2", channelId: "itm-trading", platform: "youtube", title: "The dollar breaks", publishedAt: "2026-11-10T16:05:06Z", watchUrl: "https://www.youtube.com/watch?v=AAAAAAAAAA2", embedUrl: "https://www.youtube-nocookie.com/embed/AAAAAAAAAA2?rel=0&playsinline=1&autoplay=1" },
];
const liveStream = { channelId: "itm-trading", platform: "youtube", videoId: "LIVEVIDEO01", title: "Live market update", watchUrl: "https://www.youtube.com/watch?v=LIVEVIDEO01", embedUrl: "https://www.youtube-nocookie.com/embed/LIVEVIDEO01?rel=0&playsinline=1&autoplay=1&mute=1" };

// YouTube's widget channel: answers "listening", reports every half second, obeys commands.
const youTubeStandIn = `<!doctype html><body style="margin:0;background:#222"><script>
const params = new URLSearchParams(location.search);
let id = null, time = Number(params.get("start") || 0), duration = 120, muted = params.get("mute") === "1";
let state = params.get("autoplay") === "1" ? 1 : 5;
const send = (message) => parent.postMessage(JSON.stringify({ ...message, id, channel: "widget" }), "*");
const deliver = () => send({ event: "infoDelivery", info: { currentTime: time, duration, playerState: state, muted } });
addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.event === "listening") { id = message.id; send({ event: "onReady" }); deliver(); }
  if (message.event !== "command") return;
  if (message.func === "playVideo") state = 1;
  if (message.func === "pauseVideo") state = 2;
  if (message.func === "seekTo") time = message.args[0];
  if (message.func === "mute") muted = true;
  if (message.func === "unMute") muted = false;
  deliver();
});
setInterval(() => {
  if (state === 1) { time = Math.min(duration, time + 0.5); if (time >= duration) { state = 0; send({ event: "onStateChange", info: 0 }); } }
  if (id) deliver();
}, 500);
</script></body>`;

// Vimeo's player.js protocol: announces "ready", then reports the events asked for.
const vimeoStandIn = `<!doctype html><body style="margin:0;background:#123"><script>
let time = Number((location.hash.match(/t=(\\d+)s/) || [])[1] || 0), duration = 90;
let playing = new URLSearchParams(location.search).get("autoplay") === "1";
const wanted = new Set();
const send = (message) => parent.postMessage(message, "*");
addEventListener("message", (event) => {
  const message = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
  if (message.method === "addEventListener") wanted.add(message.value);
  if (message.method === "ping") send({ event: "ready" });
  if (message.method === "getDuration") send({ method: "getDuration", value: duration });
  if (message.method === "getPaused") send({ method: "getPaused", value: !playing });
  if (message.method === "getMuted") send({ method: "getMuted", value: false });
  if (message.method === "play") { playing = true; if (wanted.has("play")) send({ event: "play" }); }
  if (message.method === "pause") { playing = false; if (wanted.has("pause")) send({ event: "pause" }); }
  if (message.method === "setCurrentTime") time = message.value;
});
addEventListener("load", () => send({ event: "ready" }));
setInterval(() => {
  if (!playing) return;
  time = Math.min(duration, time + 0.5);
  if (wanted.has("timeupdate")) send({ event: "timeupdate", data: { seconds: time, duration, percent: time / duration } });
  if (time >= duration) { playing = false; if (wanted.has("ended")) send({ event: "ended" }); }
}, 500);
</script></body>`;

async function setUp(page: Page, live: unknown[] = []) {
  await page.route("**/v1/videos/featured", (route) => route.fulfill({ json: { channels, videos, live, fetchedAt: "2026-11-17T18:00:00Z" } }));
  await page.route(/^https:\/\/(i\.ytimg\.com|i\.vimeocdn\.com)\//, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/^https:\/\/www\.youtube-nocookie\.com\/embed\//, (route) => route.fulfill({ contentType: "text/html", body: youTubeStandIn }));
  await page.route(/^https:\/\/player\.vimeo\.com\/video\//, (route) => route.fulfill({ contentType: "text/html", body: vimeoStandIn }));
  await page.emulateMedia({ reducedMotion: "reduce" });
}

const dockOf = (page: Page) => page.locator(".media-dock");

test("a card pops out into a player that plays, seeks, pauses and works through its queue", async ({ page }) => {
  await setUp(page);
  await page.goto("/texas/potter");
  await page.locator(".video-desk").getByRole("button", { name: "Pop out: Gold and the dollar" }).click();

  const dock = dockOf(page);
  await expect(dock).toBeVisible();
  await expect(dock.locator(".media-dock-title")).toHaveText("Gold and the dollar");
  await expect(dock.locator(".media-dock-position")).toHaveText("1 of 3");
  await expect(dock.locator("iframe")).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/AAAAAAAAAA1\?.*autoplay=1.*enablejsapi=1.*mute=0/);
  await expect(dock.getByRole("button", { name: "Pause", exact: true })).toBeEnabled();
  await expect(dock.locator(".media-dock-time").last()).toHaveText("2:00");
  // The card shows where it is playing.
  await expect(page.locator(".video-desk .video-desk-card").first()).toContainText("In pop-out");

  await dock.getByRole("button", { name: "Forward 15 seconds" }).click();
  await expect(dock.locator(".media-dock-time").first()).toHaveText(/^0:1[5-9]$/);
  await dock.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(dock.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  const held = await dock.locator(".media-dock-time").first().textContent();
  await page.waitForTimeout(1200);
  await expect(dock.locator(".media-dock-time").first()).toHaveText(held!);
  await dock.getByRole("button", { name: "Play", exact: true }).click();
  await dock.getByRole("button", { name: "Mute", exact: true }).click();
  await expect(dock.getByRole("button", { name: "Unmute", exact: true })).toBeVisible();

  // Next goes to the Vimeo upload; its clock comes from Vimeo's own events.
  await dock.getByRole("button", { name: "Next video" }).click();
  await expect(dock.locator(".media-dock-title")).toHaveText("Word on the Street");
  await expect(dock.locator("iframe")).toHaveAttribute("src", /player\.vimeo\.com\/video\/1245870309\?.*api=1/);
  await expect(dock.locator(".media-dock-time").last()).toHaveText("1:30");
  await expect(dock.locator(".media-dock-time").first()).not.toHaveText("0:00");

  // Running off the end plays the next item.
  await dock.locator(".media-dock-scrubber").focus();
  await page.keyboard.press("End");
  await expect(dock.locator(".media-dock-position")).toHaveText("3 of 3");
  await expect(dock.locator(".media-dock-title")).toHaveText("The dollar breaks");

  // The queue jumps anywhere and marks what is playing.
  await dock.getByRole("button", { name: "Show queue" }).click();
  const queue = dock.locator(".media-dock-queue li button");
  await expect(queue).toHaveCount(3);
  await expect(queue.nth(2)).toHaveAttribute("aria-current", "true");
  await queue.first().click();
  await expect(dock.locator(".media-dock-position")).toHaveText("1 of 3");
  await expect(dock.getByRole("button", { name: "Previous video" })).toBeDisabled();

  // Keyboard shortcuts work while the player has focus.
  await dock.locator(".media-dock-grip").focus();
  await page.keyboard.press("n");
  await expect(dock.locator(".media-dock-position")).toHaveText("2 of 3");

  await dock.getByRole("button", { name: "Close player" }).click();
  await expect(dock).toHaveCount(0);
});

test("the player can be dragged, nudged and resized, remembers its place, and keeps playing across pages", async ({ page }) => {
  await setUp(page);
  await page.goto("/texas/potter");
  await page.locator(".video-desk").getByRole("button", { name: "Pop out: Gold and the dollar" }).click();
  const dock = dockOf(page);
  await expect(dock.getByRole("button", { name: "Pause", exact: true })).toBeVisible();

  const start = (await dock.boundingBox())!;
  const handle = (await dock.locator(".media-dock-heading").boundingBox())!;
  await page.mouse.move(handle.x + 10, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 310, handle.y + handle.height / 2 - 200, { steps: 6 });
  await page.mouse.up();
  const moved = (await dock.boundingBox())!;
  expect(Math.round(moved.x - start.x)).toBe(300);
  expect(Math.round(moved.y - start.y)).toBe(-200);

  await dock.locator(".media-dock-grip").focus();
  await page.keyboard.press("ArrowRight");
  expect(Math.round((await dock.boundingBox())!.x - moved.x)).toBe(24);

  const grip = (await dock.locator(".media-dock-resize").boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 120, grip.y + grip.height / 2, { steps: 4 });
  await page.mouse.up();
  expect(Math.round((await dock.boundingBox())!.width)).toBe(520);

  // Dragging can never take it off screen.
  const bar = (await dock.locator(".media-dock-heading").boundingBox())!;
  await page.mouse.move(bar.x + 10, bar.y + 5);
  await page.mouse.down();
  await page.mouse.move(-500, -500, { steps: 4 });
  await page.mouse.up();
  const clamped = (await dock.boundingBox())!;
  expect(clamped.x).toBeGreaterThanOrEqual(8);
  expect(clamped.y).toBeGreaterThanOrEqual(8);

  // Minimised, the same frame keeps playing while the reader moves to another page.
  await dock.getByRole("button", { name: "Minimize player" }).click();
  await expect(dock.getByRole("button", { name: "Forward 15 seconds" })).toBeHidden();
  await dock.locator("iframe").evaluate((frame) => { (frame as HTMLIFrameElement & { marked?: boolean }).marked = true; });
  await page.locator('.nav a[href="/partners"]').click();
  await expect(page).toHaveURL(/\/partners$/);
  expect(await dock.locator("iframe").evaluate((frame) => Boolean((frame as HTMLIFrameElement & { marked?: boolean }).marked))).toBe(true);
  const before = await dock.locator(".media-dock-time").first().textContent();
  await expect(dock.locator(".media-dock-time").first()).not.toHaveText(before!);

  // The window's place and size outlast a reload.
  await dock.getByRole("button", { name: "Expand player" }).click();
  const placed = (await dock.boundingBox())!;
  await page.reload();
  await page.locator(".video-desk").getByRole("button", { name: "Pop out: Word on the Street" }).click();
  const restored = (await dockOf(page).boundingBox())!;
  expect([Math.round(restored.x), Math.round(restored.y), Math.round(restored.width)]).toEqual([Math.round(placed.x), Math.round(placed.y), Math.round(placed.width)]);
});

test("a page player hands over its place, and a live stream steps aside on the page", async ({ page }) => {
  await setUp(page, [liveStream]);
  await page.goto("/texas/potter");
  const desk = page.locator(".video-desk");
  await desk.scrollIntoViewIfNeeded();
  await expect(desk.locator("iframe")).toHaveAttribute("src", /LIVEVIDEO01\?.*mute=1/);

  // The muted live stream pops out with sound, and the page shows where it went.
  await desk.getByRole("button", { name: "Pop out ⧉" }).click();
  const dock = dockOf(page);
  await expect(dock.locator(".media-dock-live").first()).toBeVisible();
  await expect(dock.locator("iframe")).toHaveAttribute("src", /LIVEVIDEO01\?.*mute=0/);
  await expect(desk.locator(".video-desk-docked-note")).toContainText("Playing in the pop-out player");
  await expect(desk.locator(".video-desk-frame iframe")).toHaveCount(0);
  await expect(dock.getByRole("button", { name: "Forward 15 seconds" })).toBeDisabled();
  await desk.getByRole("button", { name: "Close pop-out" }).click();
  await expect(dock).toHaveCount(0);
  await expect(desk.locator(".video-desk-frame iframe")).toHaveCount(1);

  // A video playing on the page carries on in the pop-out from where it had reached.
  const feed = page.locator("#desk-video");
  await feed.scrollIntoViewIfNeeded();
  await feed.getByRole("button", { name: /^Play: Gold and the dollar/ }).click();
  const inline = feed.locator(".video-desk-frame iframe");
  await expect(inline).toHaveCount(1);
  await page.waitForTimeout(2600);
  await feed.getByRole("button", { name: "Pop out ⧉" }).click();
  await expect(feed.locator(".video-desk-frame")).toHaveCount(0);
  await expect(dock.locator("iframe")).toHaveAttribute("src", /AAAAAAAAAA1\?.*start=[1-9]/);

  // While it is open, choosing another card plays it there rather than on the page.
  await feed.getByRole("button", { name: /^Play: The dollar breaks/ }).click();
  await expect(dock.locator(".media-dock-title")).toHaveText("The dollar breaks");
  await expect(feed.locator(".video-desk-frame")).toHaveCount(0);
});

test("the corner menu lists what there is to watch and steers the pop-out from any page", async ({ page }) => {
  await setUp(page, [liveStream]);
  await page.goto("/texas/potter");
  const toggle = page.getByRole("button", { name: /^Jump to/ });
  // On desktops too, it is there from the top of the page, and says a channel is live.
  await expect(toggle).toBeInViewport();
  await expect(toggle).toHaveAccessibleName("Jump to, ITM Trading live now");
  await expect(page.getByRole("button", { name: "Scroll to the top of the page" })).toHaveCount(0);

  await toggle.click();
  const menu = page.getByRole("dialog", { name: "Jump to" });
  const videos = menu.getByRole("list", { name: "Live streams and recent videos" }).getByRole("button");
  await expect(videos).toHaveCount(4);
  await expect(videos.first()).toHaveAccessibleName("Watch live: Live market update — ITM Trading");
  // Desktops get a panel over the corner, Watch beside the page's navigation.
  const watch = (await menu.locator(".page-jump-watch").boundingBox())!;
  const navigate = (await menu.locator(".page-jump-navigate").boundingBox())!;
  expect(watch.x + watch.width).toBeLessThanOrEqual(navigate.x + 1);
  expect(Math.abs(watch.y - navigate.y)).toBeLessThan(2);
  expect((await menu.boundingBox())!.width).toBeLessThan(1000);

  // Choosing a video plays it in the pop-out and gets the menu out of the way.
  await menu.getByRole("button", { name: /^Play: The dollar breaks/ }).click();
  await expect(menu).toHaveCount(0);
  const dock = dockOf(page);
  await expect(dock.locator(".media-dock-title")).toHaveText("The dollar breaks");
  await expect(dock.locator(".media-dock-position")).toHaveText("4 of 4");
  await expect(dock.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect(toggle).toHaveAccessibleName("Jump to, video playing, ITM Trading live now");

  // The menu's controls steer the same player.
  await toggle.click();
  const controls = menu.getByRole("group", { name: "Pop-out player controls" });
  await expect(controls.locator(".page-jump-now-title")).toHaveText("The dollar breaks");
  await expect(menu.getByRole("button", { name: /^Play: The dollar breaks/ })).toHaveAttribute("aria-current", "true");
  await expect(controls.locator(".page-jump-now-timeline span").last()).toHaveText("2:00");
  await controls.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(dock.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(toggle).toHaveAccessibleName("Jump to, video paused, ITM Trading live now");
  await controls.getByRole("button", { name: "Play", exact: true }).click();
  await expect(dock.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await controls.getByRole("button", { name: "Forward 15 seconds" }).click();
  await expect(dock.locator(".media-dock-time").first()).toHaveText(/^0:1[5-9]$/);
  await controls.getByRole("button", { name: "Mute", exact: true }).click();
  await expect(dock.getByRole("button", { name: "Unmute", exact: true })).toBeVisible();
  await controls.getByRole("button", { name: "Previous video" }).click();
  await expect(dock.locator(".media-dock-title")).toHaveText("Word on the Street");
  await expect(controls.locator(".page-jump-now-title")).toHaveText("Word on the Street");
  await controls.getByRole("button", { name: "Minimize player" }).click();
  await expect(dock).toHaveClass(/media-dock-minimized/);
  await expect(menu).toBeVisible();

  // Moving to another page from the menu: the button, the player and its frame carry on.
  await dock.locator("iframe").evaluate((frame) => { (frame as HTMLIFrameElement & { marked?: boolean }).marked = true; });
  await menu.getByRole("navigation", { name: "Potter County pages" }).getByRole("link", { name: "Weather" }).click();
  await expect(page).toHaveURL(/\/texas\/potter\/weather$/);
  await expect(menu).toHaveCount(0);
  expect(await dock.locator("iframe").evaluate((frame) => Boolean((frame as HTMLIFrameElement & { marked?: boolean }).marked))).toBe(true);
  await toggle.click();
  await expect(controls.locator(".page-jump-now-title")).toHaveText("Word on the Street");
  await controls.getByRole("button", { name: "Expand player" }).click();
  await expect(dock).not.toHaveClass(/media-dock-minimized/);
  await controls.getByRole("button", { name: "Close player" }).click();
  await expect(dock).toHaveCount(0);
  await expect(controls).toHaveCount(0);
  await expect(videos).toHaveCount(4);

  // Escape closes it and returns to the button.
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(toggle).toBeFocused();
});

test("on phones the jump menu's Watch row plays in the pop-out, which keeps clear of the button", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setUp(page, [liveStream]);
  await page.goto("/texas/potter");
  await page.getByRole("button", { name: "Dismiss bookmark reminder" }).click();

  const toggle = page.getByRole("button", { name: /^Jump to/ });
  await toggle.click();
  const menu = page.getByRole("dialog", { name: "Jump to" });
  const row = menu.locator(".page-jump-watch-row .page-jump-videos");
  await expect(row.getByRole("button")).toHaveCount(4);
  expect(await row.evaluate((list) => list.scrollWidth > list.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);

  await row.getByRole("button", { name: /^Watch live: Live market update/ }).click();
  await expect(menu).toHaveCount(0);
  const dock = dockOf(page);
  await expect(dock.locator(".media-dock-title")).toHaveText("Live market update");
  const placed = (await dock.boundingBox())!;
  const button = (await toggle.boundingBox())!;
  expect(placed.y + placed.height).toBeLessThanOrEqual(button.y);

  // Where the Fetch guide runs, its button stacks above Jump to, and the player keeps clear of both.
  await page.evaluate(() => {
    const launcher = Object.assign(document.createElement("button"), { className: "fetch-launcher", textContent: "Ask Fetch" });
    Object.assign(launcher.style, { position: "fixed", right: "12px", bottom: "62px", width: "120px", height: "48px", zIndex: "86" });
    document.body.append(launcher);
    window.dispatchEvent(new Event("resize"));
  });
  const launcher = (await page.locator(".fetch-launcher").boundingBox())!;
  await expect.poll(async () => { const box = (await dock.boundingBox())!; return box.y + box.height; }).toBeLessThanOrEqual(launcher.y);

  // A live stream has no clock to seek; the menu says so with the Live tag.
  await toggle.click();
  const controls = menu.getByRole("group", { name: "Pop-out player controls" });
  await expect(controls.locator(".page-jump-live-tag")).toBeVisible();
  await expect(controls.getByRole("slider", { name: "Seek" })).toHaveCount(0);
  await expect(controls.getByRole("button", { name: "Forward 15 seconds" })).toBeDisabled();
  await controls.getByRole("button", { name: "Next video" }).click();
  await expect(dock.locator(".media-dock-title")).toHaveText("Gold and the dollar");
});
