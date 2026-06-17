-- CreateTable
CREATE TABLE "NotaLeccion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "leccionId" TEXT NOT NULL,
    "texto" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotaLeccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotaLeccion_usuarioId_leccionId_key" ON "NotaLeccion"("usuarioId", "leccionId");

-- AddForeignKey
ALTER TABLE "NotaLeccion" ADD CONSTRAINT "NotaLeccion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaLeccion" ADD CONSTRAINT "NotaLeccion_leccionId_fkey" FOREIGN KEY ("leccionId") REFERENCES "Leccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
