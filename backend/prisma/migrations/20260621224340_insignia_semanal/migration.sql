-- CreateTable
CREATE TABLE "InsigniaSemanal" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "semana" TEXT NOT NULL,
    "puesto" INTEGER NOT NULL,
    "gotasSemana" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsigniaSemanal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InsigniaSemanal_usuarioId_semana_key" ON "InsigniaSemanal"("usuarioId", "semana");

-- AddForeignKey
ALTER TABLE "InsigniaSemanal" ADD CONSTRAINT "InsigniaSemanal_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
