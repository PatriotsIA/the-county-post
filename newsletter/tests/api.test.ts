import { beforeEach, expect, it, vi } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
const mock = vi.hoisted(() => ({ get: vi.fn(), rateLimit: vi.fn(), create: vi.fn(), token: vi.fn(), confirm: vi.fn(), unsubscribe: vi.fn(), queue: vi.fn(), db: vi.fn() }));
vi.mock('../src/store', () => ({ get: mock.get, rateLimit: mock.rateLimit, createSubscriber: mock.create, findByToken: mock.token, confirm: mock.confirm, unsubscribe: mock.unsubscribe, seconds: () => 1700000000, db: { send: mock.db }, table: () => 'test' }));
vi.mock('@aws-sdk/client-sqs', () => ({ SQSClient: class { send = mock.queue; }, SendMessageCommand: class { constructor(public input: unknown) {} } }));
import { handler } from '../src/api';
const edition = { level: 'county', state: 'texas', county: 'potter', timeZone: 'America/Chicago' };
const event = (path: string, method: string, body: unknown = {}, headers = { origin: 'https://thecountypost.com', 'content-type': 'application/json' }) => ({ rawPath: path, rawQueryString: '', headers, requestContext: { http: { method, sourceIp: '192.0.2.1' } }, body: JSON.stringify(body) }) as unknown as APIGatewayProxyEventV2;
beforeEach(() => { vi.clearAllMocks(); mock.get.mockResolvedValue(undefined); process.env.SENDING_ENABLED = 'true'; process.env.QUEUE_URL = 'queue'; });
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
