import { expect, test, devices, type Page } from "@playwright/test";

// Membership from https://vimeo.com/api/v2/album/12112279/videos.json (2026-09-14).
const showcaseVideoIds = [
  "1165499745", "1165499670", "1165499251", "1165499027", "1165498956",
  "1165498523", "1165498343", "1206153465", "1215218560",
].sort();

async function mockNews(page: Page, itemCount = 24) {
  await page.route("http://localhost:8787/**", async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.includes("/pages/") && !url.pathname.includes("/feeds/")) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Not part of this fixture" }) });
      return;
    }
    const isTexas = url.pathname.includes("/texas");
    const isCounty = url.pathname.includes("/counties/");
    const countySlug = isCounty ? url.pathname.split("/")[5] : undefined;
    const location = isCounty ? `${countySlug === "harris" ? "Harris" : "Randall"} County, Texas` : isTexas ? "Texas" : "United States";
    const items = Array.from({ length: itemCount }, (_, index) => ({
      id: `${url.pathname}-${index}`,
      title: itemCount > 24
        ? `${location}: topic${index} project${index} meeting${index} report${index}`
        : `${location} local news, sports and community report ${index}`,
      link: `https://example.com/report/${index}`,
      // Long-feed fixtures need independent publishers: shared county/state words
      // otherwise make the same-publisher event deduper collapse them to one story.
      source: itemCount > 24 ? `Community News ${index}` : "Community News",
      contentSnippet: `News from ${location}.`,
      publishedAt: new Date(Date.UTC(2026, 8, 14, 12, 0, 0) - index * 3600000).toISOString(),
    }));
    const feed = { items, scope: {}, meta: { count: items.length, hasMore: false, fetchedAt: new Date().toISOString() } };
    const body = url.pathname.includes("/pages/")
      ? { sections: Object.fromEntries((url.searchParams.get("sections") || "general").split(",").map((section) => [section, feed])), scope: {}, meta: feed.meta }
      : url.pathname.includes("/feeds/") ? feed : {};
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.route(/googletagmanager|google-analytics|tradingview|rss2json/, (route) => route.abort());
}

test.beforeEach(async ({ page }) => { await mockNews(page); });

test("GOPConnect ads and partner listings cover every state and county and link to My Local GOP", async ({ page }) => {
  await mockNews(page, 96);
  await page.goto("/partners");
  const coverage = await page.evaluate(async () => {
    const paths = ["/src/data/ads.ts", "/src/data/partners.ts", "/src/data/counties.ts", "/src/data/states.ts"];
    const [adData, partnerData, countyData, stateData] = await Promise.all(paths.map((path) => import(path)));
    const countyKeys = countyData.counties.map((county: { state: { slug: string }; slug: string }) => `${county.state.slug}/${county.slug}`);
    const editions = [undefined, ...stateData.states.map((state: { slug: string }) => state.slug), ...countyKeys];
    const isGopConnect = (ad: { id: string }) => ad.id === "gopconnect-inline";
    return {
      counties: countyKeys.length,
      states: stateData.states.length,
      allEditions: editions.every((key) => adData.getAdsForSlot("inline", key).filter(isGopConnect).length === 1 && adData.getInFeedAdRotation(key).some(isGopConnect)),
      allCountyPartners: countyKeys.every((key: string) => partnerData.getPartnersForCounty(key).filter(isGopConnect).length === 1),
      nationwidePartners: partnerData.getSitewidePartners().filter(isGopConnect).length,
    };
  });
  expect(coverage).toEqual({ counties: 3143, states: 51, allEditions: true, allCountyPartners: true, nationwidePartners: 1 });
  for (const path of ["/partners", "/texas/randall/partners", "/arkansas/polk/partners", "/california/los-angeles/partners"]) {
    await page.goto(path);
    const card = page.locator(".partner-card").filter({ has: page.getByRole("heading", { name: "GOPConnect", exact: true }) });
    await expect(card).toHaveCount(1);
    await expect(card.getByRole("link", { name: "Visit partner" })).toHaveAttribute("href", "https://mylocalgop.com/");
  }
  for (const path of ["/", "/texas", "/arkansas", "/texas/randall", "/arkansas/polk"]) {
    await page.goto(path);
    const image = page.locator('.ad-slot-inline img[alt^="My Local GOP"]').first();
    await image.evaluate((element: HTMLImageElement) => element.decode());
    expect(await image.evaluate((element: HTMLImageElement) => [element.naturalWidth, element.naturalHeight])).toEqual([1254, 1254]);
    await expect(image.locator("..")).toHaveAttribute("href", "https://mylocalgop.com/");
  }
  await page.goto("/texas");
  const feedAd = page.locator('.feed-ad-image[alt^="My Local GOP"]').first();
  await expect(feedAd).toBeAttached();
  await expect(feedAd.locator("..")).toHaveAttribute("href", "https://mylocalgop.com/");
});

