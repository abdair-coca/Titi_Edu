# Plan — Centralizador de notas docente

> Estado: **propuesta aprobada para implementar** (pendiente de ejecución).
> Orquestador: agente principal. Subagentes: modelos baratos, caveman ultra.
> Regla de orquestación: `C:\Users\abdai\.codex\skills\orchestrate-subagents\SKILL.md` antes de cada delegación.

## Objetivo

Que el profesor pueda ver las **calificaciones** de sus estudiantes centralizadas
por curso, desglosables por módulo y lección: notas de quizzes, puntajes de
presentaciones HTML evaluables y progreso de lecciones.

## Hallazgos (exploración 2026-08-17)

- Las notas **ya existen** en Postgres — **no hace falta migración Prisma**:
  - `Intento` — intento de quiz: `usuarioId`, `evaluacionId`, `nota`, `aprobado`, `numero`.
  - `Evaluacion` — de módulo (`moduloId` único) o final de curso (`cursoId`, `esFinal`).
  - `ResultadoHtmlLeccion` — mejor puntaje HTML evaluable por estudiante/recurso (`mejorPuntaje`).
  - `IntentoHtmlLeccion` — intentos HTML consumidos (`puntaje`).
  - `Progreso` — lección completada por estudiante.
  - `Inscripcion` — estudiante ↔ curso (`completado`).
- **Hueco**: no existe ningún endpoint teacher para ver notas de estudiantes.
  Solo hay `/evaluations/:id/my-attempts` (estudiante) y `get_quiz_analytics`
  (agregado anónimo, vía authoring).
- Owner-check existente: `curso.profesores.some(p => p.profesorId === usuario.id)`
  (`backend/src/routes/courses.js:202`).
- ⚠️ `NotaLeccion` son **notas personales** del estudiante (texto libre), NO
  calificaciones. Fuera de alcance.

## Alcance

### U1 — Backend

Nuevo `backend/src/routes/grades.js`:

- `GET /api/courses/:courseId/grades`
  - Auth: `requireAuth` + teacher-owner del curso o `ADMIN`.
  - Respuesta (`{ success, data }`): por cada estudiante inscrito:
    - `usuario`: id, nombre, username.
    - `progreso`: lecciones completadas / total.
    - `evaluaciones`: por cada evaluación del curso (módulos + final):
      mejor nota, aprobado, intentos usados.
    - `html`: por cada lección con recurso HTML evaluable: `mejorPuntaje`.
    - `completado` (de `Inscripcion`).
  - **Una query Prisma** con includes anidados (inscripciones → usuario;
    evaluaciones → intentos; lecciones → recursoHtml → resultados). Prohibido N+1.
- Mount en `backend/src/app.js`.
- Tests `backend/test/routes/grades.test.js` (Prisma mockeado, patrón existente):
  owner ve notas · no-owner → 403 · estudiante → 403 · curso sin inscritos → lista vacía.

### U2 — Frontend

- Nueva página `frontend/src/pages/teacher/CourseGrades.jsx`:
  - Tabla estudiantes × evaluaciones.
  - Filtro por módulo → lección (misma tabla).
  - Colores aprobado/reprobado, UI plana (sin `bg-gradient-*` ni `blur-*`).
  - Exportar CSV client-side.
- Ruta `/teaching/:courseId/grades` en `frontend/src/App.jsx`.
- Botón "Notas" en `frontend/src/pages/teacher/MyTeaching.jsx`.

## Orquestación (token-barata)

1. Exploración ya hecha por el orquestador — no más agentes explore.
2. Agente barato U1 (backend) → verificación con `npx vitest run test/routes/grades.test.js`.
3. Agente barato U2 (frontend) → verificación con build Vite.
4. Micro-commits por unidad (convencional, español, `abdair-coca`, sin Co-Authored-By).
5. Caveman ultra en toda comunicación de subagentes; código y contratos precisos.

## Decisiones tomadas

- "Notas" = calificaciones (quiz + HTML evaluable), no `NotaLeccion`.
- Vista por-lección = filtro módulo→lección sobre la misma tabla (sin endpoint extra).
- Admin también accede (misma ruta, rol `ADMIN`).

## Fuera de alcance

- Edición manual de notas por el profesor.
- Notas personales (`NotaLeccion`).
- Exportación server-side / PDF.
- Promedios ponderados configurables.
