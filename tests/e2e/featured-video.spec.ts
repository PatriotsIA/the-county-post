import { expect, test, type Page } from "@playwright/test";

const channels = [
  { id: "itm-trading", name: "ITM Trading", platform: "youtube", url: "https://www.youtube.com/@ITMTrading" },
  { id: "patriots-in-action-tv", name: "Patriots in Action TV", platform: "vimeo", url: "https://vimeo.com/patriotsinactiontv" },
];
const videos = [
  { id: "AAAAAAAAAA1", channelId: "itm-trading", platform: "youtube", title: "Gold and the dollar", publishedAt: "2026-11-17T16:05:06Z", thumbnailUrl: "https://i.ytimg.com/vi/AAAAAAAAAA1/hqdefault.jpg", watchUrl: "https://www.youtube.com/watch?v=AAAAAAAAAA1", embedUrl: "https://www.youtube-nocookie.com/embed/AAAAAAAAAA1?rel=0&playsinline=1&autoplay=1" },
  { id: "1245870309", channelId: "patriots-in-action-tv", platform: "vimeo", title: "Word on the Street", publishedAt: "2026-11-11T16:14:50Z", thumbnailUrl: "https://i.vimeocdn.com/video/1.jpg", watchUrl: "https://vimeo.com/1245870309", embedUrl: "https://player.vimeo.com/video/1245870309?h=1&dnt=1&autoplay=1", durationSeconds: 2307 },
  { id: "BADBADBAD01", channelId: "itm-trading", platform: "youtube", title: "Not a player", watchUrl: "https://example.com/", embedUrl: "https://example.com/embed/BADBADBAD01" },
];
const liveStream = { channelId: "itm-trading", platform: "youtube", videoId: "LIVEVIDEO01", title: "Live market update", watchUrl: "https://www.youtube.com/watch?v=LIVEVIDEO01", embedUrl: "https://www.youtube-nocookie.com/embed/LIVEVIDEO01?rel=0&playsinline=1&autoplay=1&mute=1" };

const standby = {
  channel: { id: "newsmax2", name: "Newsmax2", platform: "youtube", url: "https://www.youtube.com/@NewsmaxTV" },
  stream: { channelId: "newsmax2", platform: "youtube", videoId: "NEWSMAX2ON1", title: "NEWSMAX2 LIVE | Real News for Real People", watchUrl: "https://www.youtube.com/watch?v=NEWSMAX2ON1", embedUrl: "https://www.youtube-nocookie.com/embed/NEWSMAX2ON1?rel=0&playsinline=1&autoplay=1&mute=1" },
};

/** A page player's address: the provider's embed with its control channel switched on. */
const playerSrc = (embedUrl: string) => new RegExp(`^${embedUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}&(enablejsapi=1&origin=|api=1)`);

