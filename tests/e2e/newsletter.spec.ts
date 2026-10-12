import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
  await page.route('http://localhost:8787/**', route => route.fulfill({ status: 503, json: {} }));
  await page.route('http://localhost:8788/defaults?**', route => route.fulfill({ json: { timeZone: 'America/Chicago' } }));
});

test('every edition signup can choose national, state or county and requires confirmation', async ({ page }) => {
  for (const [path, level, state, county] of [['/', 'national', '', ''], ['/texas', 'state', 'texas', ''], ['/texas/potter', 'county', 'texas', 'potter']]) {
    await page.goto(path);
    await expect(page.getByRole('combobox', { name: 'Newsletter edition', exact: true })).toHaveValue(level);
    if (state) await expect(page.getByRole('combobox', { name: 'State', exact: true })).toHaveValue(state);
    if (county) await expect(page.getByRole('combobox', { name: 'County', exact: true })).toHaveValue(county);
  }
  await page.getByRole('combobox', { name: 'Newsletter edition', exact: true }).selectOption('state');
  await page.getByRole('combobox', { name: 'State', exact: true }).selectOption('arizona');
  await page.getByRole('combobox', { name: '6:15 a.m. delivery timezone', exact: true }).selectOption('America/Phoenix');
  await page.getByLabel('Email address', { exact: true }).fill('reader@example.com');
  await page.getByRole('checkbox', { name: /Email me this daily edition/ }).check();
  let sent: Record<string, unknown> | undefined;
  await page.route('http://localhost:8788/subscribe', async route => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 202, json: { message: 'Check your inbox for a confirmation link.' } });
  });
  await page.getByRole('button', { name: 'Subscribe free', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Check your inbox' })).toBeVisible();
  expect(sent).toMatchObject({ consent: true, edition: { level: 'state', state: 'arizona', timeZone: 'America/Phoenix' } });
  await expect(page.getByRole('button', { name: 'Subscribe to another edition' })).toBeVisible();
});

test('confirmation and unsubscribe pages need deliberate actions, and tokens stay out of GA', async ({ page }) => {
  const token = 'a'.repeat(43);
  let posts = 0;
  await page.route('http://localhost:8788/confirm', route => { posts++; return route.fulfill({ json: { message: 'Subscription confirmed.' } }); });
  await page.goto(`/newsletter#confirm=${token}`);
  await expect(page.getByRole('button', { name: 'Confirm subscription', exact: true })).toBeVisible();
  expect(posts).toBe(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  const analytics = await page.evaluate(() => JSON.stringify((window as unknown as { dataLayer: unknown[] }).dataLayer));
  expect(analytics).not.toContain(token);
  await page.getByRole('button', { name: 'Confirm subscription', exact: true }).click();
  expect(posts).toBe(1);
  await expect(page.getByRole('status')).toHaveText('Subscription confirmed.');
  await page.goto(`/newsletter#unsubscribe=${token}`);
  await expect(page.getByRole('button', { name: 'Unsubscribe', exact: true })).toBeVisible();
});

test('newsletter campaign attribution survives clean SEO canonicals and anchors reach desks', async ({ page }) => {
  await page.goto('/texas/potter?utm_source=the_county_post&utm_medium=email&utm_campaign=morning_post_2026-10-12&utm_content=county_texas_potter_sports#desk-sports');
  await expect(page.locator('#desk-sports')).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://thecountypost.com/texas/potter');
  await expect.poll(async () => page.evaluate(() => JSON.stringify((window as unknown as { dataLayer: unknown[] }).dataLayer))).toContain('utm_medium=email');
});

test('signup errors are honest and mobile form fits small phones', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.route('http://localhost:8788/subscribe', route => route.fulfill({ status: 503, json: { error: 'Newsletter delivery is being prepared.' } }));
  await page.goto('/newsletter');
  await page.getByRole('combobox', { name: 'Newsletter edition', exact: true }).selectOption('county');
  await page.getByRole('combobox', { name: 'State', exact: true }).selectOption('texas');
  await page.getByRole('combobox', { name: 'County', exact: true }).selectOption('potter');
  await page.getByLabel('Email address', { exact: true }).fill('reader@example.com');
  await page.getByRole('checkbox', { name: /Email me this daily edition/ }).check();
  await page.getByRole('button', { name: 'Subscribe free', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Newsletter delivery is being prepared.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.newsletter').screenshot({ path: 'test-results/newsletter-mobile.png' });
});

test('sponsor handoff records the edition and campaign and rejects ineligible advertisers', async ({ page }) => {
  const events: unknown[] = [];
  await page.exposeFunction('captureNewsletterEvent', (event: unknown) => events.push(event));
  await page.addInitScript(() => {
    const dataLayer: unknown[] = [];
    dataLayer.push = (...items: unknown[]) => {
      for (const item of items) {
        const args = Array.from(item as ArrayLike<unknown>);
        if (args[1] === 'newsletter_sponsor_click') (window as unknown as { captureNewsletterEvent: (event: unknown) => void }).captureNewsletterEvent(args);
      }
      return Array.prototype.push.apply(dataLayer, items);
    };
    (window as unknown as { dataLayer: unknown[] }).dataLayer = dataLayer;
  });
  const navigation: string[] = [];
  page.on('request', request => { if (request.isNavigationRequest() && request.url().startsWith('https://')) navigation.push(request.url()); });
  await page.goto('/newsletter/sponsor?ad=pia-banner&edition=county%2Ftexas%2Fpotter&utm_source=the_county_post&utm_medium=email&utm_campaign=morning_post_2026-10-12');
  await expect.poll(() => events.length).toBeGreaterThan(0);
  expect(events[0]).toMatchObject(['event', 'newsletter_sponsor_click', { advertiser_id: 'pia-banner', newsletter_edition: 'county/texas/potter', campaign: 'morning_post_2026-10-12' }]);
  await expect.poll(() => navigation.length).toBeGreaterThan(0);
  expect(new URL(navigation[0]).searchParams.get('utm_medium')).toBe('email');
  await page.goto('/newsletter/sponsor?ad=lori-horner-inline&edition=county%2Ftexas%2Ftravis');
  await expect(page.getByRole('heading', { name: 'This sponsor is no longer available' })).toBeVisible();
  await page.goto('/newsletter/sponsor?ad=removed-ad&url=https%3A%2F%2Fexample.com');
  await expect(page.getByRole('heading', { name: 'This sponsor is no longer available' })).toBeVisible();
});
