-- Contexto pedagógico privado de autoría y metadata de procedencia RAG.
-- No crea archivos públicos ni modifica corpus histórico.

ALTER TABLE "Leccion"
  ADD COLUMN "contextoRag" TEXT,
  ADD COLUMN "contextoRagNombre" TEXT;

CREATE TYPE "OrigenDocumentoRag" AS ENUM ('AUTOR', 'HTML_FALLBACK');

ALTER TABLE "DocumentoRag"
  ADD COLUMN "origen" "OrigenDocumentoRag" NOT NULL DEFAULT 'HTML_FALLBACK';

ALTER TABLE "FragmentoRag"
  ADD COLUMN "seccion" TEXT;
