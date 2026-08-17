-- Lifecycle de lecciones vivas y revisiones recuperables.
CREATE TYPE "EstadoLeccion" AS ENUM ('BORRADOR', 'PUBLICADA', 'ARCHIVADA');

ALTER TABLE "Leccion"
  ADD COLUMN "estado" "EstadoLeccion" NOT NULL DEFAULT 'BORRADOR',
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Contenido ya visible conserva su lugar en la base de progreso de inscripciones existentes.
UPDATE "Leccion" AS lesson
SET
  "estado" = CASE WHEN module."estado" = 'PUBLICADO' THEN 'PUBLICADA'::"EstadoLeccion" ELSE 'BORRADOR'::"EstadoLeccion" END,
  "publishedAt" = CASE WHEN module."estado" = 'PUBLICADO' THEN TIMESTAMP '1970-01-01 00:00:00' ELSE NULL END
FROM "Modulo" AS module
WHERE lesson."moduloId" = module."id";

CREATE TABLE "RevisionLeccion" (
  "id" TEXT NOT NULL,
  "leccionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "autorId" TEXT NOT NULL,
  CONSTRAINT "RevisionLeccion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RevisionLeccion_leccionId_version_key" ON "RevisionLeccion"("leccionId", "version");
CREATE INDEX "RevisionLeccion_leccionId_createdAt_idx" ON "RevisionLeccion"("leccionId", "createdAt");
CREATE INDEX "Leccion_moduloId_estado_orden_idx" ON "Leccion"("moduloId", "estado", "orden");

ALTER TABLE "RevisionLeccion"
  ADD CONSTRAINT "RevisionLeccion_leccionId_fkey"
  FOREIGN KEY ("leccionId") REFERENCES "Leccion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "RevisionLeccion_autorId_fkey"
  FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;