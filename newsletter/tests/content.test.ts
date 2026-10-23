import { describe, expect, it } from 'vitest';
import { validateEdition, validateEmail, suggestedZone, localDate, weatherCounties, sectionUrl, storyId } from '../src/model';
import { recentStories, renderDigest, storyRecords, type Digest } from '../src/content';
import { selectSponsors, type Catalog } from '../src/sponsors';
import { analyticsEvent, trackedUrl } from '../src/tracking';

const county = { level: 'county' as const, state: 'texas', county: 'potter', timeZone: 'America/Chicago' };
const national = { level: 'national' as const, timeZone: 'America/New_York' };
describe('editions and scheduling', () => {
  it('validates county/state pairs, normalizes emails, and rejects injection', () => {
    expect(validateEdition(county)).toEqual(county);
    expect(() => validateEdition({ ...county, state: 'hawaii' })).toThrow();
    expect(() => validateEdition({ ...county, timeZone: 'not-a-timezone' })).toThrow();
    expect(validateEmail(' Reader@EXAMPLE.com ')).toBe('reader@example.com');
    expect(() => validateEmail('reader@example.com\r\nBcc: attacker@example.com')).toThrow();
  });
  it('handles Texas borders, Arizona, Hawaii, and local date boundaries', () => {
    expect(suggestedZone(county)).toBe('America/Chicago');
    expect(suggestedZone({ ...county, county: 'el-paso' })).toBe('America/Denver');
    expect(suggestedZone({ level: 'county', state: 'arizona', county: 'maricopa' })).toBe('America/Phoenix');
    expect(suggestedZone({ level: 'state', state: 'hawaii' })).toBe('Pacific/Honolulu');
    expect(localDate('America/Chicago', new Date('2026-10-13T01:00:00Z'))).toBe('2026-10-12');
    expect(weatherCounties(county).map(c => c.slug)).toEqual(['potter']);
    expect(weatherCounties(national)).toHaveLength(3);
  });
});
describe('content safety and attribution', () => {
  it('keeps the newest dated stories, excludes stale/undated/future items, and deduplicates', () => {
    const now = new Date('2026-10-12T12:00:00Z');
    const story = { title: 'Local news', publishedAt: '2026-10-12T10:00:00Z', source: 'Local paper' };
    const items = [story, story, { ...story, title: 'Earlier news', publishedAt: '2026-10-11T10:00:00Z' }, { ...story, title: 'Old news', publishedAt: '2026-09-01T00:00:00Z' }, { ...story, title: 'Undated', publishedAt: undefined }, { ...story, title: 'Future', publishedAt: '2027-01-01T00:00:00Z' }];
    expect(recentStories(items, 'general', county, now, new Set()).map(s => s.title)).toEqual(['Local news', 'Earlier news']);
    expect(recentStories(items, 'general', county, now, new Set())[0].url).toBe(sectionUrl(county, 'general'));
  });
  it('links each story to its County Post page and saves only what that page shows', () => {
    const now = new Date('2026-10-12T12:00:00Z');
    const item = { title: 'Council approves budget', publishedAt: '2026-10-12T10:00:00Z', source: 'Amarillo Globe-News', link: 'https://www.amarillo.com/story/news/1', description: '<p>The council voted 4&amp;1.</p>', imageUrl: 'https://www.amarillo.com/photo.jpg' };
    const items = [item, { ...item, title: 'Our column', link: '/op-eds/our-column', publishedAt: '2026-10-12T09:00:00Z' }, { ...item, title: 'No link', link: 'javascript:alert(1)', publishedAt: '2026-10-12T08:00:00Z' }];
    const [external, original, unlinked] = recentStories(items, 'general', county, now, new Set());
    const id = storyId(county, item.link);
    expect(id).toMatch(/^[a-f0-9]{20}$/);
    expect(storyId(national, item.link)).not.toBe(id);
    expect(external).toMatchObject({ id, url: `https://thecountypost.com/texas/potter/story/${id}`, link: item.link, description: 'The council voted 4&1.', imageUrl: item.imageUrl });
    expect(recentStories([item], 'general', national, now, new Set())[0].url).toBe(`https://thecountypost.com/story/${storyId(national, item.link)}`);
    expect(original.url).toBe('https://thecountypost.com/op-eds/our-column');
    expect(unlinked.url).toBe(sectionUrl(county, 'general'));
    const digest = { edition: county, label: 'Potter County', url: '', builtAt: now.toISOString(), forecasts: [], sections: [{ title: 'Headlines', topic: 'general', url: sectionUrl(county, 'general'), stories: [external, original, unlinked] }] } as Digest;
    expect(storyRecords(digest, now)).toEqual([{ pk: `STORY#${id}`, id, title: item.title, source: item.source, link: item.link, publishedAt: item.publishedAt.replace('Z', '.000Z'), description: 'The council voted 4&1.', imageUrl: item.imageUrl, topic: 'general', deskTitle: 'Headlines', edition: { level: 'county', state: 'texas', county: 'potter' }, expires: now.getTime() / 1000 + 90 * 86400 }]);
  });
  it('escapes feed HTML, includes unsubscribe links and no fabricated forecast', () => {
    const digest: Digest = { edition: county, label: 'Potter County', url: 'https://thecountypost.com/texas/potter', builtAt: '2026-10-12T12:00:00Z', forecasts: [{ label: 'Potter County', url: 'https://thecountypost.com/texas/potter/weather', periods: [] }], sections: ['general', 'sports'].map(topic => ({ title: topic, url: sectionUrl(county, topic), stories: [{ title: '<script>alert(1)</script>', source: 'Publisher & Co', publishedAt: '2026-10-12T11:00:00Z', url: sectionUrl(county, topic) }] })) };
    const rendered = renderDigest(digest, { date: '2026-10-12', timeZone: county.timeZone, manageUrl: 'https://thecountypost.com/newsletter#manage=secret', unsubscribeUrl: 'https://thecountypost.com/newsletter#unsubscribe=secret', address: 'Business address' });
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('Publisher &amp; Co');
    expect(rendered.html).toContain('Forecast temporarily unavailable');
    expect(rendered.html).toContain('ses:no-track');
    expect(rendered.html).toContain('Business address');
    expect(rendered.text).toContain('utm_medium=email');
    expect(Buffer.byteLength(rendered.html)).toBeLessThan(100000);
  });
});
describe('sponsor scope and tracking', () => {
  const catalog: Catalog = { logo: 'https://thecountypost.com/logo.png', ads: [
    { id: 'pia-banner', name: 'PIA', slot: 'banner', image: '/pia.jpg', href: 'https://community.patriotsinaction.com', alt: 'PIA' },
    { id: 'merch-inline', name: 'Merch', slot: 'inline', image: '/merch.jpg', href: 'https://shop.patriotsinaction.com', alt: 'Merch' },
    { id: 'potter', name: 'Potter sponsor', slot: 'inline', image: '/potter.jpg', href: 'https://example.com', alt: 'Potter', countyKeys: ['texas/potter'] },
    { id: 'harris', name: 'Harris sponsor', slot: 'inline', image: '/harris.jpg', href: 'https://example.com', alt: 'Harris', countyKeys: ['texas/harris'] },
  ] };
  it('prefers PIA and includes only the matching county advertisers', () => {
    expect(selectSponsors(catalog, county, '2026-10-12').banner?.id).toBe('pia-banner');
    expect(selectSponsors(catalog, county, '2026-10-12').cards.map(ad => ad.id)).toEqual(['potter']);
    expect(selectSponsors(catalog, national, '2026-10-12').cards.map(ad => ad.id)).toEqual(['merch-inline']);
  });
  it('preserves section anchors and existing advertiser query parameters', () => {
    const url = new URL(trackedUrl('https://thecountypost.com/texas/potter?existing=yes#desk-sports', county, '2026-10-12', 'sports'));
    expect(url.hash).toBe('#desk-sports');
    expect(url.searchParams.get('existing')).toBe('yes');
    expect(url.searchParams.get('utm_content')).toBe('county_texas_potter_sports');
  });
  it('never forwards recipient identity or subscriber tokens to GA4', () => {
    const detail = { eventType: 'Open', mail: { messageId: 'ses-message', destination: ['private@example.com'], tags: { kind: ['daily'], edition: ['county_texas_potter'], edition_date: ['2026-10-12'] } }, open: { ipAddress: '192.0.2.1', userAgent: 'private agent' } };
    const event = analyticsEvent(detail)!;
    expect(event.name).toBe('newsletter_open');
    expect(JSON.stringify(event.payload)).not.toMatch(/private|192\.0\.2\.1|destination|userAgent/);
    expect(event.payload.client_id).toMatch(/^\d+\.\d+$/);
    expect(analyticsEvent({ ...detail, eventType: 'Click', click: { link: 'https://thecountypost.com/newsletter#manage=token' } })).toBeUndefined();
    expect(analyticsEvent({ ...detail, mail: { ...detail.mail, tags: { ...detail.mail.tags, kind: ['confirm'] } } })).toBeUndefined();
  });
});