async function serveVideos(page: Page, live: unknown[] = [], status = 200, stand?: typeof standby) {
  await page.route("**/v1/videos/featured", (route) => route.fulfill({ status, json: { channels, videos, live, standby: stand, fetchedAt: "2026-11-17T18:00:00Z", liveUnchecked: ["patriots-in-action-tv"] } }));
  // Keep the providers off the network: thumbnails and players are only checked by address.
  await page.route(/^https:\/\/(i\.ytimg\.com|i\.vimeocdn\.com|www\.youtube-nocookie\.com|player\.vimeo\.com)\//, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" }));
}

test("the desk sits under the collapsed Market desk, above the front page's county search, open until a reader closes it", async ({ page }) => {
  await serveVideos(page);
  await page.goto("/");

  const desk = page.locator(".video-desk");
  const toggle = desk.getByRole("button", { name: /Featured Videos/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: /Market desk/ })).toHaveAttribute("aria-expanded", "false");
  const order = await page.evaluate(() => [".market-panel", ".video-desk", ".top-county-finder"].map((selector) => document.querySelector(selector)!.getBoundingClientRect().top));
  expect(order[0]).toBeLessThan(order[1]);
  expect(order[1]).toBeLessThan(order[2]);

  // Closed, it stays closed for the rest of the visit, until the reader opens it again.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(page.locator(".video-desk").getByRole("button", { name: /Featured Videos/ })).toHaveAttribute("aria-expanded", "false");
  await page.locator(".video-desk").getByRole("button", { name: /Featured Videos/ }).click();
  await page.reload();
  await expect(page.locator(".video-desk").getByRole("button", { name: /Featured Videos/ })).toHaveAttribute("aria-expanded", "true");

  const cards = desk.locator(".video-desk-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(1)).toContainText("Patriots in Action TV");
  await expect(cards.nth(1)).toContainText("38:27");
  await expect(desk.locator("iframe")).toHaveCount(0);

  // Two cards fit, so there is nothing to scroll to.
  await expect(desk.getByRole("button", { name: "Previous videos" })).toBeHidden();

  await cards.nth(1).click();
  await expect(desk.locator("iframe")).toHaveAttribute("src", playerSrc(videos[1].embedUrl));
  // A refresh that no longer lists the playing video leaves it playing.
  await page.unroute("**/v1/videos/featured");
  await page.route("**/v1/videos/featured", (route) => route.fulfill({ json: { channels, videos: [videos[0]], live: [], fetchedAt: "2026-11-17T18:02:00Z" } }));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(cards).toHaveCount(1);
  await expect(desk.locator("iframe")).toHaveAttribute("src", playerSrc(videos[1].embedUrl));
  await desk.getByRole("button", { name: "Close video" }).click();
  await expect(desk.locator("iframe")).toHaveCount(0);

  for (const path of ["/texas/potter", "/partners", "/itm-trading"]) {
    await page.goto(path);
    await expect(page.locator(".video-desk"), path).toHaveCount(1);
  }
  // Every page has it, the sponsor landing pages included.
  await page.goto("/legends");
  await expect(page.locator(".video-desk")).toHaveCount(1);
});

test("a live channel opens the desk to a muted stream, and closing it holds for that stream", async ({ page }) => {
  await serveVideos(page, [liveStream]);
  await page.goto("/texas/potter");
  const desk = page.locator(".video-desk");
  await expect(desk.getByRole("button", { name: /Featured Videos/ })).toHaveAttribute("aria-expanded", "true");
  await expect(desk.locator(".video-desk-live-badge")).toHaveText("Live now · ITM Trading");
  await desk.scrollIntoViewIfNeeded();
  await expect(desk.locator("iframe")).toHaveAttribute("src", playerSrc(liveStream.embedUrl));
  await expect(desk.getByRole("link", { name: /Watch live on YouTube/ })).toHaveAttribute("href", liveStream.watchUrl);

  // A chosen video replaces the stream until the reader goes back to live.
  await desk.locator(".video-desk-card").first().click();
  await expect(desk.locator("iframe")).toHaveAttribute("src", playerSrc(videos[0].embedUrl));
  await desk.getByRole("button", { name: "Back to live" }).click();
  await expect(desk.locator("iframe")).toHaveAttribute("src", playerSrc(liveStream.embedUrl));

  await desk.getByRole("button", { name: /Featured Videos/ }).click();
  await page.reload();
  await expect(page.locator(".video-desk .video-desk-live-badge")).toBeVisible();
  await expect(page.locator(".video-desk").getByRole("button", { name: /Featured Videos/ })).toHaveAttribute("aria-expanded", "false");
});

test("while no featured channel is live, Newsmax2 fills the live slot, playing muted in the open desk", async ({ page }) => {
  await serveVideos(page, [], 200, standby);
  await page.goto("/texas/potter");
  const desk = page.locator(".video-desk");
  const toggle = desk.getByRole("button", { name: /Featured Videos/ });
  await expect(desk.locator(".video-desk-live-badge")).toHaveText("Live now · Newsmax2");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".page-jump-toggle")).toHaveAccessibleName("Jump to, Newsmax2 live now");

  // The desk plays it muted and credits Newsmax beside the featured channels.
  await desk.scrollIntoViewIfNeeded();
  await expect(desk.locator("iframe")).toHaveAttribute("src", playerSrc(standby.stream.embedUrl));
  await expect(desk.locator(".video-desk-player-label")).toHaveText("LiveNewsmax2 · muted — unmute in the player");
  await expect(desk.getByRole("link", { name: "Newsmax2 on YouTube ↗" })).toHaveAttribute("href", standby.channel.url);
  // The feed desk leads with it as well, waiting to be chosen.
  const feedDesk = page.locator(".video-feed-desk");
  await expect(feedDesk.locator(".video-desk-card").first()).toHaveAccessibleName("Watch live: NEWSMAX2 LIVE | Real News for Real People — Newsmax2");
  await expect(feedDesk.locator("iframe")).toHaveCount(0);

  // A featured channel on the air takes the slot back.
  await page.unroute("**/v1/videos/featured");
  await serveVideos(page, [liveStream], 200, standby);
  await page.reload();
  await expect(page.locator(".video-desk .video-desk-live-badge")).toHaveText("Live now · ITM Trading");
  await expect(page.getByText("Newsmax2")).toHaveCount(0);
});

