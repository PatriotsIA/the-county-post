import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { InputError, hash, localDate, type Subscriber } from './model';

export const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
export const table = () => process.env.TABLE_NAME!;
export const seconds = () => Math.floor(Date.now() / 1000);
export const conditional = (error: unknown) => (error as { name?: string }).name === 'ConditionalCheckFailedException';
export async function get<T>(pk: string) { return (await db.send(new GetCommand({ TableName: table(), Key: { pk }, ConsistentRead: true }))).Item as T | undefined; }
export async function put(item: Record<string, unknown>, condition?: string) { return db.send(new PutCommand({ TableName: table(), Item: item, ConditionExpression: condition })); }
export async function remove(pk: string) { return db.send(new DeleteCommand({ TableName: table(), Key: { pk } })); }
export async function rateLimit(key: string, max: number, duration: number) {
  const slot = Math.floor(seconds() / duration);
  try {
    await db.send(new UpdateCommand({ TableName: table(), Key: { pk: `RATE#${key}#${slot}` }, UpdateExpression: 'SET expires = :expires ADD hits :one', ConditionExpression: 'attribute_not_exists(hits) OR hits < :max', ExpressionAttributeValues: { ':expires': (slot + 2) * duration, ':one': 1, ':max': max } }));
  } catch (e) { if (conditional(e)) throw new InputError('Please try again later.', 429); throw e; }
}
export async function findByToken(token: unknown, purpose: 'confirm' | 'manage') {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new InputError('This link is invalid or expired.', 404);
  const ref = await get<{ subscriber: string; purpose: string; expires?: number }>(`TOKEN#${hash(token)}`);
  if (!ref || ref.purpose !== purpose || (ref.expires && ref.expires < seconds())) throw new InputError('This link is invalid or expired.', 404);
  const sub = await get<Subscriber>(ref.subscriber);
  if (!sub || (purpose === 'confirm' ? sub.confirmToken : sub.manageToken) !== token) throw new InputError('This link is invalid or expired.', 404);
  return sub;
}
export async function createSubscriber(sub: Subscriber) {
  await db.send(new TransactWriteCommand({ TransactItems: [
    { Put: { TableName: table(), Item: sub, ConditionExpression: 'attribute_not_exists(pk)' } },
    { Put: { TableName: table(), Item: { pk: `TOKEN#${hash(sub.confirmToken)}`, purpose: 'confirm', subscriber: sub.pk, expires: sub.confirmExpires } } },
    { Put: { TableName: table(), Item: { pk: `TOKEN#${hash(sub.manageToken)}`, purpose: 'manage', subscriber: sub.pk } } },
  ] }));
}
export async function confirm(sub: Subscriber) {
  if (await get(`SUPPRESS#${hash(sub.email)}`)) throw new InputError('Delivery to this address has been stopped. Contact the desk for help.', 409);
  if (sub.status === 'active') return sub;
  if (sub.confirmExpires < seconds()) throw new InputError('This confirmation has expired. Please subscribe again.');
  try {
    const now = new Date();
    const result = await db.send(new UpdateCommand({ TableName: table(), Key: { pk: sub.pk }, UpdateExpression: 'SET #status = :active, activeZone = :zone, confirmedAt = :now, firstEditionDate = :date, firstEditionTimeZone = :zone REMOVE expires', ConditionExpression: 'confirmToken = :token AND #status = :pending AND confirmExpires >= :seconds AND #timeZone = :zone', ExpressionAttributeNames: { '#status': 'status', '#timeZone': 'timeZone' }, ExpressionAttributeValues: { ':active': 'active', ':pending': 'pending', ':seconds': seconds(), ':zone': sub.timeZone, ':now': now.toISOString(), ':date': localDate(sub.timeZone, now), ':token': sub.confirmToken }, ReturnValues: 'ALL_NEW' }));
    return result.Attributes as Subscriber;
  } catch (error) {
    if (conditional(error)) {
      const current = await get<Subscriber>(sub.pk);
      if (current?.status === 'active' && current.confirmToken === sub.confirmToken) return current;
      throw new InputError('This subscription changed. Please use your latest link or subscribe again.', 409);
    }
    throw error;
  }
}
export async function unsubscribe(sub: Subscriber) {
  await db.send(new UpdateCommand({ TableName: table(), Key: { pk: sub.pk }, UpdateExpression: 'SET #status = :status, confirmExpires = :zero REMOVE activeZone', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':status': 'unsubscribed', ':zero': 0 } }));
}
export async function activePage(zone: string, cursor?: Record<string, unknown>) {
  return db.send(new QueryCommand({ TableName: table(), IndexName: 'active-zone', KeyConditionExpression: 'activeZone = :zone', ExpressionAttributeValues: { ':zone': zone }, Limit: 100, ExclusiveStartKey: cursor }));
}
