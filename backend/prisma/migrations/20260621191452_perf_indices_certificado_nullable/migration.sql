-- DropForeignKey
ALTER TABLE "Certificado" DROP CONSTRAINT "Certificado_cursoId_fkey";

-- AlterTable
ALTER TABLE "Certificado" ADD COLUMN     "cursoTitulo" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "cursoId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Curso_publicado_categoriaId_idx" ON "Curso"("publicado", "categoriaId");

-- CreateIndex
CREATE INDEX "Inscripcion_usuarioId_idx" ON "Inscripcion"("usuarioId");

-- CreateIndex
CREATE INDEX "Material_leccionId_idx" ON "Material"("leccionId");

-- CreateIndex
CREATE INDEX "Progreso_usuarioId_idx" ON "Progreso"("usuarioId");

-- AddForeignKey
ALTER TABLE "Certificado" ADD CONSTRAINT "Certificado_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE SET NULL ON UPDATE CASCADE;
