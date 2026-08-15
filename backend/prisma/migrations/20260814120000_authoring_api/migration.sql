-- Additive authoring API schema. Existing learner data remains compatible.
CREATE TYPE "EstadoModulo" AS ENUM ('BORRADOR', 'PUBLICADO');
CREATE TYPE "FormatoContenido" AS ENUM ('TEXTO', 'MARKDOWN');
CREATE TYPE "EstadoOperacionAutoria" AS ENUM ('PENDIENTE', 'COMPLETADA', 'FALLIDA');

ALTER TABLE "Modulo"
  ADD COLUMN "estado" "EstadoModulo" NOT NULL DEFAULT 'BORRADOR';
UPDATE "Modulo" SET "estado" = 'PUBLICADO';

ALTER TABLE "Leccion"
  ADD COLUMN "formatoContenido" "FormatoContenido" NOT NULL DEFAULT 'TEXTO';

ALTER TABLE "Curso"
  ADD COLUMN "emiteCertificado" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Material"
  ADD COLUMN "sha256" TEXT;

CREATE TABLE "TokenServicio" (
  "id" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "prefijo" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "scopes" TEXT[],
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usuarioId" TEXT NOT NULL,
  CONSTRAINT "TokenServicio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperacionAutoria" (
  "id" TEXT NOT NULL,
  "actorKey" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "accion" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "estado" "EstadoOperacionAutoria" NOT NULL DEFAULT 'PENDIENTE',
  "httpStatus" INTEGER,
  "response" JSONB,
  "contexto" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "usuarioId" TEXT,
  "cursoId" TEXT,
  "tokenServicioId" TEXT,
  CONSTRAINT "OperacionAutoria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TokenServicio_prefijo_key" ON "TokenServicio"("prefijo");
CREATE UNIQUE INDEX "TokenServicio_tokenHash_key" ON "TokenServicio"("tokenHash");
CREATE INDEX "TokenServicio_usuarioId_revokedAt_idx" ON "TokenServicio"("usuarioId", "revokedAt");
CREATE UNIQUE INDEX "OperacionAutoria_actorKey_idempotencyKey_key" ON "OperacionAutoria"("actorKey", "idempotencyKey");
CREATE INDEX "OperacionAutoria_cursoId_createdAt_idx" ON "OperacionAutoria"("cursoId", "createdAt");
CREATE INDEX "OperacionAutoria_tokenServicioId_createdAt_idx" ON "OperacionAutoria"("tokenServicioId", "createdAt");

ALTER TABLE "TokenServicio" ADD CONSTRAINT "TokenServicio_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperacionAutoria" ADD CONSTRAINT "OperacionAutoria_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperacionAutoria" ADD CONSTRAINT "OperacionAutoria_cursoId_fkey"
  FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperacionAutoria" ADD CONSTRAINT "OperacionAutoria_tokenServicioId_fkey"
  FOREIGN KEY ("tokenServicioId") REFERENCES "TokenServicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
