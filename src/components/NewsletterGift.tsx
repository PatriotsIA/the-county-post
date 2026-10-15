import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { EditionChoice } from '../data/morning-post';
import { newsletterRequest, newsletterZones } from '../lib/newsletter-api';
import { NewsletterEditionSearch } from './NewsletterEditionSearch';

export function NewsletterGift({ initialChoice, senderEmail, onSenderEmailChange }: { initialChoice: EditionChoice; senderEmail: string; onSenderEmailChange: (email: string) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return <div className="newsletter-gift">
    <button type="button" className="newsletter-gift-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      Give The Gift of The Morning Post <span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    <div id={id} hidden={!open}>
      {open ? <GiftForm initialChoice={initialChoice} senderEmail={senderEmail} onSenderEmailChange={onSenderEmailChange} /> : null}
    </div>
  </div>;
}

function GiftForm({ initialChoice, senderEmail, onSenderEmailChange }: { initialChoice: EditionChoice; senderEmail: string; onSenderEmailChange: (email: string) => void }) {
  const [choice, setChoice] = useState<EditionChoice | undefined>(initialChoice);
  const [timeZone, setTimeZone] = useState(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return newsletterZones.some(([value]) => value === zone) ? zone : 'America/Chicago';
  });
  const [customZone, setCustomZone] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const edition = choice?.edition;
  useEffect(() => {
    if (!edition || edition.level === 'national' || customZone) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ level: edition.level, state: edition.state!, ...(edition.county ? { county: edition.county } : {}) });
    newsletterRequest<{ timeZone: string }>(`/defaults?${query}`, undefined, controller.signal).then(result => { if (!controller.signal.aborted) setTimeZone(result.timeZone); }).catch(() => {});
    return () => controller.abort();
  }, [edition, customZone]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!edition) { setError('Choose an edition from the search results before sending your gift.'); return; }
    const form = new FormData(event.currentTarget);
    const recipientEmail = String(form.get('recipientEmail') || '').trim();
    if (recipientEmail.toLowerCase() === senderEmail.trim().toLowerCase()) { setError('Enter someone else’s email to send a gift, or use Subscribe free for yourself.'); return; }
    setPending(true);
    try {
      const result = await newsletterRequest('/invite', {
        senderName: form.get('senderName'), senderEmail, recipientEmail,
        consent: form.get('consent') === 'on', website: form.get('website'),
        edition: { ...edition, timeZone: customZone || edition.level === 'national' ? timeZone : undefined },
      });
      setMessage(result.message);
    } catch (e) { setError((e as Error).message); }
    finally { setPending(false); }
  }
  return message ? <div role="status"><p>{message}</p><button type="button" className="newsletter-gift-toggle" onClick={() => setMessage('')}>Give another gift</button></div> : <form className="newsletter-gift-form" aria-label="Give The Gift of The Morning Post" onSubmit={submit}>
    <p>Share a little morning news with someone you know. We’ll email them an invitation from you to a free national, state, or county edition. Once they confirm, they’ll receive that day’s Morning Post, then their daily edition at 6:15 a.m.</p>
    <div className="newsletter-gift-fields">
      <label>Your name<input name="senderName" autoComplete="name" required maxLength={80} /></label>
      <label>Your email address<input name="senderEmail" type="email" autoComplete="email" value={senderEmail} onChange={event => onSenderEmailChange(event.target.value)} required maxLength={254} /></label>
      <label>Recipient’s email address<input name="recipientEmail" type="email" autoComplete="off" required maxLength={254} placeholder="friend@example.com" /></label>
      <NewsletterEditionSearch label="Recipient’s edition" selected={choice} onChange={next => { setChoice(next); setCustomZone(false); setError(''); }} />
    </div>
    <details className="newsletter-delivery"><summary>Recipient’s delivery time</summary><label>6:15 a.m. delivery timezone<select value={timeZone} onChange={event => { setCustomZone(true); setTimeZone(event.target.value); }}>{newsletterZones.map(([zone, label]) => <option key={zone} value={zone}>{label}</option>)}</select></label><p className="newsletter-note">County and state editions default to local time. Choose the recipient’s timezone for a national edition. They can change it later.</p></details>
    <div className="newsletter-trap" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <label className="newsletter-consent"><input type="checkbox" name="consent" required /><span>Include my name and email address in this invitation. The recipient decides whether to subscribe.</span></label>
    <div className="newsletter-gift-actions"><button className="newsletter-button" disabled={pending}>{pending ? 'Sending invitation…' : 'Send free invitation'}</button><p className="newsletter-note">No charge. This sends an invitation, not a subscription for either of you. <Link to="/privacy">Privacy</Link></p></div>
    {error ? <p role="alert">{error}</p> : null}
  </form>;
}
