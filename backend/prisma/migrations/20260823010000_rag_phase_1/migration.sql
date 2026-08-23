CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "EstadoDocumentoRag" AS ENUM ('PENDIENTE', 'LISTO', 'FALLIDO');

CREATE TABLE "DocumentoRag" (
  "id" TEXT NOT NULL,
  "leccionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "estado" "EstadoDocumentoRag" NOT NULL DEFAULT 'PENDIENTE',
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "hashContenido" TEXT NOT NULL,
  "modelo" TEXT NOT NULL,
  "error" TEXT,
  "indexadoAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentoRag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FragmentoRag" (
  "id" TEXT NOT NULL,
  "documentoId" TEXT NOT NULL,
  "orden" INTEGER NOT NULL,
  "contenido" TEXT NOT NULL,
  "embedding" vector(1536) NOT NULL,
  CONSTRAINT "FragmentoRag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentoRag_leccionId_version_key" ON "DocumentoRag"("leccionId", "version");
CREATE INDEX "DocumentoRag_leccionId_activo_estado_idx" ON "DocumentoRag"("leccionId", "activo", "estado");
CREATE UNIQUE INDEX "FragmentoRag_documentoId_orden_key" ON "FragmentoRag"("documentoId", "orden");
CREATE INDEX "FragmentoRag_documentoId_idx" ON "FragmentoRag"("documentoId");

ALTER TABLE "DocumentoRag"
  ADD CONSTRAINT "DocumentoRag_leccionId_fkey"
  FOREIGN KEY ("leccionId") REFERENCES "Leccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FragmentoRag"
  ADD CONSTRAINT "FragmentoRag_documentoId_fkey"
  FOREIGN KEY ("documentoId") REFERENCES "DocumentoRag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
