import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getCountiesForState, type CountySite } from '../data/counties';
import { states, type StateSite } from '../data/states';
import { newsletterRequest, newsletterZones, type NewsletterEdition } from '../lib/newsletter-api';
import { Seo } from './Seo';
import { ads, isAdVisibleInCounty } from '../data/ads';
import './Newsletter.css';

function browserZone() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return newsletterZones.some(([value]) => value === zone) ? zone : 'America/Chicago';
}
export function NewsletterSignup({ county, state }: { county?: CountySite; state?: StateSite }) {
  const id = useId();
  const [edition, setEdition] = useState<NewsletterEdition>({ level: county ? 'county' : state ? 'state' : 'national', state: county?.state.slug || state?.slug || '', county: county?.slug || '', timeZone: browserZone() });
  const [customZone, setCustomZone] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    if (customZone || edition.level === 'national' || !edition.state || (edition.level === 'county' && !edition.county)) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ level: edition.level, state: edition.state, ...(edition.level === 'county' ? { county: edition.county! } : {}) });
    newsletterRequest<{ timeZone: string }>(`/defaults?${query}`, undefined, controller.signal).then(result => setEdition(current => ({ ...current, timeZone: result.timeZone }))).catch(() => {});
    return () => controller.abort();
  }, [edition.level, edition.state, edition.county, customZone]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true); setError(''); setMessage('');
    try {
      const result = await newsletterRequest('/subscribe', { email: form.get('email'), consent: form.get('consent') === 'on', website: form.get('website'), edition: { ...edition, timeZone: customZone || edition.level === 'national' ? edition.timeZone : undefined } });
      setMessage(result.message); setSuccess(true);
    } catch (e) { setError((e as Error).message); }
    finally { setPending(false); }
  }
  return <section className="newsletter card" aria-labelledby={`${id}-title`}>
    <div className="newsletter-intro"><p className="kicker">The Morning Post · Free daily newsletter</p><h2 id={`${id}-title`}>Your edition. Every morning.</h2><p>Headlines, sports, obituaries, community news, and a weather &amp; precipitation preview. Delivered starting at 6:15 a.m. in your chosen timezone.</p></div>
    {success ? <div role="status"><p>{message}</p><button className="newsletter-button" onClick={() => { setSuccess(false); setMessage(''); }}>Subscribe to another edition</button></div> : <form onSubmit={submit} className="newsletter-form">
      <div className="newsletter-fields">
        <label htmlFor={`${id}-email`}>Email address<input id={`${id}-email`} name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label htmlFor={`${id}-edition`}>Newsletter edition<select id={`${id}-edition`} value={edition.level} onChange={e => { setCustomZone(false); setEdition(current => ({ ...current, level: e.target.value as NewsletterEdition['level'] })); }}><option value="national">National / home page</option><option value="state">State</option><option value="county">County</option></select></label>
        {edition.level !== 'national' ? <label htmlFor={`${id}-state`}>State<select id={`${id}-state`} required value={edition.state} onChange={e => { setCustomZone(false); setEdition(current => ({ ...current, state: e.target.value, county: '' })); }}><option value="">Choose a state</option>{states.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select></label> : null}
        {edition.level === 'county' ? <label htmlFor={`${id}-county`}>County<select id={`${id}-county`} required disabled={!edition.state} value={edition.county} onChange={e => { setCustomZone(false); setEdition(current => ({ ...current, county: e.target.value })); }}><option value="">Choose a county</option>{getCountiesForState(edition.state).map(c => <option key={c.fips} value={c.slug}>{c.displayName}</option>)}</select></label> : null}
        <label htmlFor={`${id}-zone`}>6:15 a.m. delivery timezone<select id={`${id}-zone`} value={edition.timeZone} onChange={e => { setCustomZone(true); setEdition(current => ({ ...current, timeZone: e.target.value })); }}>{newsletterZones.map(([zone, label]) => <option key={zone} value={zone}>{label}</option>)}</select></label>
      </div>
      <div className="newsletter-trap" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="newsletter-consent"><input type="checkbox" name="consent" required /> <span>Email me this daily edition. I can unsubscribe at any time.</span></label>
      <button className="newsletter-button" disabled={pending}>{pending ? 'Submitting…' : 'Subscribe free'}</button>
      <p className="newsletter-note">Confirm your email to start delivery. You can subscribe to more than one edition. County weather is local; state and national editions show forecasts for named locations. We measure email opens and link clicks to improve the newsletter. <Link to="/privacy">Privacy policy</Link></p>
      {error ? <p role="alert">{error}</p> : null}
    </form>}
  </section>;
}

