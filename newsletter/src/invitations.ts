import { randomBytes } from 'node:crypto';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { createSubscriber, db, get, rateLimit, seconds, table } from './store';
import { editionKey, hash, InputError, validateEdition, validateEmail, type Subscriber } from './model';

export const invitationMessage = 'Your invitation request has been received. Eligible recipients will receive an email with your name and email address. Their free subscription starts only after they confirm.';

/** Invitations never replace a reader's current signup, subscription, or opt-out. */
export async function prepareInvitation(body: Record<string, unknown>, sourceIp: string): Promise<Subscriber | undefined> {
  if (body.website) return;
  if (body.consent !== true) throw new InputError('Please agree to share your name and email in the invitation.');
  const senderEmail = validateEmail(body.senderEmail);
  const email = validateEmail(body.recipientEmail);
  if (senderEmail === email) throw new InputError('Enter someone else’s email to send a gift, or use Subscribe free for yourself.');
  if (typeof body.senderName !== 'string' || /\p{Cc}/u.test(body.senderName)) throw new InputError('Enter your name.');
  const name = body.senderName.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80) throw new InputError('Enter your name using 80 characters or fewer.');
  const edition = validateEdition(body.edition);
  await rateLimit(`ip-${hash(sourceIp)}`, 20, 3600);
  await rateLimit(`inviter-${hash(senderEmail)}`, 5, 86400);
  await rateLimit(`email-${hash(email)}`, 3, 86400);
  await rateLimit('signups', 1000, 86400);
  if (await get(`SUPPRESS#${hash(email)}`) || await get(`SUPPRESS#${hash(senderEmail)}`)) return;
  const pk = `SUB#${hash(`${email}|${editionKey(edition)}`)}`;
  const existing = await get<Subscriber>(pk);
  if (existing) {
    if (existing.status !== 'pending') return;
    if (existing.confirmExpires >= seconds()) {
      // Retry a failed queue request with the same version; never rewrite another invitation.
      return existing.invitedBy?.email === senderEmail ? existing : undefined;
    }
  }
  const sub: Subscriber = {
    ...edition, pk, email, status: 'pending', createdAt: new Date().toISOString(),
    invitedBy: { name, email: senderEmail },
    confirmToken: randomBytes(32).toString('base64url'),
    manageToken: existing?.manageToken || randomBytes(32).toString('base64url'),
    confirmExpires: seconds() + 2 * 86400, expires: seconds() + 7 * 86400,
  };
  if (existing) {
    await db.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: table(), Item: sub, ConditionExpression: '#status = :pending AND confirmToken = :previous', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':pending': 'pending', ':previous': existing.confirmToken } } },
      { Put: { TableName: table(), Item: { pk: `TOKEN#${hash(sub.confirmToken)}`, purpose: 'confirm', subscriber: pk, expires: sub.confirmExpires } } },
      { Put: { TableName: table(), Item: { pk: `TOKEN#${hash(sub.manageToken)}`, purpose: 'manage', subscriber: pk } } },
    ] }));
  } else await createSubscriber(sub);
  return sub;
}
