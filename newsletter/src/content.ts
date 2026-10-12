import { SITE, editionLabel, homePath, sectionUrl, weatherCounties, type Edition } from './model';
import { loadCatalog, type Catalog } from './sponsors';

export type Story = { title: string; source: string; publishedAt: string; url: string };
export type Section = { title: string; url: string; stories: Story[] };
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
    return [{ title: plain(item.title).slice(0, 250), source: plain(typeof item.source === 'string' ? item.source : 'Source listed on the news desk'), publishedAt: new Date(time).toISOString(), url: sectionUrl(edition, topic) }];
  }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).filter(item => {
    const key = item.title.toLowerCase().replace(/\W/g, '');
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, topic === 'general' ? 3 : 2);
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
  const sections = TOPICS.map(([topic, title], i) => ({ title, url: sectionUrl(e, topic), stories: recentStories(results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<{ items?: unknown[] }>).value.items || [] : [], topic, e, now, seen) }));
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