export function NewsletterPage() {
  const { hash } = useLocation();
  const params = new URLSearchParams(hash.slice(1));
  const mode = params.has('confirm') ? 'confirm' : params.has('unsubscribe') ? 'unsubscribe' : params.has('manage') ? 'manage' : undefined;
  const token = mode ? params.get(mode) || '' : '';
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [manageToken, setManageToken] = useState('');
  const [preferences, setPreferences] = useState<{ label: string; status: string; edition: NewsletterEdition }>();
  useEffect(() => {
    setMessage(''); setError(''); setPreferences(undefined);
    if (mode !== 'manage') return;
    const controller = new AbortController();
    newsletterRequest<{ label: string; status: string; edition: NewsletterEdition }>(`/preferences?token=${encodeURIComponent(token)}`, undefined, controller.signal).then(setPreferences).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [mode, token]);
  async function action(path: string, extra = {}) {
    setBusy(true); setError('');
    try {
      const result = await newsletterRequest<{ message: string; manageToken?: string }>(path, { token, ...extra });
      setMessage(result.message); if (result.manageToken) setManageToken(result.manageToken);
      if (path === '/unsubscribe') setPreferences(current => current ? { ...current, status: 'unsubscribed' } : current);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="layout-grid">
    <Seo title="The Morning Post Newsletter" description="Choose a national, state, or county edition for your free 6:15 a.m. daily news and weather email." policy="submit" />
    {mode ? <section className="newsletter card"><p className="kicker">The Morning Post</p><h1>{mode === 'confirm' ? 'Confirm your subscription' : mode === 'unsubscribe' ? 'Unsubscribe from this edition' : 'Manage your newsletter'}</h1>
      {mode === 'confirm' && !message ? <><p>Confirm below to start receiving your chosen daily edition at 6:15 a.m.</p><button className="newsletter-button" disabled={busy} onClick={() => action('/confirm')}>Confirm subscription</button></> : null}
      {mode === 'unsubscribe' && !message ? <><p>This stops delivery of the edition associated with this link.</p><button className="newsletter-button" disabled={busy} onClick={() => action('/unsubscribe')}>Unsubscribe</button></> : null}
      {preferences ? <><h2>{preferences.label}</h2><p>Status: {preferences.status}</p><label>Delivery timezone<select value={preferences.edition.timeZone} onChange={e => setPreferences({ ...preferences, edition: { ...preferences.edition, timeZone: e.target.value } })}>{newsletterZones.map(([zone, label]) => <option key={zone} value={zone}>{label}</option>)}</select></label><div className="newsletter-actions"><button className="newsletter-button" disabled={busy} onClick={() => action('/preferences', { timeZone: preferences.edition.timeZone })}>Save timezone</button>{preferences.status === 'active' ? <button disabled={busy} onClick={() => action('/unsubscribe')}>Unsubscribe from this edition</button> : null}</div><p>To change the edition, unsubscribe here and choose another edition below.</p></> : null}
      {message ? <p role="status">{message}</p> : null}{error ? <p role="alert">{error}</p> : null}
      {manageToken ? <Link to={`/newsletter#manage=${manageToken}`}>Manage your newsletter</Link> : null}
    </section> : null}
    <NewsletterSignup />
  </div>;
}

export function NewsletterSponsorVisit() {
  const { search } = useLocation();
  const query = new URLSearchParams(search);
  const adId = query.get('ad');
  const requestedEdition = query.get('edition') || 'national';
  const edition = /^(national|state\/[a-z-]+|county\/[a-z-]+\/[a-z-]+)$/.test(requestedEdition) ? requestedEdition : 'national';
  const [level, state, county] = edition.split('/');
  const scope = level === 'county' ? `${state}/${county}` : level === 'state' ? state : undefined;
  const ad = ads.find(candidate => candidate.id === adId && isAdVisibleInCounty(candidate, scope));
  const requestedCampaign = query.get('utm_campaign') || '';
  const campaign = /^morning_post_\d{4}-\d{2}-\d{2}$/.test(requestedCampaign) ? requestedCampaign : '';
  useEffect(() => {
    if (!ad) return;
    const destination = new URL(ad.href, window.location.origin);
    destination.searchParams.set('utm_source', 'the_county_post');
    destination.searchParams.set('utm_medium', 'email');
    if (/^morning_post_\d{4}-\d{2}-\d{2}$/.test(campaign)) destination.searchParams.set('utm_campaign', campaign);
    let live = true;
    const go = () => { if (live) window.location.replace(destination.href); };
    const timer = window.setTimeout(go, 1200);
    window.gtag?.('event', 'newsletter_sponsor_click', { advertiser_id: ad.id, newsletter_edition: edition.slice(0, 100), campaign, transport_type: 'beacon', event_callback: go, event_timeout: 1000 });
    return () => { live = false; window.clearTimeout(timer); };
  }, [ad, edition, campaign]);
  return <section className="card newsletter"><Seo title="Visit our newsletter sponsor" description="Continue to a County Post newsletter sponsor." policy="submit" /><p className="kicker">Advertisement</p><h1>{ad ? `Opening ${ad.name}…` : 'This sponsor is no longer available'}</h1>{ad ? <a href={ad.href} rel="sponsored">Continue to {ad.name} →</a> : <Link to="/partners">Browse current partners</Link>}</section>;
}
