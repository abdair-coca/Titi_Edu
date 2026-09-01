# Proposal — Centralizador de notas docente

> **Estado:** propuesta aprobada para implementar (pendiente de ejecución).
> Orquestador: agente principal. Subagentes: modelos baratos, caveman ultra.
> Regla de orquestación: `C:\Users\abdai\.codex\skills\orchestrate-subagents\SKILL.md` antes de cada delegación.

## Intención

Que el profesor vea las **calificaciones** de sus estudiantes centralizadas por
curso, desglosables por módulo y lección: notas de quizzes, puntajes de
presentaciones HTML evaluables y progreso de lecciones. Hoy no existe ningún
endpoint teacher para esto.

## Alcance

### In Scope
- `GET /api/courses/:courseId/grades` — notas de todos los inscritos (teacher-owner o ADMIN).
- Página teacher `CourseGrades.jsx` con tabla estudiantes × evaluaciones + filtro módulo→lección + CSV client-side.
- Tests backend del patrón existente (Prisma mockeado).

### Out of Scope
- Edición manual de notas por el profesor.
- Notas personales (`NotaLeccion` — texto libre del estudiante, no calificación).
- Exportación server-side / PDF.
- Promedios ponderados configurables.

## Hallazgos (exploración 2026-08-17)

- Las notas **ya existen** en Postgres — **no hace falta migración Prisma**:
  - `Intento` (quiz: usuarioId, evaluacionId, nota, aprobado, numero)
  - `Evaluacion` (de módulo o final de curso)
  - `ResultadoHtmlLeccion` (mejor puntaje HTML por estudiante/recurso)
  - `IntentoHtmlLeccion` (intentos HTML consumidos)
  - `Progreso` (lección completada) e `Inscripcion` (estudiante↔curso)
- Owner-check existente: `curso.profesores.some(p => p.profesorId === usuario.id)` (`backend/src/routes/courses.js:202`).

## Enfoque

- **Una query Prisma** con includes anidados (inscripciones → usuario; evaluaciones → intentos; lecciones → recursoHtml → resultados). Prohibido N+1.
- Vista por-lección = filtro módulo→lección sobre la misma tabla (sin endpoint extra).

## Decisiones tomadas

- "Notas" = calificaciones (quiz + HTML evaluable), no `NotaLeccion`.
- Admin también accede (misma ruta, rol `ADMIN`).

## Criterios de éxito

- [ ] Teacher-owner ve notas de quiz + HTML + progreso de sus inscritos.
- [ ] No-owner → 403 · estudiante → 403.
- [ ] Curso sin inscritos → lista vacía (sin error).
- [ ] Tests verdes: `npx vitest run test/routes/grades.test.js`.
- [ ] Frontend build verde (`npm run build`).
- [ ] Export CSV client-side funciona.