import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import type { CountySite } from '../data/counties';
import type { StateSite } from '../data/states';
import { NewsletterEditionSearch } from './NewsletterEditionSearch';
import { NewsletterGift } from './NewsletterGift';
import { MORNING_POST_TITLE, MORNING_POST_DESCRIPTION, nationalEdition, type EditionChoice } from '../data/morning-post';
import { newsletterRequest, newsletterZones, type NewsletterEdition } from '../lib/newsletter-api';
import { Seo } from './Seo';
import { ads, isAdVisibleInCounty } from '../data/ads';
import './Newsletter.css';

function browserZone() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return newsletterZones.some(([value]) => value === zone) ? zone : 'America/Chicago';
}
export function NewsletterSignup({ county, state, footer = false }: { county?: CountySite; state?: StateSite; footer?: boolean }) {
  const id = useId();
  const [choice, setChoice] = useState<EditionChoice | undefined>(() => county
    ? { label: `${county.displayName}, ${county.state.name}`, edition: { level: 'county', state: county.state.slug, county: county.slug } }
    : state ? { label: `${state.name} edition`, edition: { level: 'state', state: state.slug } } : nationalEdition);
  const [timeZone, setTimeZone] = useState(browserZone);
  const [customZone, setCustomZone] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const edition = choice?.edition;
  useEffect(() => {
    if (footer || customZone || !edition || edition.level === 'national') return;
    const controller = new AbortController();
    const query = new URLSearchParams({ level: edition.level, state: edition.state!, ...(edition.county ? { county: edition.county } : {}) });
    newsletterRequest<{ timeZone: string }>(`/defaults?${query}`, undefined, controller.signal).then(result => { if (!controller.signal.aborted) setTimeZone(result.timeZone); }).catch(() => {});
    return () => controller.abort();
  }, [edition, customZone, footer]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!edition) { setError('Choose an edition from the search results before subscribing.'); return; }
    const form = new FormData(event.currentTarget);
    setPending(true); setMessage('');
    try {
      const result = await newsletterRequest('/subscribe', { email: form.get('email'), consent: form.get('consent') === 'on', website: form.get('website'), edition: { ...edition, timeZone: customZone || edition.level === 'national' ? timeZone : undefined } });
      setMessage(result.message); setSuccess(true);
    } catch (e) { setError((e as Error).message); }
    finally { setPending(false); }
  }
  return <section className={`newsletter newsletter-signup ${footer ? 'newsletter-footer' : 'card'}`} aria-labelledby={`${id}-title`}>
    <div className="newsletter-intro"><h2 id={`${id}-title`}><Link to="/morning-post">The Morning Post</Link></h2>
      <p>{footer ? `${choice?.label} · News & weather at 6:15 a.m.` : <>Your morning news & weather, free at 6:15 a.m. <Link to="/morning-post">Meet the Morning Post →</Link></>}</p>
    </div>
    {success ? <div role="status"><p>{message}</p>{footer ? <Link to="/morning-post">Explore other editions →</Link> : <button className="newsletter-button" onClick={() => { setSuccess(false); setMessage(''); }}>Subscribe to another edition</button>}</div> : <form onSubmit={submit} className="newsletter-form" aria-label={footer ? 'Footer Morning Post signup' : 'Morning Post signup'}>
      <div className="newsletter-fields">
        {!footer ? <NewsletterEditionSearch selected={choice} onChange={next => { setChoice(next); setCustomZone(false); setTimeZone(browserZone()); setError(''); }} /> : null}
        <label htmlFor={`${id}-email`}>Email address<input id={`${id}-email`} name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label>
        <button className="newsletter-button" disabled={pending}>{pending ? 'Submitting…' : 'Subscribe free'}</button>
      </div>
      <div className="newsletter-trap" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="newsletter-consent"><input type="checkbox" name="consent" required /> <span>Email me this daily edition. Unsubscribe anytime.</span></label>
      <div className="newsletter-meta">
        <p className="newsletter-note">Confirm by email to start. <Link to="/privacy">Privacy</Link></p>
        {!footer ? <details className="newsletter-delivery"><summary>Delivery time</summary><label>6:15 a.m. delivery timezone<select value={timeZone} onChange={e => { setCustomZone(true); setTimeZone(e.target.value); }}>{newsletterZones.map(([zone, label]) => <option key={zone} value={zone}>{label}</option>)}</select></label><p className="newsletter-note">Local time for your edition. National editions use your timezone; you can change it here.</p></details> : null}
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </form>}
    <NewsletterGift initialChoice={choice || nationalEdition} senderEmail={email} onSenderEmailChange={setEmail} />
  </section>;
}