test("Parallel partners and ads are limited to Randall and Potter counties", async ({ page }) => {
  await page.goto("/partners");
  const targeting = await page.evaluate(async () => {
    const paths = ["/src/data/ads.ts", "/src/data/partners.ts", "/src/data/counties.ts"];
    const [adData, partnerData, countyData] = await Promise.all(paths.map((path) => import(path)));
    const isParallel = (ad: { id: string }) => ad.id.startsWith("parallel-");
    const targets = ["texas/randall", "texas/potter"];
    return {
      targetCounts: targets.map((key) => ({
        inline: adData.getAdsForSlot("inline", key).filter(isParallel).length,
        banner: adData.getAdsForSlot("banner", key).filter(isParallel).length,
        partners: partnerData.getLocalCountyPartners(key).filter(isParallel).length,
        feedIds: [...new Set(adData.getInFeedAdRotation(key).filter(isParallel).map((ad: { id: string }) => ad.id))].sort(),
      })),
      excludedElsewhere: [undefined, "texas", ...countyData.counties.map((county: { state: { slug: string }; slug: string }) => `${county.state.slug}/${county.slug}`)]
        .filter((key) => !targets.includes(key as string))
        .every((key) => !adData.getAdsForSlot("inline", key).some(isParallel) && !adData.getAdsForSlot("banner", key).some(isParallel) && !adData.getInFeedAdRotation(key).some(isParallel)),
      globalListings: partnerData.getPartnerCreatives().filter(isParallel).length,
    };
  });
  expect(targeting).toEqual({
    targetCounts: Array.from({ length: 2 }, () => ({ inline: 2, banner: 2, partners: 2, feedIds: ["parallel-builders-inline", "parallel-roofing-inline"] })),
    excludedElsewhere: true,
    globalListings: 2,
  });
  for (const path of ["/partners", "/texas/randall/partners", "/texas/potter/partners"]) {
    await page.goto(path);
    for (const name of ["Parallel Roofing", "Parallel Builders"]) {
      await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(1);
      const card = page.locator(".partner-card").filter({ has: page.getByRole("heading", { name, exact: true }) });
      await expect(card.getByRole("link", { name: "Visit partner" })).toHaveAttribute("href", "https://pb-tx.com/");
    }
  }
  await page.goto("/texas/harris/partners");
  await expect(page.getByRole("heading", { name: /^Parallel / })).toHaveCount(0);
  for (const county of ["randall", "potter"]) {
    await page.goto(`/texas/${county}`);
    for (const [name, dimensions] of [["Roofing", [767, 435]], ["Builders", [569, 267]]] as const) {
      const image = page.locator(`.ad-slot-inline img[alt^="Parallel ${name}"]`).first();
      await image.evaluate((element: HTMLImageElement) => element.decode());
      expect(await image.evaluate((element: HTMLImageElement) => [element.naturalWidth, element.naturalHeight])).toEqual(dimensions);
      await expect(image.locator("..")).toHaveAttribute("href", "https://pb-tx.com/");
      await expect(page.locator(`.ad-banner-slide img[src*="parallel-${name.toLowerCase()}"]`).first()).toBeAttached();
      await expect(page.locator(`.ad-banner-slide:has(img[src*="parallel-${name.toLowerCase()}"])`).first()).toHaveAttribute("href", "https://pb-tx.com/");
    }
  }
});

