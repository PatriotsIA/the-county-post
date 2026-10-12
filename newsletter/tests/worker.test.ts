import { beforeEach, expect, it, vi } from 'vitest';
import type { SQSEvent } from 'aws-lambda';
const mock = vi.hoisted(() => ({ records: new Map<string, any>(), ses: vi.fn(), s3: vi.fn(), sqs: vi.fn(), rate: vi.fn(), query: vi.fn(), db: vi.fn(), get: vi.fn() }));
vi.mock('../src/store', () => ({
  get: mock.get,
  put: async (item: any, condition?: string) => { if (condition && mock.records.has(item.pk)) throw { name: 'ConditionalCheckFailedException' }; mock.records.set(item.pk, item); },
  remove: async (pk: string) => { mock.records.delete(pk); },
  conditional: (error: any) => error.name === 'ConditionalCheckFailedException',
  rateLimit: mock.rate, activePage: mock.query, seconds: () => Math.floor(Date.now() / 1000), db: { send: mock.db }, table: () => 'test',
}));
vi.mock('@aws-sdk/client-sesv2', () => ({ SESv2Client: class { send = mock.ses; }, SendEmailCommand: class { constructor(public input: any) {} } }));
vi.mock('@aws-sdk/client-s3', () => ({ S3Client: class { send = mock.s3; }, GetObjectCommand: class {}, PutObjectCommand: class {} }));
vi.mock('@aws-sdk/client-sqs', () => ({ SQSClient: class { send = mock.sqs; }, SendMessageCommand: class { constructor(public input: any) {} } }));
vi.mock('node:timers/promises', () => ({ setTimeout: async () => {} }));
import { handler, dailyJobIsCurrent } from '../src/worker';
const sub = { pk: 'SUB#test', email: 'reader@example.com', level: 'national' as const, timeZone: 'America/Chicago', status: 'active' as const, manageToken: 'opaque', confirmToken: 'confirm', confirmExpires: 9999999999, createdAt: '2026-10-11T00:00:00Z' };
const job = { kind: 'daily' as const, subscriber: sub.pk, timeZone: sub.timeZone, date: '2026-10-12' };
const queue = () => ({ Records: [{ messageId: 'sqs-id', body: JSON.stringify(job) }] }) as SQSEvent;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-12T11:15:00Z')); vi.clearAllMocks(); mock.records.clear();
  process.env.SENDING_ENABLED = 'true'; process.env.NEWSLETTER_ADDRESS = 'Public business address'; process.env.FROM_EMAIL = 'newsletters@thecountypost.com'; process.env.PUBLIC_API_URL = 'https://newsletter.example';
  mock.records.set(sub.pk, { ...sub }); mock.get.mockImplementation(async (key: string) => mock.records.get(key));
  mock.ses.mockResolvedValue({ MessageId: 'ses-id' });
  mock.s3.mockResolvedValue({ Body: { transformToString: async () => JSON.stringify({ edition: sub, label: 'National', url: 'https://thecountypost.com/', builtAt: '2026-10-12T11:15:00Z', forecasts: [], sections: [{ title: 'Headlines', url: 'https://thecountypost.com/#desk-general', stories: [] }, { title: 'Sports', url: 'https://thecountypost.com/#desk-sports', stories: [] }] }) } });
});
it('sends once despite duplicate jobs and includes one-click unsubscribe', async () => {
  expect(await handler(queue())).toEqual({ batchItemFailures: [] });
  expect(await handler(queue())).toEqual({ batchItemFailures: [] });
  expect(mock.ses).toHaveBeenCalledOnce();
  expect(mock.ses.mock.calls[0][0].input.Content.Simple.Headers).toContainEqual({ Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' });
});
it('rechecks unsubscribe after content retrieval', async () => {
  mock.s3.mockImplementation(async () => { mock.records.set(sub.pk, { ...sub, status: 'unsubscribed' }); return { Body: { transformToString: async () => JSON.stringify({ edition: sub, label: 'National', url: 'https://thecountypost.com/', builtAt: '2026-10-12T11:15:00Z', forecasts: [], sections: [{ title: 'Headlines', url: 'https://thecountypost.com/', stories: [] }, { title: 'Sports', url: 'https://thecountypost.com/', stories: [] }] }) } }; });
  await handler(queue()); expect(mock.ses).not.toHaveBeenCalled();
});
it('never automatically resends after an ambiguous SES network timeout', async () => {
  mock.ses.mockRejectedValueOnce(new Error('Network timeout'));
  expect(await handler(queue())).toEqual({ batchItemFailures: [{ itemIdentifier: 'sqs-id' }] });
  expect(await handler(queue())).toEqual({ batchItemFailures: [{ itemIdentifier: 'sqs-id' }] });
  expect(mock.ses).toHaveBeenCalledOnce();
});
it('retries an explicit throttle safely', async () => {
  mock.ses.mockRejectedValueOnce(Object.assign(new Error('Throttled'), { name: 'TooManyRequestsException' }));
  await handler(queue()); await handler(queue()); expect(mock.ses).toHaveBeenCalledTimes(2);
});
it('respects local 6:15 delivery with DST and refuses stale or wrong-timezone jobs', () => {
  expect(dailyJobIsCurrent(job, sub, new Date('2026-10-12T11:14:59Z'))).toBe(false);
  expect(dailyJobIsCurrent(job, sub, new Date('2026-10-12T11:15:00Z'))).toBe(true);
  expect(dailyJobIsCurrent({ ...job, date: '2026-12-12' }, sub, new Date('2026-12-12T12:15:00Z'))).toBe(true);
  expect(dailyJobIsCurrent(job, sub, new Date('2026-10-12T13:15:00Z'))).toBe(false);
  expect(dailyJobIsCurrent({ ...job, timeZone: 'America/Denver' }, sub)).toBe(false);
});
it('suppresses bounced recipients without sending further newsletters', async () => {
  await handler({ source: 'aws.ses', detail: { eventType: 'Bounce', bounce: { bounceType: 'Permanent', bouncedRecipients: [{ emailAddress: sub.email }] } } });
  await handler(queue()); expect(mock.ses).not.toHaveBeenCalled();
});
