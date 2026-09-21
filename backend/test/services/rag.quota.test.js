import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/prisma.js', () => ({ default: {} }));
import { consumeRagQuota } from '../../src/services/rag.quota.js';

// Adapter emulates Postgres' serialized conflicting upsert and transactional
// rollback; SQL checks below protect the database concurrency primitives.
function database() {
  let windows = new Map();
  let tail = Promise.resolve();
  const statements = [];
  const db = {
    ragQuotaWindow: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    $transaction(callback) {
      const result = tail.then(async () => {
        const working = new Map(windows);
        const tx = { $queryRaw: async (sql, ...values) => {
          statements.push(sql.join('?'));
          const [, user, scope, bucket, , limit] = values;
          const key = `${user}:${scope}:${bucket.toISOString()}`;
          const count = working.get(key) || 0;
          if (count >= limit) return [];
          working.set(key, count + 1);
          return [{ count: count + 1 }];
        } };
        const returned = await callback(tx);
        windows = working;
        return returned;
      });
      tail = result.catch(() => {});
      return result;
    },
  };
  return { db, statements };
}
describe('durable RAG quota', () => {
  it('admits exactly five concurrent minute requests per user', async () => {
    const { db, statements } = database();
    const requests = await Promise.allSettled(Array.from({ length: 20 }, () => consumeRagQuota('user', ['CHAT_MINUTE', 'CHAT_DAY'], { db, now: 1_800_000 })));
    expect(requests.filter((result) => result.status === 'fulfilled')).toHaveLength(5);
    expect(requests.filter((result) => result.status === 'rejected').every((result) => result.reason.status === 429)).toBe(true);
    expect(statements[0]).toContain('ON CONFLICT ("usuarioId", "scope", "bucketStart") DO UPDATE');
    expect(statements[0]).toContain('WHERE "RagQuotaWindow"."count" <');
  });
  it('uses UTC day boundaries and grants thirty/day independently of minute resets', async () => {
    const { db } = database();
    for (let index = 0; index < 30; index += 1) await consumeRagQuota('user', ['CHAT_MINUTE', 'CHAT_DAY'], { db, now: index * 60_000 });
    await expect(consumeRagQuota('user', ['CHAT_MINUTE', 'CHAT_DAY'], { db, now: 31 * 60_000 })).rejects.toMatchObject({ status: 429 });
    await expect(consumeRagQuota('user', ['CHAT_MINUTE', 'CHAT_DAY'], { db, now: 86_400_000 })).resolves.toBeUndefined();
    await expect(consumeRagQuota('other', ['CHAT_MINUTE', 'CHAT_DAY'], { db, now: 31 * 60_000 })).resolves.toBeUndefined();
  });
  it('validation limit resets at ten-minute boundary', async () => {
    const { db } = database();
    for (let index = 0; index < 5; index += 1) await consumeRagQuota('user', ['CREDENTIAL_VALIDATE'], { db, now: 599_999 });
    await expect(consumeRagQuota('user', ['CREDENTIAL_VALIDATE'], { db, now: 599_999 })).rejects.toMatchObject({ status: 429 });
    await expect(consumeRagQuota('user', ['CREDENTIAL_VALIDATE'], { db, now: 600_000 })).resolves.toBeUndefined();
  });
  it('fails closed on database error', async () => {
    const { db } = database();
    db.$transaction = vi.fn().mockRejectedValue(new Error('unavailable'));
    await expect(consumeRagQuota('user', ['CHAT_MINUTE'], { db })).rejects.toThrow('unavailable');
  });
});
