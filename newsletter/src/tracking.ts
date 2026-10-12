import { hash, editionKey, type Edition } from './model';
export function trackedUrl(href: string, edition: Edition, date: string, placement: string) {
  const url = new URL(href);
  url.searchParams.set('utm_source', 'the_county_post');
  url.searchParams.set('utm_medium', 'email');
  url.searchParams.set('utm_campaign', `morning_post_${date}`);
  url.searchParams.set('utm_content', `${editionKey(edition).replaceAll('/', '_')}_${placement}`);
  return url.href;
}
export function analyticsEvent(detail: Record<string, any>) {
  if (!['Open', 'Click', 'Delivery'].includes(detail.eventType) || detail.mail?.tags?.kind?.[0] !== 'daily') return undefined;
  const edition = String(detail.mail.tags.edition?.[0] || '').slice(0, 100);
  const date = String(detail.mail.tags.edition_date?.[0] || '').slice(0, 10);
  if (!edition || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  let placement = '';
  if (detail.eventType === 'Click') {
    try { placement = new URL(detail.click.link).searchParams.get('utm_content') || ''; } catch { return undefined; }
    if (!placement || placement.length > 150) return undefined;
  }
  const id = hash(`${detail.mail.messageId}|${detail.eventType}|${placement}`);
  const client = hash(String(detail.mail.messageId));
  const name = detail.eventType === 'Open' ? 'newsletter_open' : detail.eventType === 'Click' ? 'newsletter_click' : 'newsletter_delivery';
  return { id, name, edition, date, payload: {
    client_id: `${parseInt(client.slice(0, 12), 16)}.${parseInt(client.slice(12, 24), 16)}`,
    consent: { ad_user_data: 'DENIED', ad_personalization: 'DENIED' },
    events: [{ name, params: { newsletter_edition: edition, newsletter_date: date, newsletter_placement: placement || 'email', source: 'the_county_post', medium: 'email', campaign: `morning_post_${date}`, measurement_method: detail.eventType === 'Open' ? 'ses_tracking_pixel' : 'ses_event' } }],
  } };
}