test("Amberwood uses square artwork for ads and the wide logo for feed sponsorship", async ({ page }) => {
  // A full feed exercises the rotating ad catalog, beyond the first few ads.
  await mockNews(page, 96);
  await page.goto("/texas/randall");
  const square = page.locator('.ad-slot-inline img[alt^="Amberwood"]').first();
  const feedAd = page.locator('.feed-ad-image[alt^="Amberwood"]').first();
  const sponsor = page.locator('.feed-sponsor img[alt^="Amberwood"]').first();
  for (const image of [square, feedAd, sponsor]) {
    await expect(image).toBeAttached();
    await image.evaluate((element: HTMLImageElement) => element.decode());
  }
  await expect(square).toHaveAttribute("src", /amberwood-brush-square\.png/);
  await expect(feedAd).toHaveAttribute("src", /amberwood-brush-square\.png/);
  await expect(sponsor).toHaveAttribute("src", /amberwood-brush-logo\.png/);
  expect(await square.evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight])).toEqual([600, 600]);
  expect(await sponsor.evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight])).toEqual([2477, 923]);
  await expect(sponsor.locator("..")).toHaveAttribute("href", "/partners");
  await expect(page.locator('img[src*="Amberwood-Brush-Site-250"]')).toHaveCount(0);
});

test("books, The Ballot Box and the Texas statewide ads run spread between existing ads without moving masthead sponsors", async ({ page }) => {
  await page.goto("/partners");
  const placement = await page.evaluate(async () => {
    const paths = ["/src/data/ads.ts", "/src/data/partners.ts", "/src/data/counties.ts"];
    const [adData, partnerData, countyData] = await Promise.all(paths.map((path) => import(path)));
    type Ad = { id: string; href: string; video?: unknown };
    const countyKeys = countyData.counties.map((county: { state: { slug: string }; slug: string }) => `${county.state.slug}/${county.slug}`);
    const editions = [undefined, "texas", "oklahoma", ...countyKeys];
    const isBook = (ad: Ad) => ad.id.startsWith("books-");
    const texasPrefixes = ["patriots-for-paper-", "stop-sexualizing-texas-children-", "texas-sharia-watch-", "ken-paxton-", "greg-abbott-"];
    const count = (slot: string, key: string | undefined, test: (ad: Ad) => boolean) => adData.getAdsForSlot(slot, key).filter(test).length;
    const hrefs = (prefix: string) => [...new Set(adData.ads.filter((ad: Ad) => ad.id.startsWith(prefix)).map((ad: Ad) => ad.href))];
    const longestBookRun = (creatives: Ad[]) => creatives.reduce((run, ad) => ({ now: isBook(ad) ? run.now + 1 : 0, max: Math.max(run.max, isBook(ad) ? run.now + 1 : 0) }), { now: 0, max: 0 }).max;
    const spreadIn = (key?: string) => ({
      squares: longestBookRun(adData.getAdsForSlot("inline", key).filter((ad: Ad) => !ad.video)),
      feed: longestBookRun(adData.getInFeedAdRotation(key).filter((ad: Ad) => !ad.video)),
      banners: longestBookRun(adData.getAdsForSlot("banner", key)),
      firstBanner: adData.getAdsForSlot("banner", key)[0].id,
    });
    return {
      booksEverywhere: editions.every((key) => count("inline", key, isBook) === 9 && count("banner", key, isBook) === 9),
      ballotBoxEverywhere: editions.every((key) => ["inline", "banner"].every((slot) => count(slot, key, (ad) => ad.id.startsWith("ballot-box-")) === 1)),
      texasOnly: texasPrefixes.every((prefix) => editions.every((key) => ["inline", "banner"].every((slot) =>
        count(slot, key, (ad) => ad.id.startsWith(prefix)) === (key?.split("/")[0] === "texas" ? 1 : 0)))),
      hrefs: [hrefs("books-"), hrefs("ballot-box-"), ...texasPrefixes.map(hrefs)],
      spread: [spreadIn(), spreadIn("texas/harris")],
      partners: [partnerData.getSitewidePartners().filter((ad: { name: string }) => /^(Patriots in Action Books|The Ballot Box)$/.test(ad.name)).length, partnerData.getStatewidePartners("texas").filter((ad: { name: string }) => /^(Patriots for Paper|Stop Sexualizing Texas Children|Texas Sharia Watch)$/.test(ad.name)).length],
    };
  });
  expect(placement).toEqual({
    booksEverywhere: true,
    ballotBoxEverywhere: true,
    texasOnly: true,
    hrefs: [
      ["https://shop.patriotsinaction.com/collections/books"],
      ["https://theballotbox.com/"],
      ["https://patriotsforpaper.com/"],
      ["https://recoveramerica.com/protectchildren"],
      ["https://www.facebook.com/profile.php?id=61593844757341"],
      ["https://patriotsinaction.com/ken-paxton"],
      ["https://patriotsinaction.com/greg-abbott"],
    ],
    spread: [{ squares: 1, feed: 1, banners: 3, firstBanner: "lemc-banner" }, { squares: 1, feed: 1, banners: 2, firstBanner: "lemc-banner" }],
    partners: [2, 3],
  });

  // County masthead sponsors are assigned by position in the ad list; new ads must not reshuffle them (PIA-014).
  for (const [path, sponsor] of [["/texas/potter", "Parallel Builders"], ["/texas/harris", "Plains Bank"], ["/arkansas/polk", "Become a Patriot"], ["/new-york/kings", "Amberwood Brush"]]) {
    await page.goto(path);
    await expect(page.locator(".county-sponsor img"), path).toHaveAttribute("alt", new RegExp(`^${sponsor}`));
  }
  await page.goto("/texas/harris");
  for (const [selector, size] of [['.ad-slot-inline img[src*="books-all-square"]', [750, 750]], ['.ad-banner-slide img[src*="patriots-for-paper-banner"]', [1761, 600]]] as const) {
    const image = page.locator(selector).first();
    await image.evaluate((element: HTMLImageElement) => element.decode());
    expect(await image.evaluate((element: HTMLImageElement) => [element.naturalWidth, element.naturalHeight])).toEqual(size);
  }
});

