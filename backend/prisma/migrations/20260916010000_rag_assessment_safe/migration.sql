-- Marca documentos indexados con extractor seguro para HTML evaluable.
-- Documentos históricos de evaluaciones se desactivan hasta reindexarse.

ALTER TABLE "DocumentoRag"
  ADD COLUMN "assessmentSafe" BOOLEAN NOT NULL DEFAULT false;

UPDATE "DocumentoRag" d
SET "activo" = false,
    "estado" = 'FALLIDO',
    "error" = COALESCE(d."error", 'Reindexacion requerida para contenido evaluable seguro')
FROM "RecursoHtmlLeccion" r
WHERE d."leccionId" = r."leccionId"
  AND r."evaluable" = true
  AND d."activo" = true;
