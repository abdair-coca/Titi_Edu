-- Additive optimistic concurrency and completion uniqueness.
BEGIN;

ALTER TABLE "Curso"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Modulo"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- Legacy preflight and repair: retain every certificate row. For each duplicated
-- (usuarioId, cursoId), the oldest issuance (then lowest UUID) remains canonical.
-- Historical duplicates keep their immutable cursoTitulo/codigoVerif snapshots and
-- become detached from the live course so PostgreSQL can enforce future uniqueness.
WITH "rankedCertificates" AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "usuarioId", "cursoId"
      ORDER BY "fechaEmision" ASC, "id" ASC
    ) AS "canonicalRank"
  FROM "Certificado"
  WHERE "cursoId" IS NOT NULL
),
"historicalDuplicates" AS (
  SELECT "id"
  FROM "rankedCertificates"
  WHERE "canonicalRank" > 1
)
UPDATE "Certificado" AS "certificate"
SET "cursoId" = NULL
FROM "historicalDuplicates"
WHERE "certificate"."id" = "historicalDuplicates"."id";

CREATE UNIQUE INDEX "Certificado_usuarioId_cursoId_key"
  ON "Certificado"("usuarioId", "cursoId");

COMMIT;
