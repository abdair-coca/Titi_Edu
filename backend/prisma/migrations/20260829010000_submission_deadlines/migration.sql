-- Optional UTC submission deadlines for evaluable HTML lessons and exams.
BEGIN;

ALTER TABLE "RecursoHtmlLeccion" ADD COLUMN "fechaLimite" TIMESTAMP(3);
ALTER TABLE "Evaluacion" ADD COLUMN "fechaLimite" TIMESTAMP(3);

COMMIT;