test("the Recover America video accompanies the Stop Sexualizing Texas Children partner listing", async ({ page }) => {
  await mockNews(page);
  await page.route("https://player.vimeo.com/**", (route) => route.abort());
  for (const [path, count] of [["/partners", 1], ["/texas/harris/partners", 1], ["/arkansas/polk/partners", 0]] as const) {
    await page.goto(path);
    await expect(page.locator(".partner-card").first()).toBeVisible();
    const player = page.locator('.partner-video iframe[title="BONNIE WALLACE RECOVERAMERICA"]');
    await expect(player, path).toHaveCount(count);
    if (count) await expect(player).toHaveAttribute("src", "https://player.vimeo.com/video/1239959908?badge=0&autopause=0&player_id=0&app_id=58479");
  }
});

test("Dignity Memorial presents obituaries in every Texas edition without joining the ad rotation", async ({ page }) => {
  await page.goto("/partners");
  const targeting = await page.evaluate(async () => {
    const paths = ["/src/data/ads.ts", "/src/data/partners.ts", "/src/data/counties.ts"];
    const [adData, partnerData, countyData] = await Promise.all(paths.map((path) => import(path)));
    const id = adData.DIGNITY_MEMORIAL_AD_ID;
    const isDignity = (ad: { id: string }) => ad.id === id;
    const countyKeys = countyData.counties.map((county: { state: { slug: string }; slug: string }) => `${county.state.slug}/${county.slug}`);
    const texasEditions = ["texas", ...countyKeys.filter((key: string) => key.startsWith("texas/"))];
    const otherEditions = [undefined, "arkansas", ...countyKeys.filter((key: string) => !key.startsWith("texas/"))];
    return {
      texasEditions: texasEditions.length,
      sponsorsTexas: texasEditions.every((key) => adData.getFeedSponsor([id], key)?.id === id),
      absentElsewhere: otherEditions.every((key) => !adData.getFeedSponsor([id], key)),
      outOfRotation: [...texasEditions, ...otherEditions].every((key) =>
        !adData.getAdsForSlot("inline", key).some(isDignity) && !adData.getInFeedAdRotation(key).some(isDignity)),
      statewidePartner: partnerData.getStatewidePartners("texas").filter(isDignity).length,
      everyTexasCountyPartner: texasEditions.slice(1).every((key) => partnerData.getPartnersForCounty(key).some(isDignity)),
    };
  });
  expect(targeting).toEqual({ texasEditions: 255, sponsorsTexas: true, absentElsewhere: true, outOfRotation: true, statewidePartner: 1, everyTexasCountyPartner: true });

  for (const path of ["/texas/harris", "/texas"]) {
    await page.goto(path);
    const sponsor = page.locator("#desk-obituaries .feed-sponsor");
    await sponsor.locator("img").evaluate((image: HTMLImageElement) => image.decode());
    await expect(sponsor.locator("img")).toHaveAttribute("alt", "Dignity Memorial");
    await expect(sponsor).toHaveAttribute("href", "https://www.dignitymemorial.com/");
    expect(await sponsor.locator("img").evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight])).toEqual([580, 200]);
  }
  await page.goto("/arkansas/polk");
  await expect(page.locator("#desk-obituaries .feed-sponsor img")).toHaveAttribute("alt", "Patriot Trailer Store");

  for (const path of ["/partners", "/texas/harris/partners"]) {
    await page.goto(path);
    const card = page.locator(".partner-section").filter({ hasText: /statewide partners/i }).locator(".partner-card")
      .filter({ has: page.getByRole("heading", { name: "Dignity Memorial", exact: true }) });
    await expect(card).toContainText("Supporting every county in Texas.");
    await expect(card.locator("img")).toHaveAttribute("src", /dignity-memorial-wordmark\.jpg/);
    await expect(card.getByRole("link", { name: "Visit partner" })).toHaveAttribute("href", "https://www.dignitymemorial.com/");
  }
  await page.goto("/arkansas/polk/partners");
  await expect(page.getByRole("heading", { name: "Dignity Memorial", exact: true })).toHaveCount(0);
});

