import { beforeEach, expect, it, vi } from 'vitest';
import type { SQSEvent } from 'aws-lambda';
const mock = vi.hoisted(() => ({ records: new Map<string, any>(), ses: vi.fn(), s3: vi.fn(), sqs: vi.fn(), rate: vi.fn(), query: vi.fn(), reminders: vi.fn(), db: vi.fn(), get: vi.fn() }));
vi.mock('../src/store', () => ({
  get: mock.get,
  put: async (item: any, condition?: string) => { if (condition && mock.records.has(item.pk)) throw { name: 'ConditionalCheckFailedException' }; mock.records.set(item.pk, item); },
  remove: async (pk: string) => { mock.records.delete(pk); },
  conditional: (error: any) => error.name === 'ConditionalCheckFailedException',
  rateLimit: mock.rate, activePage: mock.query, confirmationReminderPage: mock.reminders, seconds: () => Math.floor(Date.now() / 1000), db: { send: mock.db }, table: () => 'test',
}));
vi.mock('@aws-sdk/client-sesv2', () => ({ SESv2Client: class { send = mock.ses; }, SendEmailCommand: class { constructor(public input: any) {} } }));
vi.mock('@aws-sdk/client-s3', () => ({ S3Client: class { send = mock.s3; }, GetObjectCommand: class { constructor(public input: any) {} }, PutObjectCommand: class { constructor(public input: any) {} } }));
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
  mock.sqs.mockReset().mockResolvedValue({});
  mock.reminders.mockReset().mockResolvedValue({ Items: [] });
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

