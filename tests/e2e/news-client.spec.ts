import { expect, test } from "@playwright/test";

test("a failing feed retries independently while other desks remain available", async ({ page }) => {
  let sportsRequests = 0;
  await page.route("http://localhost:8787/v1/feeds/national/sports*", route => {
    sportsRequests++;
    return route.fulfill({ status: sportsRequests < 3 ? 503 : 200, contentType: "application/json",
      body: JSON.stringify({ items: [{ id: "sports", title: "Recovered sports", link: "https://example.com/sports" }] }) });
  });
  await page.route("http://localhost:8787/v1/feeds/national/crime*", route => route.fulfill({ status: 404, body: "missing" }));
  await page.route("http://localhost:8787/v1/feeds/national/politics*", route => route.fulfill({ contentType: "application/json",
    body: JSON.stringify({ items: [{ id: "politics", title: "Available politics", link: "https://example.com/politics" }] }) }));
  await page.goto("/about");
  const result = await page.evaluate(async () => {
    const modulePath = "/src/lib/news-api.ts";
    const api = await import(/* @vite-ignore */ modulePath);
    await api.fetchNewsApiFeed("/v1/feeds/national/crime", 12).catch(() => undefined);
    const [sports, politics] = await Promise.all([
      api.fetchNewsApiFeed("/v1/feeds/national/sports", 12),
      api.fetchNewsApiFeed("/v1/feeds/national/politics", 12),
    ]);
    return { sports: sports.items[0].id, politics: politics.items[0].id, configured: api.isNewsApiConfigured() };
  });
  expect(result).toEqual({ sports: "sports", politics: "politics", configured: true });
  expect(sportsRequests).toBe(3);
});

test("deduplicates requests and bounds stale fallback without extending its age", async ({ page }) => {
  let calls = 0;
  let unavailable = false;
  await page.route("http://localhost:8787/v1/feeds/national/sports*", route => {
    calls++;
    return route.fulfill({ status: unavailable ? 404 : 200, contentType: "application/json",
      body: JSON.stringify({ items: [{ id: "cached", title: "Cached sports", link: "https://example.com/sports" }] }) });
  });
  await page.goto("/about");
  await page.evaluate(async () => {
    const modulePath = "/src/lib/news-api.ts";
    const api = await import(/* @vite-ignore */ modulePath);
    await Promise.all(Array.from({ length: 3 }, () => api.fetchNewsApiFeed("/v1/feeds/national/sports", 12)));
  });
  expect(calls).toBe(1);
  unavailable = true;
  const result = await page.evaluate(async () => {
    const modulePath = "/src/lib/news-api.ts";
    const api = await import(/* @vite-ignore */ modulePath);
    const realNow = Date.now;
    const started = realNow();
    try {
      Date.now = () => started + 61_000;
      const stale = await api.fetchNewsApiFeed("/v1/feeds/national/sports", 12);
      Date.now = () => started + 16 * 60_000;
      const expired = await api.fetchNewsApiFeed("/v1/feeds/national/sports", 12).then(() => false, () => true);
      return { stale: stale.items[0].id, expired };
    } finally { Date.now = realNow; }
  });
  expect(result).toEqual({ stale: "cached", expired: true });
  expect(calls).toBe(3);
});
