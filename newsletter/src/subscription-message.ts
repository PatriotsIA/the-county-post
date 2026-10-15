import { escapeHtml as h } from './content';
import { editionLabel, homePath, SITE, type Subscriber } from './model';

export function renderSubscriptionMessage(sub: Subscriber, confirming: boolean, address: string) {
  const label = editionLabel(sub);
  const gift = confirming ? sub.invitedBy : undefined;
  const subject = gift ? `A gift for you: the free ${label} Morning Post` : `${confirming ? 'Confirm' : 'Manage'} your ${label} Morning Post`;
  const url = `${SITE}/newsletter#${confirming ? `confirm=${sub.confirmToken}` : `manage=${sub.manageToken}`}`;
  const paragraphs = gift ? [
    `${gift.name} (${gift.email}) has invited you to enjoy the ${label} edition of The Morning Post, free from The County Post.`,
    'The County Post brings together national, state, and county news. The Morning Post is our free daily email with a selection of headlines and a look at the weather ahead.',
    `Your gift is the ${label} edition. Confirm your free subscription below to receive today’s edition right away, then daily delivery starting at 6:15 a.m. ${sub.timeZone}. There is no charge, and you can unsubscribe anytime.`,
    'You are not subscribed yet. This invitation expires in 48 hours. If you do not want this gift, simply ignore this email or decline below; daily delivery will not start.',
  ] : [
    `You requested the ${label} newsletter from The County Post. Delivery is daily at 6:15 a.m. ${sub.timeZone}. ${confirming ? "Confirm below to receive today's edition now and start daily delivery. This link expires in 48 hours." : 'Use the link below to manage your existing subscription.'}`,
    'If you did not request this, ignore this email.',
  ];
  const action = gift ? 'Confirm my free subscription' : confirming ? 'Confirm my subscription' : 'Manage my subscription';
  const editionUrl = `${SITE}${homePath(sub)}`;
  const declineUrl = `${SITE}/newsletter#unsubscribe=${sub.manageToken}`;
  return {
    subject,
    text: [subject, '', ...paragraphs, '', `${action}: ${url}`, ...(gift ? ['', `Explore your edition: ${editionUrl}`, `Decline this invitation: ${declineUrl}`] : []), '', 'The County Post', address].join('\n\n'),
    html: `<html lang="en"><body style="background:#fffdf7;color:#202020;font:16px/1.7 Georgia,serif;padding:24px;max-width:600px"><h1>The County Post</h1><h2>${h(subject)}</h2>${paragraphs.map(p => `<p>${h(p)}</p>`).join('')}<p><a ses:no-track href="${h(url)}" style="color:#173e64">${h(action)}</a></p>${gift ? `<p><a href="${h(editionUrl)}">Explore your edition</a> · <a ses:no-track href="${h(declineUrl)}">Decline this invitation</a></p>` : ''}<p style="font-size:12px">The County Post<br>${h(address)}</p></body></html>`,
  };
}
