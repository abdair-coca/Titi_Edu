-- Embeddings anteriores (1536D) no son compatibles con BGE-M3 (1024D).
-- Se conservan documentos/versiones, pero se obliga a reindexar su contenido.
DELETE FROM "FragmentoRag";

UPDATE "DocumentoRag"
SET "estado" = 'PENDIENTE',
    "indexadoAt" = NULL,
    "error" = 'Reindexación requerida para BGE-M3 (1024 dimensiones)';

ALTER TABLE "FragmentoRag"
  ALTER COLUMN "embedding" TYPE vector(1024);
