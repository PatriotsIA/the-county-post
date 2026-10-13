import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { SQSEvent } from 'aws-lambda';
import { setTimeout as delay } from 'node:timers/promises';
import { buildDigest, renderDigest, escapeHtml, type Digest } from './content';
import { SITE, ZONES, editionKey, editionLabel, localDate, hash, type Subscriber } from './model';
import { db, table, get, put, remove, conditional, activePage, rateLimit, seconds } from './store';
import { recordEngagement } from './analytics';

const sqs = new SQSClient({});
const s3 = new S3Client({});
// SES has no idempotency key. Do not let SDK retries duplicate an ambiguous send.
const ses = new SESv2Client({ maxAttempts: 1 });
type Job = { kind: 'plan' | 'daily' | 'confirm' | 'manage'; trigger?: 'confirmation'; timeZone?: string; date?: string; cursor?: Record<string, unknown>; subscriber?: string; version?: string; request?: string };
export async function enqueue(job: Job) { await sqs.send(new SendMessageCommand({ QueueUrl: process.env.QUEUE_URL!, MessageBody: JSON.stringify(job) })); }
export async function snapshot(sub: Subscriber, date: string, beforeMorning = false) {
  // A pre-6:15 confirmation must not freeze the scheduled morning's content early.
  const key = `editions/${date}/${beforeMorning ? 'early/' : ''}${hash(`${editionKey(sub)}|${sub.timeZone}`)}.json`;
  const read = async () => {
    try { const r = await s3.send(new GetObjectCommand({ Bucket: process.env.CONTENT_BUCKET!, Key: key })); return JSON.parse((await r.Body?.transformToString()) || '{}') as Digest; }
    catch (error) { if (['NoSuchKey', 'NotFound'].includes((error as Error).name)) return undefined; throw error; }
  };
  const cached = await read();
  if (cached) return cached;
  const lease = `BUILD#${key}`;
  try {
    await db.send(new UpdateCommand({ TableName: table(), Key: { pk: lease }, UpdateExpression: 'SET expires = :until', ConditionExpression: 'attribute_not_exists(pk) OR expires < :now', ExpressionAttributeValues: { ':until': seconds() + 360, ':now': seconds() } }));
  } catch (error) { if (conditional(error)) throw new Error('Edition is being prepared; retry later.'); throw error; }
  try {
    const existing = await read();
    if (existing) return existing;
    const digest = await buildDigest(sub);
    await s3.send(new PutObjectCommand({ Bucket: process.env.CONTENT_BUCKET!, Key: key, Body: JSON.stringify(digest), ContentType: 'application/json' }));
    return digest;
  } finally { await remove(lease); }
}
function localMinutes(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const hour = Number(parts.find(p => p.type === 'hour')?.value);
  const minute = Number(parts.find(p => p.type === 'minute')?.value);
  return hour * 60 + minute;
}
export function dailyJobIsCurrent(job: Job, sub: Subscriber, now = new Date()) {
  if (job.date !== localDate(sub.timeZone, now) || job.timeZone !== sub.timeZone) return false;
  if (job.trigger === 'confirmation') return job.version === sub.confirmToken && job.date === sub.firstEditionDate && job.timeZone === sub.firstEditionTimeZone;
  // Scheduled retries retain the morning cutoff. Only a matching first-edition
  // request may deliver at another time, and never on a later local date.
  return localMinutes(sub.timeZone, now) >= 375 && localMinutes(sub.timeZone, now) < 495;
}
async function processJob(job: Job) {
  if (process.env.SENDING_ENABLED !== 'true') return;
  if (job.kind === 'plan') {
    if (!ZONES.includes(job.timeZone as typeof ZONES[number])) throw new Error('Unknown schedule timezone');
    const date = job.date || localDate(job.timeZone!);
    if (date !== localDate(job.timeZone!)) return;
    // Continuation uses LastEvaluatedKey so one large timezone cannot time out the planner.
    const current = await activePage(job.timeZone!, job.cursor);
    for (const item of current.Items || []) await enqueue({ kind: 'daily', subscriber: item.pk, date, timeZone: job.timeZone });
    if (current.LastEvaluatedKey) await enqueue({ ...job, date, cursor: current.LastEvaluatedKey });
    return;
  }
  let sub = await get<Subscriber>(job.subscriber!);
  if (!sub || await get(`SUPPRESS#${hash(sub.email)}`)) return;
  if (job.kind === 'daily' && (sub.status !== 'active' || !dailyJobIsCurrent(job, sub))) return;
  if (job.kind === 'confirm' && (sub.status !== 'pending' || sub.confirmToken !== job.version || sub.confirmExpires < seconds())) return;
  if (job.kind === 'manage' && sub.status !== 'active') return;
  if (!process.env.NEWSLETTER_ADDRESS || !process.env.FROM_EMAIL) throw new Error('Sender and mailing address are required before delivery.');
  const manageUrl = `${SITE}/newsletter#manage=${sub.manageToken}`;
  const unsubscribePage = `${SITE}/newsletter#unsubscribe=${sub.manageToken}`;
  const unsubscribeApi = `${process.env.PUBLIC_API_URL!.replace(/\/$/, '')}/unsubscribe?token=${sub.manageToken}`;
  let content: { subject: string; html: string; text: string };
  if (job.kind === 'daily') {
    content = renderDigest(await snapshot(sub, job.date!, localMinutes(sub.timeZone) < 375), { date: job.date!, timeZone: sub.timeZone, manageUrl, unsubscribeUrl: unsubscribePage, address: process.env.NEWSLETTER_ADDRESS });
  } else {
    const confirming = job.kind === 'confirm';
    const url = confirming ? `${SITE}/newsletter#confirm=${sub.confirmToken}` : manageUrl;
    const subject = `${confirming ? 'Confirm' : 'Manage'} your ${editionLabel(sub)} Morning Post`;
    const message = `You requested the ${editionLabel(sub)} newsletter from The County Post. Delivery is daily at 6:15 a.m. ${sub.timeZone}. ${confirming ? "Confirm below to receive today's edition now and start daily delivery. This link expires in 48 hours." : 'Use the link below to manage your existing subscription.'}`;
    content = { subject, text: `${message}\n\n${url}\n\nIf you did not request this, ignore this email.\nThe County Post\n${process.env.NEWSLETTER_ADDRESS}`, html: `<html lang="en"><body style="background:#fffdf7;color:#202020;font:16px/1.7 Georgia,serif;padding:24px;max-width:600px"><h1>The County Post</h1><h2>${escapeHtml(subject)}</h2><p>${escapeHtml(message)}</p><p><a href="${url}" style="color:#173e64">${confirming ? 'Confirm my subscription' : 'Manage my subscription'}</a></p><p>If you did not request this, ignore this email.</p><p style="font-size:12px">The County Post<br>${escapeHtml(process.env.NEWSLETTER_ADDRESS)}</p></body></html>` };
  }
  // Recheck consent after feed generation, immediately before the send claim.
  sub = await get<Subscriber>(job.subscriber!);
  if (!sub || await get(`SUPPRESS#${hash(sub.email)}`) || (job.kind === 'daily' && (sub.status !== 'active' || !dailyJobIsCurrent(job, sub))) || (job.kind === 'confirm' && (sub.status !== 'pending' || sub.confirmToken !== job.version))) return;
  const key = `SEND#${job.kind}#${sub.pk}#${job.kind === 'daily' ? job.date : job.request}`;
  const previous = await get<{ status: string }>(key);
  if (previous?.status === 'sent') return;
  if (previous) throw new Error('Ambiguous prior send: manual review required; refusing duplicate.');
  await rateLimit('send-budget', Number(process.env.DAILY_SEND_BUDGET || 5000), 86400);
  try { await put({ pk: key, status: 'sending', expires: seconds() + 35 * 86400 }, 'attribute_not_exists(pk)'); }
  catch (error) { if (conditional(error)) throw new Error('Send already claimed'); throw error; }
  try {
    const sent = await ses.send(new SendEmailCommand({
      FromEmailAddress: `The County Post <${process.env.FROM_EMAIL}>`, ReplyToAddresses: ['submissions@thecountypost.com'],
      Destination: { ToAddresses: [sub.email] }, ConfigurationSetName: process.env.CONFIGURATION_SET,
      EmailTags: [{ Name: 'newsletter', Value: 'morning-post' }, { Name: 'kind', Value: job.kind }, { Name: 'edition', Value: editionKey(sub).replaceAll('/', '_') }, { Name: 'edition_date', Value: job.date || localDate(sub.timeZone) }],
      Content: { Simple: { Subject: { Data: content.subject, Charset: 'UTF-8' }, Body: { Html: { Data: content.html, Charset: 'UTF-8' }, Text: { Data: content.text, Charset: 'UTF-8' } },
        ...(job.kind === 'daily' ? { Headers: [{ Name: 'List-Unsubscribe', Value: `<${unsubscribeApi}>` }, { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' }, { Name: 'List-ID', Value: 'The County Post Morning Post <morning.thecountypost.com>' }] } : {}),
      } },
    }));
    await put({ pk: key, status: 'sent', messageId: sent.MessageId, expires: seconds() + 35 * 86400 });
    console.log(JSON.stringify({ event: 'newsletter_sent', kind: job.kind, messageId: sent.MessageId }));
  } catch (error) {
    // Only known rejections are safe to retry. Network timeouts may have been accepted by SES.
    if (['TooManyRequestsException', 'LimitExceededException', 'MessageRejected', 'MailFromDomainNotVerifiedException', 'AccountSuspendedException', 'SendingPausedException', 'BadRequestException'].includes((error as Error).name)) await remove(key);
    throw error;
  } finally { await delay(1100); }
}
export async function handler(event: SQSEvent | Job | { source: string; detail: Record<string, any> }) {
  if ('source' in event && event.source === 'aws.ses') {
    const detail = event.detail;
    const recipients = detail.eventType === 'Complaint' ? detail.complaint?.complainedRecipients : detail.eventType === 'Bounce' && detail.bounce?.bounceType === 'Permanent' ? detail.bounce?.bouncedRecipients : [];
    for (const recipient of recipients || []) if (typeof recipient.emailAddress === 'string') await put({ pk: `SUPPRESS#${hash(recipient.emailAddress.toLowerCase())}`, reason: detail.eventType, at: new Date().toISOString() });
    await recordEngagement(detail);
    return;
  }
  if ('Records' in event) {
    const batchItemFailures: { itemIdentifier: string }[] = [];
    for (const record of event.Records) {
      try { await processJob(JSON.parse(record.body)); }
      catch (error) { console.error(JSON.stringify({ event: 'newsletter_job_failed', id: record.messageId, name: (error as Error).name })); batchItemFailures.push({ itemIdentifier: record.messageId }); }
    }
    return { batchItemFailures };
  }
  return processJob(event as Job);
}
