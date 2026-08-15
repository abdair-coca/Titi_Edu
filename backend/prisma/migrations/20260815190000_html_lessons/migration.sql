-- HTML lesson resources are self-contained and served only through iframe srcDoc.
BEGIN;

ALTER TYPE "FormatoContenido" ADD VALUE IF NOT EXISTS 'HTML';

CREATE TABLE "RecursoHtmlLeccion" (
  "id" TEXT NOT NULL,
  "leccionId" TEXT NOT NULL,
  "html" TEXT NOT NULL,
  "evaluable" BOOLEAN NOT NULL DEFAULT false,
  "intentosMax" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecursoHtmlLeccion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecursoHtmlLeccion_leccionId_fkey"
    FOREIGN KEY ("leccionId") REFERENCES "Leccion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecursoHtmlLeccion_intentosMax_evaluable_check"
    CHECK (("evaluable" = false AND "intentosMax" IS NULL) OR ("evaluable" = true AND "intentosMax" >= 1))
);

CREATE TABLE "IntentoHtmlLeccion" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "numero" INTEGER NOT NULL,
  "puntaje" DOUBLE PRECISION,
  "resultadoAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usuarioId" TEXT NOT NULL,
  "recursoHtmlId" TEXT NOT NULL,
  CONSTRAINT "IntentoHtmlLeccion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IntentoHtmlLeccion_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "IntentoHtmlLeccion_recursoHtmlId_fkey"
    FOREIGN KEY ("recursoHtmlId") REFERENCES "RecursoHtmlLeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ResultadoHtmlLeccion" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "recursoHtmlId" TEXT NOT NULL,
  "mejorPuntaje" DOUBLE PRECISION NOT NULL,
  "intentoId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResultadoHtmlLeccion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ResultadoHtmlLeccion_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ResultadoHtmlLeccion_recursoHtmlId_fkey"
    FOREIGN KEY ("recursoHtmlId") REFERENCES "RecursoHtmlLeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ResultadoHtmlLeccion_intentoId_fkey"
    FOREIGN KEY ("intentoId") REFERENCES "IntentoHtmlLeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RecursoHtmlLeccion_leccionId_key" ON "RecursoHtmlLeccion"("leccionId");
CREATE UNIQUE INDEX "IntentoHtmlLeccion_token_key" ON "IntentoHtmlLeccion"("token");
CREATE UNIQUE INDEX "IntentoHtmlLeccion_usuarioId_recursoHtmlId_numero_key"
  ON "IntentoHtmlLeccion"("usuarioId", "recursoHtmlId", "numero");
CREATE INDEX "IntentoHtmlLeccion_usuarioId_recursoHtmlId_idx"
  ON "IntentoHtmlLeccion"("usuarioId", "recursoHtmlId");
CREATE UNIQUE INDEX "ResultadoHtmlLeccion_usuarioId_recursoHtmlId_key"
  ON "ResultadoHtmlLeccion"("usuarioId", "recursoHtmlId");
CREATE UNIQUE INDEX "ResultadoHtmlLeccion_intentoId_key" ON "ResultadoHtmlLeccion"("intentoId");
CREATE INDEX "ResultadoHtmlLeccion_recursoHtmlId_idx" ON "ResultadoHtmlLeccion"("recursoHtmlId");

COMMIT;
