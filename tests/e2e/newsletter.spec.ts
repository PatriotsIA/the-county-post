import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
  await page.route('http://localhost:8787/**', route => route.fulfill({ status: 503, json: {} }));
  await page.route('http://localhost:8788/defaults?**', route => route.fulfill({ json: { timeZone: 'America/Chicago' } }));
});

test('compact live edition search supports county, state and national subscriptions', async ({ page }) => {
  for (const [path, label] of [['/', 'National edition'], ['/texas', 'Texas edition'], ['/texas/potter', 'Potter County, Texas']]) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('combobox', { name: 'Your edition', exact: true })).toHaveValue(label);
  }
  const form = page.getByRole('form', { name: 'Morning Post signup', exact: true });
  const search = form.getByRole('combobox', { name: 'Your edition' });
  await search.fill('potter');
  await expect(page.getByRole('option', { name: 'Potter County, Texas County', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Potter County, Pennsylvania County', exact: true })).toBeVisible();
  await search.fill('potter tx');
  await search.press('ArrowDown');
  await search.press('Enter');
  await expect(search).toHaveValue('Potter County, Texas');
  await search.fill('arizona');
  await page.getByRole('option', { name: 'Arizona edition Statewide', exact: true }).click();
  await form.getByText('Delivery time', { exact: true }).click();
  await form.getByRole('combobox', { name: '6:15 a.m. delivery timezone' }).selectOption('America/Phoenix');
  await form.getByLabel('Email address', { exact: true }).fill('reader@example.com');
  await form.getByRole('checkbox').check();
  let sent: Record<string, unknown> | undefined;
  await page.route('http://localhost:8788/subscribe', async route => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 202, json: { message: 'Check your inbox for a confirmation link.' } });
  });
  await form.getByRole('button', { name: 'Subscribe free' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Check your inbox' })).toBeVisible();
  expect(sent).toMatchObject({ consent: true, edition: { level: 'state', state: 'arizona', timeZone: 'America/Phoenix' } });
  await page.getByRole('button', { name: 'Subscribe to another edition' }).click();
  await search.fill('national');
  await page.getByRole('option', { name: 'National edition Across the U.S.' }).click();
  await expect(search).toHaveValue('National edition');
});

test('search never subscribes to a stale edition after unmatched typing', async ({ page }) => {
  let posts = 0;
  await page.route('http://localhost:8788/subscribe', route => { posts++; return route.fulfill({ json: {} }); });
  await page.goto('/texas/potter');
  const form = page.getByRole('form', { name: 'Morning Post signup', exact: true });
  await form.getByRole('combobox', { name: 'Your edition' }).fill('zzzzzzzz');
  await expect(page.getByRole('status').filter({ hasText: 'No matching editions' })).toBeVisible();
  await form.getByLabel('Email address').fill('reader@example.com');
  await form.getByRole('checkbox').check();
  await form.getByRole('button', { name: 'Subscribe free' }).click();
  await expect(form.getByRole('alert')).toContainText('Choose an edition');
  expect(posts).toBe(0);
});

test('footer signup follows the current county, state or national page with no edition fields', async ({ page }) => {
  const sent: Record<string, unknown>[] = [];
  await page.route('http://localhost:8788/subscribe', async route => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ status: 202, json: { message: 'Check your inbox for a confirmation link.' } });
  });
  await page.goto('/texas/potter/weather');
  for (const [path, expected] of [
    ['/texas/potter/weather', { level: 'county', state: 'texas', county: 'potter' }],
    ['/texas', { level: 'state', state: 'texas' }],
    ['/', { level: 'national' }],
  ] as const) {
    if (path !== '/texas/potter/weather') {
      // Follow the app's own breadcrumb links: context must update without a reload.
      await page.locator(`.breadcrumbs a[href="${path}"]`).first().click();
    }
    const form = page.getByRole('form', { name: 'Footer Morning Post signup' });
    await expect(form.getByRole('combobox')).toHaveCount(0);
    await form.getByLabel('Email address').fill('reader@example.com');
    await form.getByRole('checkbox').check();
    await form.getByRole('button', { name: 'Subscribe free' }).click();
    await expect(page.locator('footer').getByRole('status')).toContainText('Check your inbox');
    expect(sent.at(-1)).toMatchObject({ consent: true, edition: expected });
    if (expected.level !== 'national') expect((sent.at(-1)!.edition as Record<string, unknown>).timeZone).toBeUndefined();
  }
});

