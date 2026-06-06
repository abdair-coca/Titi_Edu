-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ESTUDIANTE', 'PROFESOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "TipoPregunta" AS ENUM ('OPCION_MULTIPLE', 'VERDADERO_FALSO', 'RESPUESTA_CORTA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "neoId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'ESTUDIANTE',
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "racha" INTEGER NOT NULL DEFAULT 0,
    "ultimaActividad" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "icono" TEXT NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curso" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "portadaUrl" TEXT,
    "nivel" TEXT NOT NULL,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoriaId" TEXT NOT NULL,
    "creadorId" TEXT NOT NULL,

    CONSTRAINT "Curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursoProfesor" (
    "cursoId" TEXT NOT NULL,
    "profesorId" TEXT NOT NULL,

    CONSTRAINT "CursoProfesor_pkey" PRIMARY KEY ("cursoId","profesorId")
);

-- CreateTable
CREATE TABLE "Modulo" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL,
    "cursoId" TEXT NOT NULL,

    CONSTRAINT "Modulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leccion" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "videoUrl" TEXT,
    "orden" INTEGER NOT NULL,
    "moduloId" TEXT NOT NULL,

    CONSTRAINT "Leccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "leccionId" TEXT NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluacion" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "moduloId" TEXT,
    "cursoId" TEXT,
    "esFinal" BOOLEAN NOT NULL DEFAULT false,
    "intentosMax" INTEGER NOT NULL DEFAULT 3,
    "notaMinima" DOUBLE PRECISION NOT NULL DEFAULT 70,

    CONSTRAINT "Evaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pregunta" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "tipo" "TipoPregunta" NOT NULL,
    "orden" INTEGER NOT NULL,
    "evaluacionId" TEXT NOT NULL,

    CONSTRAINT "Pregunta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opcion" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "esCorrecta" BOOLEAN NOT NULL DEFAULT false,
    "preguntaId" TEXT NOT NULL,

    CONSTRAINT "Opcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inscripcion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "fechaInscripcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completado" BOOLEAN NOT NULL DEFAULT false,
    "fechaCompletado" TIMESTAMP(3),

    CONSTRAINT "Inscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Progreso" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "leccionId" TEXT NOT NULL,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "fechaCompletado" TIMESTAMP(3),

    CONSTRAINT "Progreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "evaluacionId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nota" DOUBLE PRECISION NOT NULL,
    "aprobado" BOOLEAN NOT NULL,
    "fechaIntento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Intento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComentarioLeccion" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "leccionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComentarioLeccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Logro" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "icono" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "condicion" TEXT NOT NULL,

    CONSTRAINT "Logro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogroUsuario" (
    "usuarioId" TEXT NOT NULL,
    "logroId" TEXT NOT NULL,
    "fechaObtenido" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogroUsuario_pkey" PRIMARY KEY ("usuarioId","logroId")
);

-- CreateTable
CREATE TABLE "Certificado" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "codigoVerif" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_neoId_key" ON "Usuario"("neoId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluacion_moduloId_key" ON "Evaluacion"("moduloId");

-- CreateIndex
CREATE UNIQUE INDEX "Inscripcion_usuarioId_cursoId_key" ON "Inscripcion"("usuarioId", "cursoId");

-- CreateIndex
CREATE UNIQUE INDEX "Progreso_usuarioId_leccionId_key" ON "Progreso"("usuarioId", "leccionId");

-- CreateIndex
CREATE UNIQUE INDEX "Logro_nombre_key" ON "Logro"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Certificado_codigoVerif_key" ON "Certificado"("codigoVerif");

-- AddForeignKey
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_creadorId_fkey" FOREIGN KEY ("creadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoProfesor" ADD CONSTRAINT "CursoProfesor_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoProfesor" ADD CONSTRAINT "CursoProfesor_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Modulo" ADD CONSTRAINT "Modulo_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leccion" ADD CONSTRAINT "Leccion_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "Modulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_leccionId_fkey" FOREIGN KEY ("leccionId") REFERENCES "Leccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "Modulo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pregunta" ADD CONSTRAINT "Pregunta_evaluacionId_fkey" FOREIGN KEY ("evaluacionId") REFERENCES "Evaluacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opcion" ADD CONSTRAINT "Opcion_preguntaId_fkey" FOREIGN KEY ("preguntaId") REFERENCES "Pregunta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progreso" ADD CONSTRAINT "Progreso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progreso" ADD CONSTRAINT "Progreso_leccionId_fkey" FOREIGN KEY ("leccionId") REFERENCES "Leccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intento" ADD CONSTRAINT "Intento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intento" ADD CONSTRAINT "Intento_evaluacionId_fkey" FOREIGN KEY ("evaluacionId") REFERENCES "Evaluacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComentarioLeccion" ADD CONSTRAINT "ComentarioLeccion_leccionId_fkey" FOREIGN KEY ("leccionId") REFERENCES "Leccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogroUsuario" ADD CONSTRAINT "LogroUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogroUsuario" ADD CONSTRAINT "LogroUsuario_logroId_fkey" FOREIGN KEY ("logroId") REFERENCES "Logro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificado" ADD CONSTRAINT "Certificado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificado" ADD CONSTRAINT "Certificado_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
