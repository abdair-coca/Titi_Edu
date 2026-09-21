import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/prisma.js', () => ({ default: {} }));
import { assertRagIndexLease, enqueueLessonIndex, enqueueCourseIndex, processNextIndexJob, startIndexWorker } from '../../src/services/rag.queue.js';
const job = { id: 'job', leccionId: 'lesson', attempts: 1, startedAt: new Date('2026-09-20T12:00:00Z'), lockToken: 'lease-token' };
function database(claim = job) {
  return { $queryRaw: vi.fn().mockResolvedValue(claim ? [claim] : []), $executeRaw: vi.fn().mockResolvedValue(1),
    ragIndexJob: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    leccion: { findMany: vi.fn().mockResolvedValue([{ id: 'lesson' }]) } };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
describe('durable indexing queue', () => {
  it('coalesces enqueues in Postgres while retaining active worker', async () => {
    const db = database();
    await enqueueLessonIndex('lesson', { db });
    const sql = db.$queryRaw.mock.calls[0][0].join('?');
    expect(sql).toContain('ON CONFLICT ("leccionId") DO UPDATE');
    expect(sql).toContain('COALESCE("RagIndexJob"."startedAt", clock_timestamp())');
    expect(sql).toContain('interval \'1 millisecond\'');
    expect(sql).toContain('THEN \'RUNNING\'::"RagIndexJobStatus"');
  });
  it('queues every published lesson without running indexing in request', async () => {
    const db = database();
    expect(await enqueueCourseIndex('course', { db })).toMatchObject({ courseId: 'course', total: 1, status: 'QUEUED' });
    expect(db.leccion.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { estado: 'PUBLICADA', modulo: { cursoId: 'course', estado: 'PUBLICADO', curso: { publicado: true } } } }));
  });
  it('recovers expired locks, claims once with SKIP LOCKED and fences completion', async () => {
    const db = database(); const index = vi.fn().mockResolvedValue({ status: 'INDEXED' });
    expect(await processNextIndexJob(index, { db })).toBe(true);
    expect(index).toHaveBeenCalledWith('lesson', { force: true, lease: { jobId: 'job', lockToken: 'lease-token' } });
    expect(db.$executeRaw.mock.calls[0][0].join('?')).toContain("interval '10 minutes'");
    expect(db.$queryRaw.mock.calls[0][0].join('?')).toContain('FOR UPDATE SKIP LOCKED');
    const completion = db.$executeRaw.mock.calls[1];
    expect(completion[0].join('?')).toContain('"requestedAt" > "startedAt"');
    expect(completion[0].join('?')).toContain('AND "lockToken" =');
    expect(completion).toContain('COMPLETED');
    expect(JSON.stringify(completion)).toContain('lease-token');
  });
  it.each([[1, 60_000, 'PENDING'], [2, 300_000, 'PENDING'], [3, 1_800_000, 'PENDING'], [4, 0, 'FAILED']])('attempt %s schedules delay %s then %s', async (attempts, delay, status) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-20T12:00:00Z'));
    const db = database({ ...job, attempts });
    await processNextIndexJob(vi.fn().mockRejectedValue(new Error('provider secret payload')), { db });
    const values = db.$executeRaw.mock.calls[1].slice(1);
    expect(values[0]).toBe(status);
    expect(values[1]).toEqual(new Date(Date.now() + delay));
    expect(JSON.stringify(values)).not.toContain('provider secret');
  });
  it('does nothing when no eligible job exists', async () => {
    const db = database(null); const index = vi.fn();
    expect(await processNextIndexJob(index, { db })).toBe(false);
    expect(index).not.toHaveBeenCalled();
  });
  it('rejects document writes after lease ownership changes', async () => {
    const db = { $queryRaw: vi.fn().mockResolvedValue([]) };
    await expect(assertRagIndexLease(db, { jobId: 'job', lockToken: 'old-token' }))
      .rejects.toMatchObject({ name: 'RagIndexLeaseLostError' });
  });
  it('does not start workers when indexing disabled', async () => {
    vi.stubEnv('RAG_ENABLED', 'false'); const index = vi.fn();
    await startIndexWorker(index)();
    expect(index).not.toHaveBeenCalled();
  });
});