test('Morning Post landing page explains the benefits and has its own navigation and metadata', async ({ page }) => {
  await page.goto('/morning-post');
  await expect(page.getByRole('heading', { name: 'The Morning Post', exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Morning Post', exact: true }).first()).toHaveClass(/active/);
  await expect(page.getByRole('heading', { name: 'Weather before you head out' })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://thecountypost.com/morning-post');
  await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute('content', /noindex/);
  await page.locator('.morning-post-page').screenshot({ path: 'test-results/morning-post-desktop.png' });
  const height = await page.locator('main .newsletter-signup').evaluate(el => el.getBoundingClientRect().height);
  expect(height).toBeLessThan(320);
  await page.goto('/newsletter?utm_source=the_county_post&utm_medium=email');
  await expect(page).toHaveURL(/morning-post\?utm_source=the_county_post&utm_medium=email/);
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
  await page.goto('/morning-post');
  const form = page.getByRole('form', { name: 'Morning Post signup', exact: true });
  await form.getByRole('combobox', { name: 'Your edition' }).fill('potter tx');
  await page.getByRole('option', { name: 'Potter County, Texas County', exact: true }).click();
  await form.getByLabel('Email address', { exact: true }).fill('reader@example.com');
  await form.getByRole('checkbox').check();
  await form.getByRole('button', { name: 'Subscribe free' }).click();
  await expect(form.getByRole('alert')).toHaveText('Newsletter delivery is being prepared.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.morning-post-page').screenshot({ path: 'test-results/morning-post-mobile.png' });
  await page.locator('footer .newsletter').screenshot({ path: 'test-results/morning-post-footer-mobile.png' });
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

test('every signup links to the gift form and carries its edition and sender email privately', async ({ page }) => {
  for (const [path, label, hasMainSignup] of [
    ['/morning-post', 'National edition', true],
    ['/', 'National edition', true],
    ['/texas', 'Texas edition', true],
    ['/texas/potter', 'Potter County, Texas', true],
    ['/texas/potter/weather', 'Potter County, Texas', false],
    ['/texas/potter/partners', 'Potter County, Texas', false],
    ['/partners', 'National edition', false],
    ['/itm-trading', 'National edition', false],
  ] as const) {
    for (const selector of hasMainSignup ? ['main .newsletter-signup', 'footer .newsletter-signup'] : ['footer .newsletter-signup']) {
      await page.goto(path);
      const scope = page.locator(selector);
      const button = scope.getByRole('link', { name: 'Give the Gift of The Morning Post', exact: true });
      await expect(button).toHaveAttribute('href', '/morning-post#morning-post-gift');
      await scope.getByLabel('Email address', { exact: true }).fill('sender@example.com');
      await button.click();
      await expect(page).toHaveURL(/\/morning-post#morning-post-gift$/);
      const gift = page.getByRole('form', { name: 'Give the Gift of The Morning Post' });
      await expect(gift.getByLabel('Your email address', { exact: true })).toHaveValue('sender@example.com');
      await expect(gift.getByRole('combobox', { name: 'Recipient’s edition' })).toHaveValue(label);
      await expect(page.getByRole('heading', { name: 'Give the Gift of The Morning Post' })).toBeFocused();
      expect(page.url()).not.toContain('sender');
    }
  }
  await page.goto('/morning-post#morning-post-gift');
  await expect(page.getByRole('heading', { name: 'Give the Gift of The Morning Post' })).toBeInViewport();
  await expect(page.getByRole('form', { name: 'Give the Gift of The Morning Post' }).getByLabel('Your email address', { exact: true })).toBeEmpty();
});

test('gifts select county, state or national editions and send only an invitation', async ({ page }) => {
  const sent: Record<string, any>[] = [];
  const analyticsRequests: string[] = [];
  page.on('request', request => {
    if (/google-analytics\.com|analytics\.google\.com/.test(new URL(request.url()).hostname)) analyticsRequests.push(decodeURIComponent(`${request.url()} ${request.postData() || ''}`));
  });
  let subscriptions = 0;
  await page.route('http://localhost:8788/subscribe', route => { subscriptions++; return route.fulfill({ json: {} }); });
  await page.route('http://localhost:8788/invite', route => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({ status: 202, json: { message: 'Your invitation request has been received. Their free subscription starts only after they confirm.' } });
  });
  await page.goto('/morning-post');
  await page.locator('main .newsletter-signup').getByRole('link', { name: 'Give the Gift of The Morning Post' }).click();
  await expect(page.getByRole('heading', { name: 'Give the Gift of The Morning Post' })).toBeFocused();
  const signup = page.locator('#morning-post-gift');
  for (const [query, option, edition] of [
    ['potter tx', 'Potter County, Texas County', { level: 'county', state: 'texas', county: 'potter' }],
    ['arizona', 'Arizona edition Statewide', { level: 'state', state: 'arizona' }],
    ['national', 'National edition Across the U.S.', { level: 'national', timeZone: 'America/New_York' }],
  ] as const) {
    const gift = signup.getByRole('form', { name: 'Give the Gift of The Morning Post' });
    await gift.getByLabel('Your name', { exact: true }).fill('Jamie Reader');
    await gift.getByLabel('Your email address', { exact: true }).fill('sender@example.com');
    await gift.getByLabel('Recipient’s email address', { exact: true }).fill('friend@example.com');
    await gift.getByRole('combobox', { name: 'Recipient’s edition' }).fill(query);
    await gift.getByRole('option', { name: option, exact: true }).click();
    if (edition.level === 'national') {
      await gift.getByText('Recipient’s delivery time', { exact: true }).click();
      await gift.getByRole('combobox', { name: '6:15 a.m. delivery timezone' }).selectOption('America/New_York');
    }
    await gift.getByRole('checkbox').check();
    await gift.getByRole('button', { name: 'Send free invitation' }).click();
    await expect(signup.getByRole('status')).toContainText('only after they confirm');
    expect(sent.at(-1)).toMatchObject({ senderName: 'Jamie Reader', senderEmail: 'sender@example.com', recipientEmail: 'friend@example.com', consent: true, edition });
    if (edition.level !== 'national') expect(sent.at(-1)!.edition.timeZone).toBeUndefined();
    await signup.getByRole('button', { name: 'Give another gift' }).click();
  }
  expect(subscriptions).toBe(0);
  // GTM also keeps DOM references internally; inspect event payloads and outgoing
  // requests, rather than serializing live form elements (which contain inputs).
  const analytics = await page.evaluate(() => JSON.stringify((window as unknown as { dataLayer: Record<number, unknown>[] }).dataLayer.filter(entry => entry[0] === 'event')));
  for (const email of ['sender@example.com', 'friend@example.com']) {
    expect(analytics).not.toContain(email); expect(analyticsRequests.join('\n')).not.toContain(email);
  }
});

test('gift errors preserve inputs and the footer gift button reaches a form that fits a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  let posts = 0;
  await page.route('http://localhost:8788/invite', route => { posts++; return route.fulfill({ status: 503, json: { error: 'Unable to send the invitation. Please try again.' } }); });
  await page.goto('/texas/potter/weather');
  await page.locator('footer .newsletter-signup').getByRole('link', { name: 'Give the Gift of The Morning Post' }).click();
  const signup = page.locator('#morning-post-gift');
  const gift = signup.getByRole('form', { name: 'Give the Gift of The Morning Post' });
  await gift.getByLabel('Your name', { exact: true }).fill('Jamie Reader');
  await gift.getByLabel('Your email address', { exact: true }).fill('sender@example.com');
  await gift.getByLabel('Recipient’s email address', { exact: true }).fill('sender@example.com');
  await gift.getByRole('checkbox').check();
  await gift.getByRole('button', { name: 'Send free invitation' }).click();
  await expect(gift.getByRole('alert')).toContainText('someone else');
  expect(posts).toBe(0);
  await gift.getByLabel('Recipient’s email address', { exact: true }).fill('friend@example.com');
  await gift.getByRole('combobox', { name: 'Recipient’s edition' }).fill('nonexistent edition');
  await gift.getByRole('button', { name: 'Send free invitation' }).click();
  await expect(gift.getByRole('alert')).toContainText('Choose an edition');
  expect(posts).toBe(0);
  await gift.getByRole('combobox', { name: 'Recipient’s edition' }).fill('potter tx');
  await gift.getByRole('option', { name: 'Potter County, Texas County', exact: true }).click();
  await gift.getByRole('button', { name: 'Send free invitation' }).click();
  await expect(gift.getByRole('alert')).toContainText('Unable to send');
  await expect(gift.getByLabel('Recipient’s email address', { exact: true })).toHaveValue('friend@example.com');
  expect(posts).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await signup.screenshot({ path: 'test-results/morning-post-gift-mobile.png' });
});
