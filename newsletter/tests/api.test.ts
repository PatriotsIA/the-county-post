import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
const mock = vi.hoisted(() => ({ get: vi.fn(), rateLimit: vi.fn(), create: vi.fn(), token: vi.fn(), confirm: vi.fn(), unsubscribe: vi.fn(), queue: vi.fn(), db: vi.fn() }));
vi.mock('../src/store', () => ({ get: mock.get, rateLimit: mock.rateLimit, createSubscriber: mock.create, findByToken: mock.token, confirm: mock.confirm, unsubscribe: mock.unsubscribe, seconds: () => 1700000000, db: { send: mock.db }, table: () => 'test' }));
vi.mock('@aws-sdk/client-sqs', () => ({ SQSClient: class { send = mock.queue; }, SendMessageCommand: class { constructor(public input: unknown) {} } }));
import { handler } from '../src/api';
const edition = { level: 'county', state: 'texas', county: 'potter', timeZone: 'America/Chicago' };
const event = (path: string, method: string, body: unknown = {}, headers = { origin: 'https://thecountypost.com', 'content-type': 'application/json' }) => ({ rawPath: path, rawQueryString: '', headers, requestContext: { http: { method, sourceIp: '192.0.2.1' } }, body: JSON.stringify(body) }) as unknown as APIGatewayProxyEventV2;
beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-13T20:00:00Z')); mock.get.mockResolvedValue(undefined); process.env.SENDING_ENABLED = 'true'; process.env.QUEUE_URL = 'queue'; });
afterEach(() => vi.useRealTimers());
it('creates only pending subscriptions and queues a confirmation', async () => {
  const result = await handler(event('/subscribe', 'POST', { email: 'reader@example.com', consent: true, edition }));
  expect(result.statusCode).toBe(202);
  expect(mock.create.mock.calls[0][0]).toMatchObject({ status: 'pending', ...edition });
  expect(mock.create.mock.calls[0][0].activeZone).toBeUndefined();
  expect(mock.queue).toHaveBeenCalledOnce();
  expect(result.body).not.toContain('confirmToken');
});
it('does not send for a honeypot, disallowed origin, missing consent, or invalid county', async () => {
  await handler(event('/subscribe', 'POST', { email: 'reader@example.com', consent: true, edition, website: 'bot' }));
  expect((await handler(event('/subscribe', 'POST', { email: 'reader@example.com', edition }))).statusCode).toBe(400);
  expect((await handler(event('/subscribe', 'POST', { email: 'reader@example.com', consent: true, edition: { ...edition, county: 'nonexistent' } }))).statusCode).toBe(400);
  expect((await handler(event('/subscribe', 'POST', {}, { origin: 'https://evil.example', 'content-type': 'application/json' }))).statusCode).toBe(403);
  expect(mock.queue).not.toHaveBeenCalled();
});
it('does not change an active subscription from a public signup', async () => {
  mock.get.mockImplementation(async (pk: string) => pk.startsWith('SUB#') ? { pk, status: 'active', email: 'reader@example.com', ...edition } : undefined);
  const result = await handler(event('/subscribe', 'POST', { email: 'reader@example.com', consent: true, edition: { ...edition, timeZone: 'America/Denver' } }));
  expect(result.statusCode).toBe(202);
  expect(mock.create).not.toHaveBeenCalled(); expect(mock.db).not.toHaveBeenCalled();
  expect(mock.queue.mock.calls[0][0].input.MessageBody).toContain('manage');
});
it('serves saved Morning Post stories without exposing other records', async () => {
  const story = { pk: 'STORY#0123456789abcdef0123', id: '0123456789abcdef0123', title: 'Council approves budget', source: 'Amarillo Globe-News', link: 'https://www.amarillo.com/story/news/1', publishedAt: '2026-10-13T10:00:00.000Z', topic: 'general', deskTitle: 'Headlines', edition: { level: 'county', state: 'texas', county: 'potter' }, expires: 1700000001 };
  mock.get.mockImplementation(async (pk: string) => pk === story.pk ? story : undefined);
  const found = await handler(event('/stories/0123456789abcdef0123', 'GET'));
  expect(found.statusCode).toBe(200);
  const { pk: _pk, expires: _expires, ...visible } = story;
  expect(JSON.parse(found.body).story).toEqual(visible);
  expect((await handler(event('/stories/fffffffffffffffffff0', 'GET'))).statusCode).toBe(404);
  mock.get.mockResolvedValue({ ...story, expires: 1699999999 });
  expect((await handler(event('/stories/0123456789abcdef0123', 'GET'))).statusCode).toBe(404);
  expect((await handler(event('/stories/SUB%23anything', 'GET'))).statusCode).toBe(404);
  expect(mock.get).not.toHaveBeenCalledWith(expect.stringMatching(/^SUB#/));
});
it('link scanners cannot confirm or unsubscribe with GET', async () => {
  expect((await handler(event('/confirm', 'GET'))).statusCode).toBe(404);
  expect((await handler(event('/unsubscribe', 'GET'))).statusCode).toBe(404);
  expect(mock.confirm).not.toHaveBeenCalled(); expect(mock.unsubscribe).not.toHaveBeenCalled();
});
it('accepts RFC8058 one-click POST without browser origin', async () => {
  mock.token.mockResolvedValue({ pk: 'subscription' });
  const request = event('/unsubscribe', 'POST');
  request.headers = { 'content-type': 'application/x-www-form-urlencoded' };
  request.rawQueryString = 'token=opaque'; request.body = 'List-Unsubscribe=One-Click';
  expect((await handler(request)).statusCode).toBe(200);
  expect(mock.unsubscribe).toHaveBeenCalledWith({ pk: 'subscription' });
});
it('fails closed while sender setup is incomplete', async () => {
  process.env.SENDING_ENABLED = 'false';
  expect((await handler(event('/subscribe', 'POST', { email: 'reader@example.com', consent: true, edition }))).statusCode).toBe(503);
  expect(mock.queue).not.toHaveBeenCalled();
});

const confirmed = { ...edition, pk: 'SUB#reader', email: 'reader@example.com', status: 'active', confirmToken: 'confirm-token', manageToken: 'manage-token', firstEditionDate: '2026-10-13', firstEditionTimeZone: 'America/Chicago' };
it('queues the confirmation day edition immediately with its subscriber and token version', async () => {
  mock.token.mockResolvedValue({ ...confirmed, status: 'pending' });
  mock.confirm.mockResolvedValue(confirmed);
  const result = await handler(event('/confirm', 'POST', { token: 'confirm-token' }));
  expect(result.statusCode).toBe(200);
  expect(JSON.parse(mock.queue.mock.calls[0][0].input.MessageBody)).toEqual({ kind: 'daily', trigger: 'confirmation', subscriber: confirmed.pk, date: '2026-10-13', timeZone: 'America/Chicago', version: 'confirm-token' });
  expect(JSON.parse(result.body).message).toContain("Today's edition is on its way");
});
it('reports queue failure and lets confirmation retry recover the same day request', async () => {
  mock.token.mockResolvedValue(confirmed); mock.confirm.mockResolvedValue(confirmed);
  mock.queue.mockRejectedValueOnce(new Error('SQS unavailable')).mockResolvedValueOnce({});
  expect((await handler(event('/confirm', 'POST', { token: 'confirm-token' }))).statusCode).toBe(503);
  expect((await handler(event('/confirm', 'POST', { token: 'confirm-token' }))).statusCode).toBe(200);
  const jobs = mock.queue.mock.calls.map(call => JSON.parse(call[0].input.MessageBody));
  expect(jobs[0]).toEqual(jobs[1]);
});
it('does not turn an old confirmation into an on-demand newsletter resend', async () => {
  mock.token.mockResolvedValue(confirmed); mock.confirm.mockResolvedValue(confirmed);
  vi.setSystemTime(new Date('2026-10-14T20:00:00Z'));
  const result = await handler(event('/confirm', 'POST', { token: 'confirm-token' }));
  expect(result.statusCode).toBe(200); expect(mock.queue).not.toHaveBeenCalled();
  expect(result.body).not.toContain('on its way');
});
it('never queues an edition when confirmation is rejected', async () => {
  mock.token.mockResolvedValue(confirmed); mock.confirm.mockRejectedValue(new Error('Unsubscribed or suppressed'));
  expect((await handler(event('/confirm', 'POST', { token: 'confirm-token' }))).statusCode).toBe(503);
  expect(mock.queue).not.toHaveBeenCalled();
});

const invitation = { senderName: 'Jamie Reader', senderEmail: 'jamie@example.com', recipientEmail: 'friend@example.com', consent: true, edition };
it.each([
  { level: 'national', timeZone: 'America/New_York' },
  { level: 'state', state: 'arizona' },
  { level: 'county', state: 'texas', county: 'potter' },
])('creates a pending gift for %j without enrolling the sender', async giftEdition => {
  const result = await handler(event('/invite', 'POST', { ...invitation, edition: giftEdition }));
  expect(result.statusCode).toBe(202);
  expect(mock.create).toHaveBeenCalledOnce();
  const sub = mock.create.mock.calls[0][0];
  expect(sub).toMatchObject({ ...giftEdition, email: 'friend@example.com', status: 'pending', invitedBy: { name: 'Jamie Reader', email: 'jamie@example.com' } });
  expect(sub.activeZone).toBeUndefined();
  expect(JSON.parse(mock.queue.mock.calls[0][0].input.MessageBody)).toMatchObject({ kind: 'confirm', subscriber: sub.pk, version: sub.confirmToken, request: sub.confirmToken });
  expect(result.body).not.toContain(sub.confirmToken);
  expect(result.body).not.toContain('friend@example.com');
  expect(mock.rateLimit.mock.calls.map(call => call.slice(1))).toEqual([[20, 3600], [5, 86400], [3, 86400], [1000, 86400]]);
});
it.each([
  { consent: false }, { senderName: '' }, { senderName: 'x'.repeat(81) }, { senderName: 'Jamie\r\nBcc: other@example.com' },
  { senderEmail: 'invalid' }, { recipientEmail: 'invalid' }, { recipientEmail: 'JAMIE@example.com' },
  { edition: { level: 'county', state: 'texas', county: 'missing' } },
])('rejects invalid gift fields %j before sending', async changes => {
  expect((await handler(event('/invite', 'POST', { ...invitation, ...changes }))).statusCode).toBe(400);
  expect(mock.create).not.toHaveBeenCalled(); expect(mock.queue).not.toHaveBeenCalled();
});
it('honors the honeypot, origin restriction and sending switch for gifts', async () => {
  expect((await handler(event('/invite', 'POST', { ...invitation, website: 'bot' }))).statusCode).toBe(202);
  expect((await handler(event('/invite', 'POST', invitation, { origin: 'https://evil.example', 'content-type': 'application/json' }))).statusCode).toBe(403);
  process.env.SENDING_ENABLED = 'false';
  expect((await handler(event('/invite', 'POST', invitation))).statusCode).toBe(503);
  expect(mock.create).not.toHaveBeenCalled(); expect(mock.queue).not.toHaveBeenCalled();
});
it.each(['active', 'unsubscribed', 'pending'])('does not replace an existing %s signup with a gift or expose its status', async status => {
  mock.get.mockImplementation(async (pk: string) => pk.startsWith('SUB#') ? { ...confirmed, pk, status, confirmExpires: 1800000000 } : undefined);
  const result = await handler(event('/invite', 'POST', invitation));
  expect(result.statusCode).toBe(202);
  expect(result.body).toContain('Your invitation request has been received');
  expect(mock.create).not.toHaveBeenCalled(); expect(mock.db).not.toHaveBeenCalled(); expect(mock.queue).not.toHaveBeenCalled();
});
it('does not send to suppressed recipients', async () => {
  mock.get.mockImplementation(async (pk: string) => pk.startsWith('SUPPRESS#') ? { reason: 'Complaint' } : undefined);
  expect((await handler(event('/invite', 'POST', invitation))).statusCode).toBe(202);
  expect(mock.create).not.toHaveBeenCalled(); expect(mock.queue).not.toHaveBeenCalled();
});
it('propagates rate limits without creating or sending invitations', async () => {
  const { InputError } = await import('../src/model');
  mock.rateLimit.mockRejectedValue(new InputError('Please try again later.', 429));
  expect((await handler(event('/invite', 'POST', invitation))).statusCode).toBe(429);
  expect(mock.create).not.toHaveBeenCalled(); expect(mock.queue).not.toHaveBeenCalled();
});
it('retries queue failure using the original gift token and a stable send claim', async () => {
  let saved: any;
  mock.create.mockImplementation(async sub => { saved = sub; });
  mock.get.mockImplementation(async (pk: string) => pk.startsWith('SUB#') ? saved : undefined);
  mock.queue.mockRejectedValueOnce(new Error('SQS unavailable')).mockResolvedValueOnce({});
  expect((await handler(event('/invite', 'POST', invitation))).statusCode).toBe(503);
  expect((await handler(event('/invite', 'POST', invitation))).statusCode).toBe(202);
  expect(mock.create).toHaveBeenCalledOnce(); expect(mock.db).not.toHaveBeenCalled();
  expect(mock.queue.mock.calls[0][0].input.MessageBody).toEqual(mock.queue.mock.calls[1][0].input.MessageBody);
});
it('does not let a different sender overwrite a pending gift', async () => {
  mock.get.mockImplementation(async (pk: string) => pk.startsWith('SUB#') ? { ...confirmed, pk, status: 'pending', confirmExpires: 1800000000, invitedBy: { name: 'Other sender', email: 'other@example.com' } } : undefined);
  expect((await handler(event('/invite', 'POST', invitation))).statusCode).toBe(202);
  expect(mock.create).not.toHaveBeenCalled(); expect(mock.db).not.toHaveBeenCalled(); expect(mock.queue).not.toHaveBeenCalled();
});
it('renews an expired pending invitation only if its previous version still matches', async () => {
  mock.get.mockImplementation(async (pk: string) => pk.startsWith('SUB#') ? { ...confirmed, pk, status: 'pending', confirmExpires: 1 } : undefined);
  expect((await handler(event('/invite', 'POST', invitation))).statusCode).toBe(202);
  const put = mock.db.mock.calls[0][0].input.TransactItems[0].Put;
  expect(put.ConditionExpression).toBe('#status = :pending AND confirmToken = :previous');
  expect(put.ExpressionAttributeValues).toEqual({ ':pending': 'pending', ':previous': confirmed.confirmToken });
  expect(put.Item.status).toBe('pending');
  expect(put.Item.confirmToken).not.toBe(confirmed.confirmToken);
});