test("Texas advertiser targeting covers all 254 counties and excludes other editions", async ({ page }) => {
  await page.goto("/partners");
  const result = await page.evaluate(async (expectedVideoIds) => {
    const paths = ["/src/data/ads.ts", "/src/data/partners.ts", "/src/data/counties.ts"];
    const [adData, partnerData, countyData] = await Promise.all(paths.map((path) => import(path)));
    const texas = countyData.getCountiesForState("texas");
    const otherCounties = countyData.counties.filter((county: { state: { slug: string } }) => county.state.slug !== "texas");
    const hasGear = (key?: string) => adData.getAdsForSlot("inline", key).some((ad: { name: string }) => ad.name === "Guerrilla Gear");
    const videoCount = (key?: string) => adData.getAdsForSlot("inline", key).filter((ad: { video?: unknown }) => ad.video).length;
    const videoIds = (creatives: { video?: { watchUrl: string } }[]) => [...new Set(creatives
      .flatMap((ad) => ad.video ? [ad.video.watchUrl.split("/").pop()] : []))].sort().join(",");
    return {
      texasCount: texas.length,
      statewide: hasGear("texas"),
      everyTexasCounty: texas.every((county: { slug: string }) => hasGear(`texas/${county.slug}`) && partnerData.getPartnersForCounty(`texas/${county.slug}`).some((ad: { name: string }) => ad.name === "Guerrilla Gear")),
      noOtherCounty: otherCounties.every((county: { state: { slug: string }; slug: string }) => !hasGear(`${county.state.slug}/${county.slug}`)),
      national: hasGear(),
      removed: adData.ads.filter((ad: { name: string }) => /Pasture Exchange|PestCon/.test(ad.name)).length,
      texasPartnerPageCount: partnerData.getCountyPartnerPageKeys().filter((key: string) => key.startsWith("texas/")).length,
      scopedRealty: [undefined, "texas", "texas/randall", "texas/potter", "texas/harris"].map((key) => adData.getAdsForSlot("inline", key).some((ad: { id: string }) => ad.id === "lori-horner-inline")),
      everyTexasCountyHasVideos: texas.every((county: { slug: string }) => videoCount(`texas/${county.slug}`) === expectedVideoIds.length),
      everyTexasEditionHasFullShowcase: ["texas", ...texas.map((county: { slug: string }) => `texas/${county.slug}`)].every((key) =>
        videoIds(adData.getAdsForSlot("inline", key)) === expectedVideoIds.join(",") &&
        videoIds(adData.getInFeedAdRotation(key)) === expectedVideoIds.join(",")),
      noVideosElsewhere: !videoCount() && !videoCount("arkansas") && otherCounties.every((county: { state: { slug: string }; slug: string }) => !videoCount(`${county.state.slug}/${county.slug}`)),
      videosCannotSponsor: adData.ads.filter((ad: { video?: unknown }) => ad.video).every((ad: unknown) => !adData.canSponsorFeed(ad)),
      onePanhandlePartner: partnerData.getPartnerCreatives().filter((ad: { name: string }) => ad.name === "Panhandle Legends").length,
      everyTexasCountyHasPartner: texas.every((county: { slug: string }) => partnerData.getPartnersForCounty(`texas/${county.slug}`).some((ad: { name: string }) => ad.name === "Panhandle Legends")),
    };
  }, showcaseVideoIds);
  expect(result).toEqual({ texasCount: 254, statewide: true, everyTexasCounty: true, noOtherCounty: true, national: false, removed: 0, texasPartnerPageCount: 254, scopedRealty: [false, false, true, true, false], everyTexasCountyHasVideos: true, everyTexasEditionHasFullShowcase: true, noVideosElsewhere: true, videosCannotSponsor: true, onePanhandlePartner: 1, everyTexasCountyHasPartner: true });
  await expect(page.getByRole("heading", { name: "Guerrilla Gear", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Panhandle Legends", exact: true })).toHaveCount(1);
  await page.goto("/texas/harris/partners");
  await expect(page.getByRole("heading", { name: "Guerrilla Gear", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Panhandle Legends", exact: true })).toHaveCount(1);
  await page.goto("/arkansas/polk/partners");
  await expect(page.getByRole("heading", { name: "Guerrilla Gear", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Panhandle Legends", exact: true })).toHaveCount(0);
});

test("Panhandle videos occur in Texas feeds and carousels without loading players or becoming sponsors", async ({ page }) => {
  // Every fifth in-feed ad is a video, so feeds long enough for five or more ads show one
  // wherever their rotation starts; short fixtures would depend on each feed's starting point.
  await mockNews(page, 48);
  for (const path of ["/texas", "/texas/randall", "/texas/harris"]) {
    await page.goto(path);
    await expect(page.locator(".ad-slot-inline").first().locator(".video-ad")).toHaveCount(9);
    for (const carousel of await page.locator(".ad-slot-inline").all()) {
      await expect(carousel.locator(".video-ad")).toHaveCount(9);
    }
    await expect(page.locator(".feed-video-card").first()).toBeAttached();
    await expect(page.locator("iframe[src*='player.vimeo.com']")).toHaveCount(0);
    await expect(page.locator(".feed-sponsor img[alt*='Panhandle'], .county-sponsor img[alt*='Panhandle']")).toHaveCount(0);
    const videos = await page.locator(".feed-video-card").count();
    const ads = await page.locator(".feed-ad-card").count();
    expect(videos).toBeLessThan(ads / 2);
    await expect(page.getByRole("img", { name: /Pasture Exchange|PestCon/ })).toHaveCount(0);
  }
  for (const path of ["/", "/arkansas", "/arkansas/polk"]) {
    await page.goto(path);
    await expect(page.locator(".ad-slot-inline").first()).toBeAttached();
    await expect(page.locator(".video-ad")).toHaveCount(0);
  }
});

test("all nine showcase cards load the matching player only when played", async ({ page }) => {
  await page.clock.install();
  await page.route("https://player.vimeo.com/video/**", (route) => route.fulfill({ contentType: "text/html", body: "<html><body>Video player fixture</body></html>" }));
  await page.goto("/texas");
  await page.locator(".feed-source").nth(2).waitFor({ state: "attached" });
  const carousel = page.locator(".ad-slot-inline").first();
  await expect(carousel.locator(".video-ad")).toHaveCount(9);
  for (const id of showcaseVideoIds) {
    const video = carousel.locator(`.video-ad:has(a[href='https://vimeo.com/${id}'])`);
    await video.scrollIntoViewIfNeeded();
    await video.locator("img").evaluate((image: HTMLImageElement) => image.decode());
    await expect(page.locator("iframe[src*='player.vimeo.com']")).toHaveCount(0);
    await video.getByRole("button", { name: /^Play Panhandle Legends:/ }).click();
    await expect(video.locator("iframe")).toHaveAttribute("src", `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1&title=0&byline=0&portrait=0`);
    await video.getByRole("button", { name: "Close video", exact: true }).click();
  }
  await expect(page.locator("iframe[src*='player.vimeo.com']")).toHaveCount(0);
});

test("video carousel waits during playback and stops an offscreen player", async ({ page }) => {
  await page.clock.install();
  await page.route("https://player.vimeo.com/video/**", (route) => route.fulfill({ contentType: "text/html", body: "<html><body>Video player fixture</body></html>" }));
  await page.goto("/texas");
  await page.locator(".feed-source").nth(2).waitFor({ state: "attached" });
  const video = page.locator(".ad-slot-inline .video-ad").first();
  await video.scrollIntoViewIfNeeded();
  await video.locator("img").evaluate((image: HTMLImageElement) => image.decode());
  await video.getByRole("button", { name: /^Play Panhandle Legends:/ }).click();
  await expect(video.locator("iframe")).toHaveAttribute("src", /player\.vimeo\.com\/video\/1215218560\?autoplay=1/);
  const track = page.locator(".ad-slot-inline .ad-slot-items");
  const scrollLeft = await track.evaluate((element) => element.scrollLeft);
  await page.clock.fastForward(21000);
  await expect(video.locator("iframe")).toHaveCount(1);
  expect(await track.evaluate((element) => element.scrollLeft)).toBe(scrollLeft);
  await page.screenshot({ path: "test-results/panhandle-carousel.png" });
  await track.evaluate((element) => element.scrollTo({ left: 0, behavior: "instant" }));
  await expect(video.locator("iframe")).toHaveCount(0);
});

test("bookmark reminder opens only on county homepages, shows instructions without action buttons, and stays closed on this device", async ({ page }) => {
  for (const path of ["/", "/texas", "/texas/randall/weather"]) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Bookmark / Add web app" })).toBeAttached();
    await expect(page.locator(".feed-card, .weather-page").first()).toBeVisible();
    await expect(page.locator(".bookmark-toast")).toHaveCount(0);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Bookmark / Add web app" }).click();
  const national = page.getByRole("complementary", { name: "Bookmark The County Post", exact: true });
  await expect(national.getByText("Ctrl+D", { exact: true })).toBeVisible();
  await expect(national.getByRole("link")).toHaveCount(0);

  await page.goto("/texas/randall");
  const prompt = page.getByRole("complementary", { name: "Bookmark Randall County", exact: true });
  await expect(prompt).toBeVisible();
  expect(await prompt.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.width <= 330 && innerWidth - bounds.right === 16 && innerHeight - bounds.bottom === 16;
  })).toBe(true);
  await expect(prompt.getByText("Ctrl+D", { exact: true })).toBeVisible();
  await expect(prompt.getByRole("button")).toHaveCount(1);
  await expect(prompt.getByRole("link")).toHaveCount(0);
  await page.screenshot({ path: "test-results/bookmark-desktop.png" });
  await prompt.getByRole("button", { name: "Dismiss bookmark reminder" }).click();
  await page.reload();
  await expect(page.locator(".feed-card").first()).toBeVisible();
  await expect(prompt).toHaveCount(0);
  // A later visit in a new tab shares the device's storage, not the session's.
  const later = await page.context().newPage();
  await mockNews(later);
  await later.goto("/texas/randall");
  await expect(later.locator(".feed-card").first()).toBeVisible();
  await expect(later.locator(".bookmark-toast")).toHaveCount(0);
  await later.close();

  await page.goto("/texas/harris");
  const harris = page.getByRole("complementary", { name: "Bookmark Harris County", exact: true });
  await expect(harris).toBeVisible();
  await page.keyboard.press("Control+D");
  await expect(harris).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".feed-card").first()).toBeVisible();
  await expect(harris).toHaveCount(0);
  await page.goto("/texas/randall/weather");
  await page.getByRole("button", { name: "Bookmark / Add web app" }).click();
  await expect(prompt.getByRole("link", { name: "Open the Randall County homepage" })).toHaveAttribute("href", "/texas/randall");
});

test("phone reminders show that device's bookmark and Home Screen steps and fit a narrow screen", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 320, height: 640 } });
  const page = await context.newPage();
  await mockNews(page);
  await page.goto(`${baseURL}/texas/randall`);
  const prompt = page.locator(".bookmark-toast");
  await expect(prompt.getByText("Add Bookmark", { exact: true })).toBeVisible();
  await expect(prompt.getByText("Add to Home Screen", { exact: true })).toBeVisible();
  await expect(prompt.getByText(/Ctrl\+D|three dots/)).toHaveCount(0);
  await expect(prompt.getByRole("button")).toHaveCount(1);
  expect(await prompt.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight && element.scrollWidth <= element.clientWidth;
  })).toBe(true);
  await page.screenshot({ path: "test-results/bookmark-iphone.png" });
  await context.close();

  const android = await browser.newContext({ ...devices["Pixel 7"] });
  const androidPage = await android.newPage();
  await mockNews(androidPage);
  await androidPage.goto(`${baseURL}/texas/randall`);
  const androidPrompt = androidPage.locator(".bookmark-toast");
  await expect(androidPrompt.getByText("Add to Home screen", { exact: true })).toBeVisible();
  await expect(androidPrompt.getByText(/Ctrl\+D|Add Bookmark/)).toHaveCount(0);
  await android.close();
});

