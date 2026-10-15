import { randomBytes } from 'node:crypto';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { db, get, table, findByToken, createSubscriber, confirm, unsubscribe, rateLimit, seconds } from './store';
import { UpdateCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { InputError, SITE, ZONES, validateEmail, validateEdition, editionKey, editionLabel, suggestedZone, localDate, hash, type Subscriber } from './model';
import { invitationMessage, prepareInvitation } from './invitations';

const sqs = new SQSClient({});
const response = (statusCode: number, data: unknown, origin?: string) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', ...(origin ? { 'access-control-allow-origin': origin, 'vary': 'Origin', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' } : {}) }, body: JSON.stringify(data) });
async function queue(sub: Subscriber, kind: 'confirm' | 'manage') { await sqs.send(new SendMessageCommand({ QueueUrl: process.env.QUEUE_URL!, MessageBody: JSON.stringify({ kind, subscriber: sub.pk, version: sub.confirmToken, request: kind === 'confirm' && sub.invitedBy ? sub.confirmToken : randomBytes(16).toString('hex') }) })); }
export async function handler(event: APIGatewayProxyEventV2) {
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  const origin = event.headers.origin;
  const allowed = [SITE, 'https://www.thecountypost.com', ...(process.env.EXTRA_ORIGINS || '').split(',')].includes(origin || '');
  if (origin && !allowed) return response(403, { error: 'Origin not allowed.' });
  if (method === 'OPTIONS') return response(204, {}, allowed ? origin : undefined);
  try {
    if (method === 'GET' && path === '/health') return response(200, { ok: true, enabled: process.env.SENDING_ENABLED === 'true' }, origin);
    const query = new URLSearchParams(event.rawQueryString);
    if (method === 'GET' && path === '/defaults') {
      const edition = validateEdition(Object.fromEntries(query));
      return response(200, { timeZone: suggestedZone(edition), zones: ZONES }, origin);
    }
    if (method === 'GET' && path === '/preferences') {
      const sub = await findByToken(query.get('token'), 'manage');
      return response(200, { edition: { level: sub.level, state: sub.state, county: sub.county, timeZone: sub.timeZone }, label: editionLabel(sub), status: sub.status }, origin);
    }
    if (method !== 'POST') return response(404, { error: 'Not found.' }, origin);
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body || '';
    if (Buffer.byteLength(raw) > 4096) throw new InputError('Request too large.', 413);
    let body: Record<string, unknown>;
    try { body = event.headers['content-type']?.includes('application/x-www-form-urlencoded') ? Object.fromEntries(new URLSearchParams(raw)) : JSON.parse(raw); } catch { throw new InputError('Invalid request.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError('Invalid request.');
    if (path === '/unsubscribe') {
      const sub = await findByToken(query.get('token') || body.token, 'manage');
      await unsubscribe(sub);
      return response(200, { message: 'You are unsubscribed from this edition.' }, origin);
    }
    if (path === '/confirm') {
      if (process.env.SENDING_ENABLED !== 'true') throw new InputError('Newsletter delivery is not available yet.', 503);
      const sub = await findByToken(body.token, 'confirm');
      const confirmed = await confirm(sub);
      const firstEdition = confirmed.firstEditionDate === localDate(confirmed.timeZone) && confirmed.firstEditionTimeZone === confirmed.timeZone;
      if (firstEdition) {
        // Await the queue before acknowledging delivery. A retry uses the original
        // confirmation day; the worker shares the scheduled edition's send claim.
        await sqs.send(new SendMessageCommand({ QueueUrl: process.env.QUEUE_URL!, MessageBody: JSON.stringify({ kind: 'daily', trigger: 'confirmation', subscriber: confirmed.pk, date: confirmed.firstEditionDate, timeZone: confirmed.firstEditionTimeZone, version: confirmed.confirmToken }) }));
      }
      return response(200, { message: `Your ${editionLabel(confirmed)} newsletter is confirmed. ${firstEdition ? "Today's edition is on its way. " : ''}Daily delivery starts at 6:15 a.m. ${confirmed.timeZone}.`, manageToken: confirmed.manageToken }, origin);
    }
    if (path === '/preferences') {
      const sub = await findByToken(body.token, 'manage');
      if (!ZONES.includes(body.timeZone as typeof ZONES[number])) throw new InputError('Choose a valid timezone.');
      await db.send(new UpdateCommand({ TableName: table(), Key: { pk: sub.pk }, UpdateExpression: sub.status === 'active' ? 'SET timeZone = :zone, activeZone = :zone' : 'SET timeZone = :zone', ExpressionAttributeValues: { ':zone': body.timeZone } }));
      return response(200, { message: 'Delivery timezone updated.' }, origin);
    }
    if (path !== '/subscribe' && path !== '/invite') return response(404, { error: 'Not found.' }, origin);
    if (process.env.SENDING_ENABLED !== 'true') throw new InputError('The morning newsletter is being prepared. Please check back soon.', 503);
    if (path === '/invite') {
      const sub = await prepareInvitation(body, event.requestContext.http.sourceIp);
      if (sub) await queue(sub, 'confirm');
      return response(202, { message: invitationMessage }, origin);
    }
    const generic = { message: 'Check your inbox for a confirmation or management link. Only confirmed subscriptions receive the morning newsletter.' };
    if (body.website) return response(202, generic, origin);
    if (body.consent !== true) throw new InputError('Please agree to receive the daily newsletter.');
    const email = validateEmail(body.email);
    const edition = validateEdition(body.edition);
    await rateLimit(`ip-${hash(event.requestContext.http.sourceIp)}`, 20, 3600);
    await rateLimit(`email-${hash(email)}`, 3, 86400);
    await rateLimit('signups', 1000, 86400);
    if (await get(`SUPPRESS#${hash(email)}`)) return response(202, generic, origin);
    const pk = `SUB#${hash(`${email}|${editionKey(edition)}`)}`;
    const existing = await get<Subscriber>(pk);
    if (existing?.status === 'active') { await queue(existing, 'manage'); return response(202, generic, origin); }
    const sub: Subscriber = { ...edition, pk, email, status: 'pending', createdAt: new Date().toISOString(), confirmToken: randomBytes(32).toString('base64url'), manageToken: existing?.manageToken || randomBytes(32).toString('base64url'), confirmExpires: seconds() + 2 * 86400, expires: seconds() + 7 * 86400 };
    if (existing) {
      await db.send(new TransactWriteCommand({ TransactItems: [
        { Put: { TableName: table(), Item: sub, ConditionExpression: '#s <> :active', ExpressionAttributeNames: { '#s': 'status' }, ExpressionAttributeValues: { ':active': 'active' } } },
        { Put: { TableName: table(), Item: { pk: `TOKEN#${hash(sub.confirmToken)}`, purpose: 'confirm', subscriber: pk, expires: sub.confirmExpires } } },
        { Put: { TableName: table(), Item: { pk: `TOKEN#${hash(sub.manageToken)}`, purpose: 'manage', subscriber: pk } } },
      ] }));
    } else await createSubscriber(sub);
    await queue(sub, 'confirm');
    return response(202, generic, origin);
  } catch (error) {
    if (!(error instanceof InputError)) console.error(JSON.stringify({ event: 'newsletter_api_failure', name: (error as Error).name }));
    return response(error instanceof InputError ? error.status : 503, { error: error instanceof InputError ? error.message : 'Unable to complete your request. Please try again shortly.' }, allowed ? origin : undefined);
  }
}
