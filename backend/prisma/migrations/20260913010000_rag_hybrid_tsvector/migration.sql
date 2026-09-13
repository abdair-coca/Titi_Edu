-- Búsqueda híbrida RAG: full-text tsvector sobre el contenido de cada fragmento.
-- Columna generada (almacenada) para no duplicar lógica de tokenización en INSERTs.

ALTER TABLE "FragmentoRag"
  ADD COLUMN "tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('spanish', "contenido")) STORED;

CREATE INDEX "FragmentoRag_tsv_gin_idx"
  ON "FragmentoRag" USING GIN ("tsv");