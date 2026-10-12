import { createHash } from 'node:crypto';
import tzLookup from 'tz-lookup';
import { counties, getCounty, getCountiesForState, type CountySite } from '../../src/data/counties';
import { states } from '../../src/data/states';
import { stateNewsHubs } from '../../src/data/state-news-hubs';

export const SITE = 'https://thecountypost.com';
export const ZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'America/Adak', 'Pacific/Honolulu'] as const;
export type Edition = { level: 'national' | 'state' | 'county'; state?: string; county?: string; timeZone: string };
export type Subscriber = Edition & { pk: string; email: string; status: 'pending' | 'active' | 'unsubscribed'; createdAt: string; confirmedAt?: string; manageToken: string; confirmToken: string; confirmExpires: number; activeZone?: string; expires?: number };
export class InputError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const editionKey = (e: Edition) => [e.level, e.state, e.county].filter(Boolean).join('/');
export const homePath = (e: Edition) => e.level === 'national' ? '/' : `/${e.state}${e.level === 'county' ? `/${e.county}` : ''}`;
export const editionLabel = (e: Edition) => e.level === 'national' ? 'National' : e.level === 'state' ? states.find(s => s.slug === e.state)!.name : `${getCounty(e.state, e.county)!.displayName}, ${states.find(s => s.slug === e.state)!.name}`;
export const sectionUrl = (e: Edition, topic: string) => `${SITE}${homePath(e)}#desk-${topic}`;
export function localDate(timeZone: string, date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function normalizedZone(zone: string) {
  // These eight schedules cover the US county dataset, including Arizona and the Aleutians.
  const offsets = (z: string) => [0, 6].map(month => new Intl.DateTimeFormat('en-US', { timeZone: z, timeZoneName: 'longOffset' }).format(new Date(Date.UTC(2026, month, 15)))).map(s => s.split('GMT')[1] || '').join('|');
  return ZONES.find(z => offsets(z) === offsets(zone)) || 'America/Chicago';
}
export function suggestedZone(e: Pick<Edition, 'level' | 'state' | 'county'>) {
  if (e.level === 'national') return 'America/Chicago';
  const point = e.county ? getCounty(e.state, e.county) : stateNewsHubs[e.state || '']?.[0];
  return point?.latitude !== undefined && point.longitude !== undefined ? normalizedZone(tzLookup(point.latitude, point.longitude)) : 'America/Chicago';
}
export function validateEdition(value: unknown): Edition {
  if (!value || typeof value !== 'object') throw new InputError('Choose a newsletter edition.');
  const e = value as Record<string, unknown>;
  if (!['national', 'state', 'county'].includes(String(e.level))) throw new InputError('Choose national, state, or county.');
  const level = e.level as Edition['level'];
  const state = typeof e.state === 'string' ? states.find(s => s.slug === e.state)?.slug : undefined;
  if (level !== 'national' && !state) throw new InputError('Choose a valid state.');
  const county = level === 'county' && typeof e.county === 'string' ? getCounty(state, e.county)?.slug : undefined;
  if (level === 'county' && !county) throw new InputError('Choose a county in the selected state.');
  const edition = { level, ...(level !== 'national' ? { state } : {}), ...(county ? { county } : {}) };
  const timeZone = e.timeZone || suggestedZone(edition);
  if (!ZONES.includes(timeZone as typeof ZONES[number])) throw new InputError('Choose a supported delivery timezone.');
  return { ...edition, timeZone: timeZone as string };
}
export function validateEmail(value: unknown) {
  if (typeof value !== 'string') throw new InputError('Enter your email address.');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(email)) throw new InputError('Enter a valid email address.');
  return email;
}
export function weatherCounties(e: Edition): CountySite[] {
  if (e.level === 'county') return [getCounty(e.state, e.county)!];
  if (e.level === 'national') return ['36061', '17031', '06037'].map(fips => counties.find(c => c.fips === fips)!);
  // Label the actual county forecast: a city hub only selects nearby county snapshots.
  const candidates = getCountiesForState(e.state).filter(c => c.latitude !== undefined && c.longitude !== undefined);
  const selected = (stateNewsHubs[e.state!] || []).slice(0, 3).map(hub => [...candidates].sort((a, b) => ((a.latitude! - hub.latitude) ** 2 + (a.longitude! - hub.longitude) ** 2) - ((b.latitude! - hub.latitude) ** 2 + (b.longitude! - hub.longitude) ** 2))[0]);
  return [...new Map(selected.filter(Boolean).map(c => [c.fips, c])).values()];
}
