import { randomUUID } from 'node:crypto';
import prisma from '../prisma.js';
import { RagError } from './rag.errors.js';

const RULES = Object.freeze({
  CHAT_MINUTE: { limit: 5, duration: 60_000 },
  CHAT_DAY: { limit: 30, duration: 86_400_000 },
  CREDENTIAL_VALIDATE: { limit: 5, duration: 600_000 },
});
let nextCleanup = 0;

// PostgreSQL serializes conflicting upserts. The conditional increment never
// exceeds the limit, including requests from different backend instances.
export async function consumeRagQuota(usuarioId, scopes, { db = prisma, now = Date.now() } = {}) {
  if (!usuarioId || usuarioId === 'anonymous') throw new RagError(401, 'Usuario no encontrado');
  await db.$transaction(async (tx) => {
    for (const scope of scopes) {
      const rule = RULES[scope];
      if (!rule) throw new Error('Unknown quota scope');
      const bucket = new Date(Math.floor(now / rule.duration) * rule.duration);
      const rows = await tx.$queryRaw`
        INSERT INTO "RagQuotaWindow" ("id", "usuarioId", "scope", "bucketStart", "count", "updatedAt")
        VALUES (${randomUUID()}, ${usuarioId}, ${scope}::"RagQuotaScope", ${bucket}, 1, ${new Date(now)})
        ON CONFLICT ("usuarioId", "scope", "bucketStart") DO UPDATE
        SET "count" = "RagQuotaWindow"."count" + 1, "updatedAt" = EXCLUDED."updatedAt"
        WHERE "RagQuotaWindow"."count" < ${rule.limit}
        RETURNING "count"
      `;
      if (!rows.length) throw new RagError(429, 'Alcanzaste el límite temporal del tutor IA');
    }
  });
  if (now >= nextCleanup) {
    nextCleanup = now + 3_600_000;
    // Cleanup is independent of the granted quota; failure must not grant extras.
    await db.ragQuotaWindow.deleteMany({ where: { bucketStart: { lt: new Date(now - 172_800_000) } } }).catch(() => {});
  }
}