const firstSub = { ...sub, firstEditionDate: job.date, firstEditionTimeZone: sub.timeZone };
const immediate = { ...job, trigger: 'confirmation' as const, version: sub.confirmToken };
it('sends the confirmed edition in the afternoon and deduplicates repeated confirmations', async () => {
  vi.setSystemTime(new Date('2026-10-12T20:00:00Z'));
  mock.records.set(sub.pk, firstSub);
  await handler(immediate); await handler(immediate);
  expect(mock.ses).toHaveBeenCalledOnce();
  expect(mock.records.get(`SEND#daily#${sub.pk}#2026-10-12`).status).toBe('sent');
  expect(mock.ses.mock.calls[0][0].input.Content.Simple.Headers).toContainEqual({ Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' });
});
it('a pre-morning confirmation does not freeze the scheduled snapshot or duplicate the morning send', async () => {
  vi.setSystemTime(new Date('2026-10-12T09:00:00Z'));
  mock.records.set(sub.pk, firstSub);
  await handler(immediate);
  expect(mock.s3.mock.calls[0][0].input.Key).toContain('/early/');
  vi.setSystemTime(new Date('2026-10-12T11:15:00Z'));
  await handler(job);
  expect(mock.ses).toHaveBeenCalledOnce();
});
it('a scheduled send followed by confirmation cannot send the same edition twice', async () => {
  mock.records.set(sub.pk, firstSub);
  await handler(job);
  vi.setSystemTime(new Date('2026-10-12T20:00:00Z'));
  await handler(immediate);
  expect(mock.ses).toHaveBeenCalledOnce();
});
it('immediate delivery requires the original confirmation date, timezone, token and active consent', async () => {
  const now = new Date('2026-10-12T20:00:00Z');
  expect(dailyJobIsCurrent(immediate, firstSub, now)).toBe(true);
  expect(dailyJobIsCurrent(job, firstSub, now)).toBe(false);
  expect(dailyJobIsCurrent({ ...immediate, version: 'old-token' }, firstSub, now)).toBe(false);
  expect(dailyJobIsCurrent(immediate, { ...firstSub, firstEditionDate: '2026-10-11' }, now)).toBe(false);
  expect(dailyJobIsCurrent(immediate, firstSub, new Date('2026-10-13T05:00:00Z'))).toBe(false);
  expect(dailyJobIsCurrent(immediate, { ...firstSub, timeZone: 'America/Denver' }, now)).toBe(false);
  vi.setSystemTime(now);
  mock.records.set(sub.pk, { ...firstSub, status: 'unsubscribed' });
  await handler(immediate);
  expect(mock.ses).not.toHaveBeenCalled();
});
it('cancels immediate delivery if a reader unsubscribes while content is being prepared', async () => {
  vi.setSystemTime(new Date('2026-10-12T20:00:00Z'));
  mock.records.set(sub.pk, firstSub);
  const content = await mock.s3();
  mock.s3.mockImplementation(async () => { mock.records.set(sub.pk, { ...firstSub, status: 'unsubscribed' }); return content; });
  await handler(immediate);
  expect(mock.ses).not.toHaveBeenCalled();
});

const giftSub = { ...sub, status: 'pending' as const, invitedBy: { name: 'Jamie <Reader> & family', email: 'jamie@example.com' } };
const giftJob = { kind: 'confirm' as const, subscriber: sub.pk, version: sub.confirmToken, request: sub.confirmToken };
it('sends one personalized invitation and sends no daily edition before confirmation', async () => {
  mock.records.set(sub.pk, giftSub);
  await handler(job); expect(mock.ses).not.toHaveBeenCalled();
  await handler(giftJob); await handler(giftJob);
  expect(mock.ses).toHaveBeenCalledOnce();
  const message = mock.ses.mock.calls[0][0].input;
  expect(message.Destination.ToAddresses).toEqual([sub.email]);
  expect(message.FromEmailAddress).toBe('The County Post <newsletters@thecountypost.com>');
  expect(message.ReplyToAddresses).toEqual(['submissions@thecountypost.com']);
  expect(message.Content.Simple.Subject.Data).toBe('A gift for you: the free National Morning Post');
  const { Html, Text } = message.Content.Simple.Body;
  expect(Html.Data).toContain('Jamie &lt;Reader&gt; &amp; family');
  expect(Html.Data).not.toContain('Jamie <Reader>');
  for (const value of ['jamie@example.com', 'The County Post brings together', 'You are not subscribed yet', 'today’s edition', '/newsletter#confirm=confirm', '/newsletter#unsubscribe=opaque']) {
    expect(Html.Data).toContain(value); expect(Text.Data).toContain(value);
  }
  // Recipient confirmation activates the same subscriber and immediate-send path.
  vi.setSystemTime(new Date('2026-10-12T20:00:00Z'));
  mock.records.set(sub.pk, { ...giftSub, ...firstSub });
  await handler(immediate); await handler(immediate);
  expect(mock.ses).toHaveBeenCalledTimes(2);
  expect(mock.ses.mock.calls[1][0].input.Content.Simple.Subject.Data).toBe('National Morning Post · 2026-10-12');
});
it.each(['unsubscribed', 'active', 'expired', 'superseded', 'suppressed'])('does not send a gift that is %s', async reason => {
  mock.records.set(sub.pk, { ...giftSub, ...(reason === 'active' || reason === 'unsubscribed' ? { status: reason } : {}), ...(reason === 'expired' ? { confirmExpires: 1 } : {}), ...(reason === 'superseded' ? { confirmToken: 'new-token' } : {}) });
  if (reason === 'suppressed') {
    const { hash } = await import('../src/model');
    mock.records.set(`SUPPRESS#${hash(sub.email)}`, { reason: 'Complaint' });
  }
  await handler(giftJob); expect(mock.ses).not.toHaveBeenCalled();
});

const pendingSub = { ...sub, status: 'pending' as const, createdAt: '2026-10-11T11:15:00.000Z', confirmExpires: Date.parse('2026-10-13T11:15:00Z') / 1000 };
const reminderJob = { kind: 'reminder' as const, subscriber: sub.pk, version: sub.confirmToken };
it('sends a single reminder at 24 hours with the original token, actual deadline and both confirmation steps', async () => {
  mock.records.set(sub.pk, pendingSub);
  vi.setSystemTime(new Date('2026-10-12T11:14:59Z'));
  await handler(reminderJob); expect(mock.ses).not.toHaveBeenCalled();
  vi.setSystemTime(new Date('2026-10-12T11:15:00Z'));
  await handler(reminderJob); await handler({ ...reminderJob, request: 'duplicate-schedule' });
  expect(mock.ses).toHaveBeenCalledOnce();
  const message = mock.ses.mock.calls[0][0].input;
  expect(message.EmailTags).toContainEqual({ Name: 'kind', Value: 'reminder' });
  expect(message.Content.Simple.Subject.Data).toBe('Reminder: confirm your National Morning Post');
  for (const body of [message.Content.Simple.Body.Html.Data, message.Content.Simple.Body.Text.Data]) {
    for (const text of ['one-time reminder', 'Confirm my subscription', 'Confirm subscription', 'Spam or Junk', 'newsletters@thecountypost.com', '/newsletter#confirm=confirm', 'Oct 13, 2026', 'Cancel this signup', '/newsletter#unsubscribe=opaque']) expect(body).toContain(text);
    expect(body).not.toContain('expires in 48 hours');
  }
  expect(mock.records.get(sub.pk)).toEqual(pendingSub);
});
it.each(['active', 'unsubscribed', 'expired', 'superseded', 'suppressed', 'renewed', 'invalid-created-date'])('does not remind a subscription that is %s', async reason => {
  mock.records.set(sub.pk, { ...pendingSub,
    ...(reason === 'active' || reason === 'unsubscribed' ? { status: reason } : {}),
    ...(reason === 'expired' ? { confirmExpires: Date.now() / 1000 } : {}),
    ...(reason === 'superseded' ? { confirmToken: 'new-token' } : {}),
    ...(reason === 'renewed' ? { createdAt: new Date().toISOString() } : {}),
    ...(reason === 'invalid-created-date' ? { createdAt: 'invalid' } : {}),
  });
  if (reason === 'suppressed') {
    const { hash } = await import('../src/model');
    mock.records.set(`SUPPRESS#${hash(sub.email)}`, { reason: 'Bounce' });
  }
  await handler(reminderJob); expect(mock.ses).not.toHaveBeenCalled();
});
it.each(['active', 'unsubscribed', 'expired', 'superseded'])('rechecks %s immediately before a reminder send', async reason => {
  let reads = 0;
  mock.get.mockImplementation(async (key: string) => key !== sub.pk ? mock.records.get(key) : ++reads === 1 ? pendingSub : {
    ...pendingSub, ...(reason === 'active' || reason === 'unsubscribed' ? { status: reason } : {}),
    ...(reason === 'expired' ? { confirmExpires: 1 } : {}),
    ...(reason === 'superseded' ? { confirmToken: 'new-token' } : {}),
  });
  await handler(reminderJob); expect(mock.ses).not.toHaveBeenCalled();
});
it('preserves gift attribution and decline instructions in the follow-up', async () => {
  mock.records.set(sub.pk, { ...pendingSub, invitedBy: giftSub.invitedBy });
  await handler(reminderJob);
  const body = mock.ses.mock.calls[0][0].input.Content.Simple.Body;
  expect(body.Html.Data).toContain('Jamie &lt;Reader&gt; &amp; family');
  expect(body.Text.Data).toContain('Confirm my free subscription');
  expect(body.Text.Data).toContain('Decline this invitation');
});
it('plans existing due signups, skips stale or previously claimed entries, and continues pagination', async () => {
  const { hash } = await import('../src/model');
  const examples = [pendingSub, { ...pendingSub, pk: 'SUB#confirmed', status: 'active' }, { ...pendingSub, pk: 'SUB#renewed', createdAt: new Date().toISOString() }, { ...pendingSub, pk: 'SUB#sent' }, { ...pendingSub, pk: 'SUB#ambiguous' }, { ...pendingSub, pk: 'SUB#suppressed', email: 'bounced@example.com' }];
  for (const example of examples) mock.records.set(example.pk, example);
  mock.records.set(`SEND#reminder#SUB#sent#${hash(sub.confirmToken)}`, { status: 'sent' });
  mock.records.set(`SEND#reminder#SUB#ambiguous#${hash(sub.confirmToken)}`, { status: 'sending' });
  mock.records.set(`SUPPRESS#${hash('bounced@example.com')}`, { reason: 'Bounce' });
  const cursor = { pk: 'SUB#last', status: 'pending', createdAt: pendingSub.createdAt };
  mock.reminders.mockResolvedValue({ Items: [...examples.map(({ pk }) => ({ pk })), { pk: 'SUB#deleted' }], LastEvaluatedKey: cursor });
  await handler({ kind: 'reminder-plan' });
  expect(mock.sqs.mock.calls.map(call => JSON.parse(call[0].input.MessageBody))).toEqual([reminderJob, { kind: 'reminder-plan', cursor }]);
  mock.reminders.mockResolvedValue({ Items: [] });
  await handler({ kind: 'reminder-plan', cursor });
  expect(mock.reminders).toHaveBeenLastCalledWith(cursor);
});
it('retries a failed reminder enqueue without duplicating email', async () => {
  mock.records.set(sub.pk, pendingSub);
  mock.reminders.mockResolvedValue({ Items: [{ pk: sub.pk }] });
  mock.sqs.mockRejectedValueOnce(new Error('Queue unavailable'));
  await expect(handler({ kind: 'reminder-plan' })).rejects.toThrow('Queue unavailable');
  await handler({ kind: 'reminder-plan' });
  await handler(reminderJob);
  await handler({ kind: 'reminder-plan' });
  expect(mock.sqs).toHaveBeenCalledTimes(2);
  expect(mock.ses).toHaveBeenCalledOnce();
});
it('prevents concurrent reminder jobs from sending twice', async () => {
  mock.records.set(sub.pk, pendingSub);
  await Promise.allSettled([handler(reminderJob), handler(reminderJob)]);
  expect(mock.ses).toHaveBeenCalledOnce();
});
it('retries a known reminder rejection but preserves ambiguous send claims for review', async () => {
  mock.records.set(sub.pk, pendingSub);
  mock.ses.mockRejectedValueOnce(Object.assign(new Error('Throttle'), { name: 'TooManyRequestsException' }));
  await expect(handler(reminderJob)).rejects.toThrow('Throttle');
  mock.ses.mockRejectedValueOnce(new Error('Network timeout'));
  await expect(handler(reminderJob)).rejects.toThrow('Network timeout');
  await expect(handler(reminderJob)).rejects.toThrow('Ambiguous prior send');
  expect(mock.ses).toHaveBeenCalledTimes(2);
});
it('does not plan or send reminders while delivery is disabled', async () => {
  process.env.SENDING_ENABLED = 'false';
  mock.records.set(sub.pk, pendingSub);
  await handler({ kind: 'reminder-plan' }); await handler(reminderJob);
  expect(mock.reminders).not.toHaveBeenCalled(); expect(mock.ses).not.toHaveBeenCalled();
});