test("installed mode suppresses the automatic prompt and blocked storage still allows dismissal", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }));
  await page.goto("/texas/randall");
  await expect(page.getByRole("button", { name: "Bookmark / Add web app" })).toBeAttached();
  await expect(page.locator(".bookmark-toast")).toHaveCount(0);
  await page.getByRole("button", { name: "Bookmark / Add web app" }).click();
  await expect(page.locator(".bookmark-toast")).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("Storage unavailable"); } });
  });
  await page.getByRole("button", { name: "Dismiss bookmark reminder" }).click();
  await expect(page.locator(".bookmark-toast")).toHaveCount(0);
});

test("edition home pages show the banner below the lead feed and the square carousel at the bottom", async ({ page }) => {
  for (const path of ["/", "/oklahoma", "/oklahoma/tulsa", "/oklahoma/rogers"]) {
    await page.goto(path);
    const banner = page.locator("main .layout-grid > .ad-slot-banner");
    await expect(banner, path).toHaveCount(1);
    await expect(page.locator("main + .ad-slot-inline"), path).toHaveCount(1);
    await expect(page.locator("main + .ad-slot-banner"), path).toHaveCount(0);
    await expect(page.locator("main .ad-slot-inline:not(.ad-slot-meter)"), path).toHaveCount(0);
    if (path.startsWith("/oklahoma/")) {
      await expect(banner.locator('a[href="https://www.barrettfinancial.com/"] img[src*="darryl-bergstresser-banner"]'), path).toHaveCount(1);
    }
  }
  // Subpages keep the banner at the bottom.
  await page.goto("/oklahoma/tulsa/partners");
  await expect(page.locator("main + .ad-slot-banner")).toHaveCount(1);
});

