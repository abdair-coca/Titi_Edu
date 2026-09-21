import { randomUUID } from 'node:crypto';
import prisma from '../prisma.js';

export class RagIndexLeaseLostError extends Error {
  constructor() {
    super('RAG index lease lost');
    this.name = 'RagIndexLeaseLostError';
  }
}

// Call inside the same PostgreSQL transaction that mutates documents. The row
// lock is the fence: reclamation cannot change ownership while document rows
// are being swapped, and an obsolete worker is rejected before its first write.
export async function assertRagIndexLease(db, lease) {
  if (!lease) return;
  const rows = await db.$queryRaw`
    SELECT "id" FROM "RagIndexJob"
    WHERE "id" = ${lease.jobId}
      AND "status" = 'RUNNING'::"RagIndexJobStatus"
      AND "lockToken" = ${lease.lockToken}
    FOR UPDATE
  `;
  if (!rows.length) throw new RagIndexLeaseLostError();
}

export async function enqueueLessonIndex(leccionId, { db = prisma } = {}) {
  const rows = await db.$queryRaw`
    INSERT INTO "RagIndexJob" ("id", "leccionId", "requestedAt", "nextAttemptAt")
    VALUES (${randomUUID()}, ${leccionId}, clock_timestamp(), clock_timestamp())
    ON CONFLICT ("leccionId") DO UPDATE SET
      "requestedAt" = GREATEST(
        clock_timestamp(),
        COALESCE("RagIndexJob"."startedAt", clock_timestamp()) + interval '1 millisecond'
      ),
      "status" = CASE WHEN "RagIndexJob"."status" = 'RUNNING' THEN 'RUNNING'::"RagIndexJobStatus" ELSE 'PENDING'::"RagIndexJobStatus" END,
       "attempts" = CASE WHEN "RagIndexJob"."status" = 'RUNNING' THEN "RagIndexJob"."attempts" ELSE 0 END,
      "nextAttemptAt" = clock_timestamp(), "completedAt" = NULL, "lastError" = NULL,
      "lockToken" = CASE WHEN "RagIndexJob"."status" = 'RUNNING' THEN "RagIndexJob"."lockToken" ELSE NULL END
    RETURNING "id", "leccionId", "status", "requestedAt", "nextAttemptAt", "attempts", "lockToken"
  `;
  return rows[0];
}

export async function enqueueCourseIndex(courseId, { db = prisma } = {}) {
  const lessons = await db.leccion.findMany({ where: {
    estado: 'PUBLICADA', modulo: { cursoId: courseId, estado: 'PUBLICADO', curso: { publicado: true } },
  }, select: { id: true } });
  const results = [];
  for (const lesson of lessons) results.push(await enqueueLessonIndex(lesson.id, { db }));
  return { courseId, total: results.length, status: 'QUEUED', results };
}

export async function processNextIndexJob(indexLesson, { db = prisma } = {}) {
  // Expired leases are retryable. A fencing timestamp prevents stale workers
  // from finalizing a job reclaimed by another instance.
  await db.$executeRaw`
    UPDATE "RagIndexJob" SET "status" = CASE WHEN "requestedAt" > "startedAt" THEN 'PENDING'::"RagIndexJobStatus" WHEN "attempts" >= 4 THEN 'FAILED'::"RagIndexJobStatus" ELSE 'PENDING'::"RagIndexJobStatus" END,
      "attempts" = CASE WHEN "requestedAt" > "startedAt" THEN 0 ELSE "attempts" END,
      "lockedAt" = NULL, "lockToken" = NULL, "nextAttemptAt" = clock_timestamp(), "lastError" = 'El trabajo perdió su conexión; se recuperó la cola'
    WHERE "status" = 'RUNNING' AND "lockedAt" < clock_timestamp() - interval '10 minutes'
  `;
  const lockToken = randomUUID();
  const rows = await db.$queryRaw`
    WITH candidate AS (
      SELECT "id" FROM "RagIndexJob"
      WHERE "status" = 'PENDING' AND "nextAttemptAt" <= clock_timestamp()
      ORDER BY "nextAttemptAt", "requestedAt" LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    UPDATE "RagIndexJob" j SET "status" = 'RUNNING',
      "startedAt" = GREATEST(clock_timestamp(), j."requestedAt"), "lockedAt" = clock_timestamp(),
      "lockToken" = ${lockToken}, "attempts" = j."attempts" + 1
    FROM candidate WHERE j."id" = candidate."id" RETURNING j.*
  `;
  const job = rows[0];
  if (!job) return false;
  const lease = { jobId: job.id, lockToken: job.lockToken || lockToken };
  const fence = { id: job.id, status: 'RUNNING', lockToken: lease.lockToken };
  let leaseLost = false;
  const heartbeat = setInterval(() => {
    db.ragIndexJob.updateMany({ where: fence, data: { lockedAt: new Date() } })
      .then(({ count }) => { if (count === 0) leaseLost = true; })
      .catch(() => {});
  }, 60_000);
  heartbeat.unref();
  let failed = false;
  try {
    await indexLesson(job.leccionId, { force: true, lease });
  } catch (error) {
    if (error instanceof RagIndexLeaseLostError) leaseLost = true;
    else failed = true;
  } finally {
    clearInterval(heartbeat);
  }
  if (leaseLost) return true;
  const delay = [60_000, 300_000, 1_800_000][job.attempts - 1];
  const status = failed ? delay ? 'PENDING' : 'FAILED' : 'COMPLETED';
  const next = new Date(Date.now() + (delay || 0));
  const message = failed ? 'No se pudo indexar la lección; revisa la configuración y vuelve a intentar' : null;
  await db.$executeRaw`
    UPDATE "RagIndexJob" SET
      "status" = CASE WHEN "requestedAt" > "startedAt" THEN 'PENDING'::"RagIndexJobStatus" ELSE ${status}::"RagIndexJobStatus" END,
      "attempts" = CASE WHEN "requestedAt" > "startedAt" THEN 0 ELSE "attempts" END,
      "nextAttemptAt" = CASE WHEN "requestedAt" > "startedAt" THEN clock_timestamp() ELSE ${next} END,
      "completedAt" = CASE WHEN "requestedAt" <= "startedAt" AND ${status} = 'COMPLETED' THEN clock_timestamp() ELSE NULL END,
      "lastError" = ${message}, "lockedAt" = NULL, "lockToken" = NULL
    WHERE "id" = ${job.id} AND "status" = 'RUNNING' AND "lockToken" = ${lease.lockToken}
  `;
  return true;
}

export function startIndexWorker(indexLesson) {
  let stopped = false;
  let timer;
  let active = Promise.resolve();
  const tick = () => {
    active = (async () => {
      let worked = false;
      try { worked = await processNextIndexJob(indexLesson); }
      catch { console.error('La cola RAG no está disponible'); }
      if (!stopped) {
        timer = setTimeout(tick, worked ? 50 : 5000);
        timer.unref();
      }
    })();
  };
  if (process.env.RAG_ENABLED === 'true') tick();
  return async () => { stopped = true; clearTimeout(timer); await active; };
}
