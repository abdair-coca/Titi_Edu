-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "gotasSaldo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gotasTotal" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MovimientoGota" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoGota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovimientoGota_usuarioId_createdAt_idx" ON "MovimientoGota"("usuarioId", "createdAt");

-- AddForeignKey
ALTER TABLE "MovimientoGota" ADD CONSTRAINT "MovimientoGota_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
