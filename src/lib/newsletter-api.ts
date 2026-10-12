export const newsletterZones = [
  ['America/New_York', 'Eastern'], ['America/Chicago', 'Central'], ['America/Denver', 'Mountain'],
  ['America/Phoenix', 'Arizona (no daylight saving)'], ['America/Los_Angeles', 'Pacific'],
  ['America/Anchorage', 'Alaska'], ['America/Adak', 'Aleutian'], ['Pacific/Honolulu', 'Hawaii'],
] as const;
export type NewsletterEdition = { level: 'national' | 'state' | 'county'; state?: string; county?: string; timeZone: string };
export async function newsletterRequest<T = { message: string }>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const base = import.meta.env.VITE_NEWSLETTER_API_URL;
  if (!base) throw new Error('The morning newsletter is being prepared. Please check back soon.');
  const response = await fetch(`${base.replace(/\/$/, '')}${path}`, { method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, signal, referrerPolicy: 'no-referrer' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to complete your request. Please try again.');
  return data;
}
