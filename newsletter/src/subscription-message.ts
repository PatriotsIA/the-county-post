import { escapeHtml as h } from './content';
import { editionLabel, homePath, SITE, type Subscriber } from './model';

export function renderSubscriptionMessage(sub: Subscriber, confirming: boolean, address: string, reminder = false) {
  const label = editionLabel(sub);
  const gift = confirming ? sub.invitedBy : undefined;
  const subject = reminder ? `Reminder: confirm your ${label} Morning Post` : gift ? `A gift for you: the free ${label} Morning Post` : `${confirming ? 'Confirm' : 'Manage'} your ${label} Morning Post`;
  const url = `${SITE}/newsletter#${confirming ? `confirm=${sub.confirmToken}` : `manage=${sub.manageToken}`}`;
  const paragraphs = gift ? [
    `${gift.name} (${gift.email}) has invited you to enjoy the ${label} edition of The Morning Post, free from The County Post.`,
    'The County Post brings together national, state, and county news. The Morning Post is our free daily email with a selection of headlines and a look at the weather ahead.',
    `Your gift is the ${label} edition. Confirm your free subscription below to receive today’s edition right away, then daily delivery starting at 6:15 a.m. ${sub.timeZone}. There is no charge, and you can unsubscribe anytime.`,
    'You are not subscribed yet. If you do not want this gift, decline below; daily delivery will not start.',
  ] : [
    `You requested the ${label} newsletter from The County Post. Delivery is daily at 6:15 a.m. ${sub.timeZone}. ${confirming ? "Complete both steps below to receive today's edition now and start daily delivery." : 'Use the link below to manage your existing subscription.'}`,
    confirming ? 'You are not subscribed yet. If you did not request this, cancel below; daily delivery will not start.' : 'If you did not request this, ignore this email.',
  ];
  const action = gift ? 'Confirm my free subscription' : confirming ? 'Confirm my subscription' : 'Manage my subscription';
  if (reminder) paragraphs.unshift('Your subscription is still awaiting confirmation. This is a one-time reminder to complete the two steps below.');
  const instructions = confirming ? [
    `Click “${action}” in this email to open The County Post website.`,
    'On that page, click “Confirm subscription”. You are subscribed only after the website displays a confirmation message.',
  ] : [];
  const deadline = confirming ? `Confirm by ${new Intl.DateTimeFormat('en-US', { timeZone: sub.timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(sub.confirmExpires * 1000))} (${sub.timeZone}). If the link has expired, visit ${SITE}/morning-post and sign up again for a new confirmation email.` : '';
  const inboxHelp = confirming ? 'If you found this email in Spam or Junk, mark it as “Not spam” and move it to your inbox. Add newsletters@thecountypost.com to your contacts to help future Morning Post emails reach your inbox.' : '';
  const reminderNote = confirming && !reminder ? 'If you have not confirmed after 24 hours, we will send one follow-up confirmation email. You can cancel below to stop the reminder.' : '';
  const editionUrl = `${SITE}${homePath(sub)}`;
  const declineUrl = `${SITE}/newsletter#unsubscribe=${sub.manageToken}`;
  const declineLabel = gift ? 'Decline this invitation' : 'Cancel this signup';
  return {
    subject,
    text: [subject, ...paragraphs, ...instructions.map((step, i) => `${i + 1}. ${step}`), `${action}: ${url}`, ...[deadline, inboxHelp, reminderNote].filter(Boolean), ...(gift ? [`Explore your edition: ${editionUrl}`] : []), ...(confirming ? [`${declineLabel}: ${declineUrl}`] : []), 'The County Post', address].join('\n\n'),
    html: `<html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#fffdf7;color:#202020;font:16px/1.7 Georgia,serif;padding:24px;max-width:600px"><h1>The County Post</h1><h2>${h(subject)}</h2>${paragraphs.map(p => `<p>${h(p)}</p>`).join('')}${instructions.length ? `<h3>How to confirm</h3><ol>${instructions.map(step => `<li>${h(step)}</li>`).join('')}</ol>` : ''}<p><a ses:no-track href="${h(url)}" style="display:inline-block;background:#202020;color:#fff;padding:12px 18px;text-decoration:none;font-weight:bold">${h(action)}</a></p>${[deadline, inboxHelp, reminderNote].filter(Boolean).map(p => `<p>${h(p)}</p>`).join('')}${gift ? `<p><a href="${h(editionUrl)}">Explore your edition</a></p>` : ''}${confirming ? `<p><a ses:no-track href="${h(declineUrl)}">${h(declineLabel)}</a></p>` : ''}<p style="font-size:12px">The County Post<br>${h(address)}</p></body></html>`,
  };
}
