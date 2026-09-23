-- Stable lesson-comment pagination reads comments by lesson and creation time.
CREATE INDEX "ComentarioLeccion_leccionId_createdAt_idx"
ON "ComentarioLeccion"("leccionId", "createdAt");
