import { TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { analyticsEvent } from './tracking';
import { db, table, seconds } from './store';

export async function recordEngagement(detail: Record<string, any>) {
  const event = analyticsEvent(detail);
  if (!event) return;
  try {
    await db.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: table(), Item: { pk: `EVENT#${event.id}`, type: event.name, edition: event.edition, date: event.date, ga: 'not_attempted', expires: seconds() + 35 * 86400 }, ConditionExpression: 'attribute_not_exists(pk)' } },
      { Update: { TableName: table(), Key: { pk: `METRIC#${event.date}#${event.edition}` }, UpdateExpression: 'SET expires = :expires ADD #metric :one', ExpressionAttributeNames: { '#metric': event.name }, ExpressionAttributeValues: { ':expires': seconds() + 400 * 86400, ':one': 1 } } },
    ] }));
  } catch (error) {
    if ((error as { CancellationReasons?: { Code: string }[] }).CancellationReasons?.[0]?.Code === 'ConditionalCheckFailed') return;
    throw error;
  }
  if (!process.env.GA_API_SECRET) return;
  // Do not log this URL: the Measurement Protocol secret belongs only in Secrets Manager.
  const url = new URL('https://www.google-analytics.com/mp/collect');
  url.searchParams.set('measurement_id', process.env.GA_MEASUREMENT_ID || 'G-ZDZY8JLQKQ');
  url.searchParams.set('api_secret', process.env.GA_API_SECRET);
  let state = 'failed';
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event.payload), signal: AbortSignal.timeout(10000) });
    state = response.ok ? 'accepted' : 'rejected';
  } catch { /* Keep local metrics. GA's protocol does not support reliable send retries. */ }
  await db.send(new UpdateCommand({ TableName: table(), Key: { pk: `EVENT#${event.id}` }, UpdateExpression: 'SET ga = :state', ExpressionAttributeValues: { ':state': state } }));
  console.log(JSON.stringify({ event: 'newsletter_analytics', type: event.name, state }));
}