test("a second, open desk sits between the Politics and Economy feeds on every edition home page", async ({ page }) => {
  await serveVideos(page, [liveStream]);
  // Choosing a video scrolls its player into view; without motion the scroll is immediate.
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/", "/texas", "/texas/potter"]) {
    await page.goto(path);
    const feed = page.locator("#desk-video");
    await expect(feed, path).toHaveAttribute("data-page-jump", "Featured video");
    const between = await page.evaluate(() => {
      const [politics, video, economy] = ["#desk-politics", "#desk-video", "#desk-economy"].map((selector) => document.querySelector(selector)!);
      return Boolean(politics.compareDocumentPosition(video) & Node.DOCUMENT_POSITION_FOLLOWING) && Boolean(video.compareDocumentPosition(economy) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(between, path).toBe(true);
    await expect(feed.getByRole("button", { name: /Hide videos/ }), path).toHaveAttribute("aria-expanded", "true");
  }

  // On air streams lead its carousel but play only when chosen, and then with sound.
  const feed = page.locator("#desk-video");
  await page.setViewportSize({ width: 780, height: 720 });
  const [previous, next] = [feed.getByRole("button", { name: "Previous videos" }), feed.getByRole("button", { name: "More videos" })];
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
  await next.click();
  await expect(previous).toBeEnabled();
  await expect(next).toBeDisabled();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(feed.locator(".video-desk-card")).toHaveCount(3);
  await expect(feed.locator(".video-desk-card").first()).toContainText("on air now");
  await feed.scrollIntoViewIfNeeded();
  await expect(feed.locator("iframe")).toHaveCount(0);
  await feed.locator(".video-desk-card").first().click();
  await expect(feed.locator("iframe")).toHaveAttribute("src", playerSrc("https://www.youtube-nocookie.com/embed/LIVEVIDEO01?rel=0&playsinline=1&autoplay=1"));

  await feed.getByRole("button", { name: /Hide videos/ }).click();
  await expect(feed.locator(".video-desk-card")).toHaveCount(0);
  await expect(feed.locator("iframe")).toHaveCount(0);
  await feed.getByRole("button", { name: /Show videos/ }).click();
  await expect(feed.locator(".video-desk-card")).toHaveCount(3);
});

test("the desks stay hidden when the video service is unavailable", async ({ page }) => {
  await serveVideos(page, [], 503);
  await page.goto("/texas/potter");
  await expect(page.locator(".market-panel")).toBeVisible();
  await expect(page.locator("#desk-politics")).toBeVisible();
  await expect(page.locator(".video-desk, #desk-video")).toHaveCount(0);

  // With nothing to show, the masthead does not offer it either.
  await expect(page.locator(".masthead .watch-news-button")).toHaveCount(0);
});

test("Watch News Now, in every masthead, always pulses and opens Featured Videos with sound; a Live tag joins it while a featured channel is live", async ({ page }) => {
  await serveVideos(page, [], 200, standby);
  await page.goto("/");
  const button = page.locator(".masthead .watch-news-button");
  await expect(button).toHaveText("▶Watch News Now");
  // It always pulses; the Live tag waits for a featured channel.
  await expect.poll(() => button.evaluate((element) => getComputedStyle(element).animationName)).toBe("watch-news-pulse");
  await expect(button.locator(".watch-news-live-tag")).toHaveCount(0);
  const buttonBox = (await button.boundingBox())!;
  const mapBox = (await page.locator(".masthead .edition-map-shell").boundingBox())!;
  expect(buttonBox.y).toBeGreaterThanOrEqual(mapBox.y + mapBox.height - 1);
  expect(Math.abs(buttonBox.x + buttonBox.width / 2 - (mapBox.x + mapBox.width / 2))).toBeLessThan(3);

  const desk = page.locator(".video-desk");
  const toggle = desk.getByRole("button", { name: /Featured Videos/ });
  // The desk starts open, muted. A reader who closed it gets it back from the button, with sound.
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await button.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  // The reader asked to watch, so the stream plays with sound.
  await expect(desk.locator("iframe")).toHaveAttribute("src", playerSrc(standby.stream.embedUrl.replace("&mute=1", "")));
  await expect(desk.locator(".video-desk-player-label")).toHaveText("LiveNewsmax2");
  await expect.poll(() => desk.evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBeLessThan(20);

  // Closing the desk ends that: reopened by hand, the stream is muted again.
  await toggle.click();
  await toggle.click();
  await expect(desk.locator("iframe")).toHaveAttribute("src", playerSrc(standby.stream.embedUrl));

  // Pages without a map carry it under the logo.
  await page.goto("/about");
  const logoBox = (await page.locator(".masthead .wordmark").boundingBox())!;
  expect((await button.boundingBox())!.y).toBeGreaterThanOrEqual(logoBox.y + logoBox.height - 1);
  await button.click();
  await expect(page.locator(".video-desk").getByRole("button", { name: /Featured Videos/ })).toHaveAttribute("aria-expanded", "true");

  // A featured channel on the air: the Live tag joins the button, which plays the stream with sound.
  await page.unroute("**/v1/videos/featured");
  await serveVideos(page, [liveStream], 200, standby);
  await page.goto("/texas/potter");
  await expect(button.locator(".watch-news-live-tag")).toHaveText("Live");
  await expect(button).toHaveAccessibleName("Watch News Now: ITM Trading live now, in Featured Videos");
  // The desk opened itself to the stream, muted; its player loads once it is on screen.
  await page.locator(".video-desk").scrollIntoViewIfNeeded();
  await expect(page.locator(".video-desk iframe")).toHaveAttribute("src", playerSrc(liveStream.embedUrl));
  await page.evaluate(() => window.scrollTo(0, 0));
  await button.click();
  await expect(page.locator(".video-desk iframe")).toHaveAttribute("src", playerSrc(liveStream.embedUrl.replace("&mute=1", "")));
});

test("YouTube players stay at least 200 × 200, start on their own only once half on screen, and the terms say so", async ({ page }) => {
  await serveVideos(page, [liveStream]);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/texas/potter");
  const desk = page.locator(".video-desk");
  const frame = desk.locator(".video-desk-frame");
  // On a phone the open desk starts below the fold: no player loads until it is half on screen.
  await expect(desk.getByRole("button", { name: /Featured Videos/ })).toHaveAttribute("aria-expanded", "true");
  await expect(frame).not.toBeInViewport({ ratio: 0.5 });
  await expect(desk.locator("iframe")).toHaveCount(0);
  await frame.scrollIntoViewIfNeeded();
  await expect(desk.locator("iframe")).toHaveAttribute("src", playerSrc(liveStream.embedUrl));
  const deskBox = (await frame.boundingBox())!;
  expect(Math.min(deskBox.width, deskBox.height)).toBeGreaterThanOrEqual(200);

  // Popped out, at its narrowest and minimised, the player keeps 200 × 200.
  await desk.locator(".video-desk-player").getByRole("button", { name: /Pop out/ }).click();
  const dockFrame = page.locator(".media-dock .media-dock-frame");
  await expect(dockFrame).toBeVisible();
  const dockBox = (await dockFrame.boundingBox())!;
  expect(Math.min(dockBox.width, dockBox.height)).toBeGreaterThanOrEqual(200);
  await page.locator(".media-dock").getByRole("button", { name: "Minimize player" }).click();
  await expect(page.locator(".media-dock")).toHaveClass(/media-dock-minimized/);
  const minimisedBox = (await dockFrame.boundingBox())!;
  expect(Math.min(minimisedBox.width, minimisedBox.height)).toBeGreaterThanOrEqual(200);

  await page.goto("/terms");
  await expect(page.getByRole("link", { name: "YouTube Terms of Service" })).toHaveAttribute("href", "https://www.youtube.com/t/terms");
  await page.goto("/privacy");
  await expect(page.getByRole("link", { name: "Google Privacy Policy" })).toHaveAttribute("href", "https://www.google.com/policies/privacy");
});
