-- La migración previa dejó embeddings BGE-M3 de 1024D; EmbeddingGemma usa 768D.
-- Se conservan documentos/versiones, pero se obliga a reindexar su contenido.
DELETE FROM "FragmentoRag";

UPDATE "DocumentoRag"
SET "estado" = 'PENDIENTE',
    "indexadoAt" = NULL,
    "error" = 'Reindexación requerida para EmbeddingGemma (768 dimensiones)';

ALTER TABLE "FragmentoRag"
  ALTER COLUMN "embedding" TYPE vector(768);
