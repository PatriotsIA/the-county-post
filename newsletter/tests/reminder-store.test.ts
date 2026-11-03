import { beforeEach, expect, it, vi } from 'vitest';
const send = vi.hoisted(() => vi.fn());
vi.mock('@aws-sdk/lib-dynamodb', async importOriginal => ({
  ...await importOriginal<typeof import('@aws-sdk/lib-dynamodb')>(),
  DynamoDBDocumentClient: { from: () => ({ send }) },
}));
import { confirmationReminderPage } from '../src/store';

beforeEach(() => { send.mockReset(); process.env.TABLE_NAME = 'subscribers'; });
it('queries the indexed 24–48 hour pending window and passes through pagination', async () => {
  const cursor = { pk: 'SUB#last', status: 'pending', createdAt: '2026-11-01T20:00:00.000Z' };
  send.mockResolvedValue({ Items: [{ pk: 'SUB#due' }], LastEvaluatedKey: cursor });
  const result = await confirmationReminderPage(cursor, new Date('2026-11-03T20:00:00Z'));
  expect(send.mock.calls[0][0].input).toEqual({
    TableName: 'subscribers', IndexName: 'subscription-status',
    KeyConditionExpression: '#status = :pending AND createdAt BETWEEN :oldest AND :due',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':pending': 'pending', ':oldest': '2026-11-01T20:00:00.000Z', ':due': '2026-11-02T20:00:00.000Z' },
    Limit: 100, ExclusiveStartKey: cursor,
  });
  expect(result.LastEvaluatedKey).toEqual(cursor);
});