export function MorningPostPage() {
  return <div className="morning-post-page">
    <Seo title={MORNING_POST_TITLE} description={MORNING_POST_DESCRIPTION} policy="newsletter" />
    <header className="morning-post-hero">
      <div><p className="kicker">From The County Post · Free daily email</p><h1>The Morning Post</h1><p className="morning-post-deck">Your community. Your morning. A little more informed.</p><p>A quick read of the latest stories and the weather ahead, ready for your first cup of coffee. Choose your county, follow your state, or catch up with the national edition.</p><a className="morning-post-jump" href="#morning-post-signup">Find your edition ↓</a></div>
      <aside className="morning-post-time" aria-label="Delivery starts at 6:15 a.m. local time"><span>Start the day with</span><strong>6:15</strong><span>A.M. · Your local time</span><p>Fresh headlines.<br />A look at the forecast.<br />One morning email.</p></aside>
    </header>
    <div id="morning-post-signup"><NewsletterSignup /></div>
    <section className="morning-post-benefits" aria-label="What is in the Morning Post">
      <article><p className="kicker">01 · Get caught up</p><h2>The stories that shape your day</h2><p>A selection of recent headlines, sports, obituaries, politics, business, and community reporting. Open any story to keep reading at the relevant County Post desk.</p></article>
      <article><p className="kicker">02 · Plan ahead</p><h2>Weather before you head out</h2><p>A weather and precipitation preview alongside your news. County editions show local forecasts; state and national editions identify the locations in their forecast roundup.</p></article>
      <article><p className="kicker">03 · Make it yours</p><h2>As local as you like</h2><p>Follow your home county, your state, or the country. Subscribe to multiple editions to keep up with places that matter to you, and support the businesses featured in each edition.</p></article>
    </section>
    <section className="morning-post-details"><h2>A simple morning routine</h2><p>Choose an edition, enter your email, and confirm the link in your inbox. We’ll send that day’s edition as soon as you confirm, then continue daily delivery at 6:15 a.m. in your edition’s local timezone; national readers can choose their timezone. Mailbox arrival can vary.</p><p>Always free to subscribe. Every email includes links to manage your delivery timezone or unsubscribe. We measure email opens and link clicks to improve the newsletter. <Link to="/privacy">Read our privacy policy.</Link></p></section>
  </div>;
}

export function NewsletterPage() {
  const { hash, search } = useLocation();
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
  if (!mode) return <Navigate to={`/morning-post${search}${hash}`} replace />;
  return <div className="layout-grid">
    <Seo title="The Morning Post Newsletter" description="Choose a national, state, or county edition for your free 6:15 a.m. daily news and weather email." policy="submit" />
    {mode ? <section className="newsletter card"><p className="kicker">The Morning Post</p><h1>{mode === 'confirm' ? 'Confirm your subscription' : mode === 'unsubscribe' ? 'Unsubscribe from this edition' : 'Manage your newsletter'}</h1>
      {mode === 'confirm' && !message ? <><p>Confirm below to receive today’s edition now, followed by your daily edition at 6:15 a.m.</p><button className="newsletter-button" disabled={busy} onClick={() => action('/confirm')}>Confirm subscription</button></> : null}
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
    const timer = window.setTimeout(go, 3500);
    window.gtag?.('event', 'newsletter_sponsor_click', { advertiser_id: ad.id, newsletter_edition: edition.slice(0, 100), campaign, transport_type: 'beacon', event_callback: go, event_timeout: 3000 });
    return () => { live = false; window.clearTimeout(timer); };
  }, [ad, edition, campaign]);
  return <section className="card newsletter"><Seo title="Visit our newsletter sponsor" description="Continue to a County Post newsletter sponsor." policy="submit" /><p className="kicker">Advertisement</p><h1>{ad ? `Opening ${ad.name}…` : 'This sponsor is no longer available'}</h1>{ad ? <a href={ad.href} rel="sponsored">Continue to {ad.name} →</a> : <Link to="/partners">Browse current partners</Link>}</section>;
}
