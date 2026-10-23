import { SITE, editionLabel, homePath, sectionUrl, storyId, storyUrl, weatherCounties, type Edition } from './model';
import { loadCatalog, type Catalog } from './sponsors';

// `url` is where the email links: the story's County Post page, a County Post original itself, or the desk when
// a feed item has no usable link. `id`, `link`, `description` and `imageUrl` are kept for the story page.
export type Story = { title: string; source: string; publishedAt: string; url: string; id?: string; link?: string; description?: string; imageUrl?: string };
export type Section = { title: string; topic?: string; url: string; stories: Story[] };
export type StoryRecord = { pk: string; id: string; title: string; source: string; link: string; publishedAt: string; description?: string; imageUrl?: string; topic: string; deskTitle: string; edition: Pick<Edition, 'level' | 'state' | 'county'>; expires: number };
// Readers open emails days or weeks later; story pages outlive the 14-day edition snapshots.
export const STORY_RETENTION_DAYS = 90;
export type Forecast = { label: string; url: string; periods: { name: string; start: string; summary: string; temperature?: number; rain?: number }[] };
export type Digest = { edition: Edition; catalog?: Catalog; label: string; url: string; builtAt: string; sections: Section[]; forecasts: Forecast[] };
const TOPICS = [['general', 'Headlines'], ['sports', 'Sports'], ['obituaries', 'Obituaries'], ['politics', 'Politics'], ['economy', 'Economy & business'], ['crime', 'Crime & courts']] as const;
export function recentStories(items: unknown[], topic: string, edition: Edition, now: Date, seen: Set<string>): Story[] {
  return items.flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    const time = typeof item.publishedAt === 'string' ? Date.parse(item.publishedAt) : NaN;
    const ageLimit = topic === 'obituaries' ? 7 * 86400_000 : 3 * 86400_000;
    if (!Number.isFinite(time) || time > now.getTime() + 300_000 || now.getTime() - time > ageLimit || typeof item.title !== 'string') return [];
    const title = plain(item.title).slice(0, 250);
    const link = webUrl(item.link);
    const own = link && ['thecountypost.com', 'www.thecountypost.com'].includes(new URL(link).hostname);
    const id = link && !own ? storyId(edition, link) : undefined;
    const description = typeof item.description === 'string' ? summary(plain(item.description)) : '';
    const imageUrl = webUrl(item.imageUrl);
    return [{ title, source: plain(typeof item.source === 'string' ? item.source : 'Source listed on the news desk'), publishedAt: new Date(time).toISOString(), url: own ? link : id ? storyUrl(edition, id) : sectionUrl(edition, topic),
      ...(id ? { id, link, ...(description && description !== title ? { description } : {}), ...(imageUrl?.startsWith('https:') ? { imageUrl } : {}) } : {}) }];
  }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).filter(item => {
    const key = item.title.toLowerCase().replace(/\W/g, '');
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, topic === 'general' ? 3 : 2);
}
export function storyRecords(d: Digest, now = new Date()): StoryRecord[] {
  const expires = Math.floor(now.getTime() / 1000) + STORY_RETENTION_DAYS * 86400;
  const edition = { level: d.edition.level, state: d.edition.state, county: d.edition.county };
  return d.sections.flatMap(s => s.topic ? s.stories.flatMap(story => story.id && story.link ? [{ pk: `STORY#${story.id}`, id: story.id, title: story.title, source: story.source, link: story.link, publishedAt: story.publishedAt, description: story.description, imageUrl: story.imageUrl, topic: s.topic!, deskTitle: s.title, edition, expires }] : []) : []);
}
function webUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try {
    const url = new URL(value, SITE);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}
function summary(text: string) {
  if (text.length <= 600) return text;
  const cut = text.slice(0, 600);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 400 ? cut.lastIndexOf(' ') : 600).replace(/[,;:.\s]+$/, '')}…`;
}
function plain(s: string) { return s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim(); }
async function json(path: string) {
  const base = process.env.NEWS_API_URL || 'https://d2vo13idhuovzg.cloudfront.net';
  const response = await fetch(`${base.replace(/\/$/, '')}${path}`, { signal: AbortSignal.timeout(45000), headers: { Origin: SITE } });
  if (!response.ok) throw new Error(`News service returned ${response.status}`);
  return response.json();
}
export async function buildDigest(e: Edition, now = new Date()): Promise<Digest> {
  const scope = e.level === 'national' ? 'national' : e.level === 'state' ? `states/${e.state}` : `counties/${e.state}/${e.county}`;
  const seen = new Set<string>();
  const results = await Promise.allSettled(TOPICS.map(([topic]) => json(`/v1/feeds/${scope}/${topic}?limit=30`)));
  const sections = TOPICS.map(([topic, title], i) => ({ title, topic, url: sectionUrl(e, topic), stories: recentStories(results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<{ items?: unknown[] }>).value.items || [] : [], topic, e, now, seen) }));
  if (!sections.some(s => s.stories.length)) throw new Error('No recent dated stories available; defer this edition instead of emailing an empty digest.');
  const forecasts = await Promise.all(weatherCounties(e).map(async county => {
    const forecast: Forecast = { label: `${county.displayName}, ${county.state.abbr}`, url: `${SITE}/${county.state.slug}/${county.slug}/weather`, periods: [] };
    try {
      const data = await json(`/v1/counties/${county.state.slug}/${county.slug}/weather`);
      forecast.periods = (data.forecast || []).filter((p: { startTime: string; endTime: string }) => Date.parse(p.endTime) > now.getTime() && Date.parse(p.startTime) < now.getTime() + 36 * 3600000).slice(0, 2).map((p: { name: string; startTime: string; shortForecast?: string; temperature?: { value?: number }; precipitationProbability?: { value?: number } }) => ({ name: plain(p.name), start: p.startTime, summary: plain(p.shortForecast || 'See the full forecast'), temperature: typeof p.temperature?.value === 'number' ? p.temperature.value : undefined, rain: typeof p.precipitationProbability?.value === 'number' ? p.precipitationProbability.value : undefined }));
    } catch { /* Explicit unavailable message below, never stale or invented weather. */ }
    return forecast;
  }));
  return { edition: e, catalog: await loadCatalog(), label: editionLabel(e), url: SITE + homePath(e), builtAt: now.toISOString(), sections, forecasts };
}

export function escapeHtml(value: string) { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!); }
export { renderDigest } from './render';