test("Texas desks display both campaign formats and banners remain selectable", async ({ page }) => {
  for (const path of ["/texas", "/texas/harris"]) {
    await page.goto(path);
    for (const [id, name, publisher] of [["ken-paxton", "Ken Paxton", "GOP Connect LLC."], ["greg-abbott", "Greg Abbott", "Patriots Connect, LLC, d/b/a Patriots in Action. PatriotsInAction.com."]]) {
      const square = page.locator(`.ad-slot-inline img[src*="${id}-square"]`).first();
      expect(await square.getAttribute("alt")).toContain(`Published by ${publisher} Not authorized by any candidate or candidate’s committee.`);
      await square.evaluate((img: HTMLImageElement) => img.decode());
      expect(await square.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([600, 600]);
      await expect(square.locator("..")).toHaveAttribute("href", `https://patriotsinaction.com/${id}`);
      await page.getByRole("button", { name: `Show ${name} advertisement`, exact: true }).first().click();
      const banner = page.locator(`.ad-banner-slide.active img[src*="${id}-banner"]`).first();
      await expect(banner).toBeVisible();
      await banner.evaluate((img: HTMLImageElement) => img.decode());
      expect(await banner.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([980, 250]);
      await expect(banner.locator("..")).toHaveAttribute("href", `https://patriotsinaction.com/${id}`);
    }
  }
  for (const path of ["/", "/oklahoma", "/arkansas/polk"]) {
    await page.goto(path);
    await expect(page.locator('.ad-slot img[src*="ken-paxton"], .ad-slot img[src*="greg-abbott"]')).toHaveCount(0);
  }
});
