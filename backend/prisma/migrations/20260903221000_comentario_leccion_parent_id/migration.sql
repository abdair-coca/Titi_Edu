-- AlterTable
ALTER TABLE "ComentarioLeccion" ADD COLUMN "parentId" TEXT;

-- AddForeignKey
ALTER TABLE "ComentarioLeccion" ADD CONSTRAINT "ComentarioLeccion_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ComentarioLeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
