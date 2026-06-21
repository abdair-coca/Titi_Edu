-- CreateTable
CREATE TABLE "Mision" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "meta" INTEGER NOT NULL,
    "recompensa" INTEGER NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Mision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MisionUsuario" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "misionId" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "progreso" INTEGER NOT NULL DEFAULT 0,
    "completada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MisionUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mision_codigo_key" ON "Mision"("codigo");

-- CreateIndex
CREATE INDEX "MisionUsuario_usuarioId_fecha_idx" ON "MisionUsuario"("usuarioId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "MisionUsuario_usuarioId_misionId_fecha_key" ON "MisionUsuario"("usuarioId", "misionId", "fecha");

-- AddForeignKey
ALTER TABLE "MisionUsuario" ADD CONSTRAINT "MisionUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MisionUsuario" ADD CONSTRAINT "MisionUsuario_misionId_fkey" FOREIGN KEY ("misionId") REFERENCES "Mision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
