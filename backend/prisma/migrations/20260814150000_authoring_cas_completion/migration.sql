-- Additive optimistic concurrency and completion uniqueness.
ALTER TABLE "Curso"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Modulo"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Certificado_usuarioId_cursoId_key"
  ON "Certificado"("usuarioId", "cursoId");
