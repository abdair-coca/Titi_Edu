-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "gotasMultiplicadorHasta" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ItemTienda" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "precio" INTEGER NOT NULL,
    "efecto" TEXT NOT NULL,
    "icono" TEXT,
    "limiteStack" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ItemTienda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompraItem" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "precio" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompraItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventarioItem" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InventarioItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemTienda_codigo_key" ON "ItemTienda"("codigo");

-- CreateIndex
CREATE INDEX "CompraItem_usuarioId_createdAt_idx" ON "CompraItem"("usuarioId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventarioItem_usuarioId_itemId_key" ON "InventarioItem"("usuarioId", "itemId");

-- AddForeignKey
ALTER TABLE "CompraItem" ADD CONSTRAINT "CompraItem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraItem" ADD CONSTRAINT "CompraItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemTienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventarioItem" ADD CONSTRAINT "InventarioItem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventarioItem" ADD CONSTRAINT "InventarioItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemTienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
