# Tasks — Centralizador de notas docente

> Marcar `[x]` al avanzar. Orquestación token-barata (subagentes caveman ultra).
> Exploración ya hecha — no más agentes explore.

## Backend (U1)

- [ ] Crear `backend/src/routes/grades.js` con `GET /api/courses/:courseId/grades`.
- [ ] Guard: `requireAuth` + teacher-owner (`curso.profesores`) o `ADMIN`.
- [ ] Una query Prisma con includes (inscripciones → usuario; evaluaciones →
      intentos; lecciones → recursoHtml → resultados). Sin N+1.
- [ ] Shape de respuesta: `usuario`, `progreso`, `evaluaciones`, `html`, `completado`.
- [ ] Curso sin inscritos → `data` con lista vacía.
- [ ] Mount en `backend/src/app.js`.
- [ ] Verificar: `npx vitest run test/routes/grades.test.js`.

## Tests backend

- [ ] `backend/test/routes/grades.test.js` (Prisma mockeado, patrón existente):
      owner ve notas · no-owner → 403 · estudiante → 403 · curso sin inscritos → lista vacía.

## Frontend (U2)

- [ ] Crear `frontend/src/pages/teacher/CourseGrades.jsx` (tabla estudiantes × evaluaciones).
- [ ] Filtro módulo → lección (misma tabla).
- [ ] Colores aprobado/reprobado, UI plana (sin gradiente/blur).
- [ ] Exportar CSV client-side.
- [ ] Ruta `/teaching/:courseId/grades` en `frontend/src/App.jsx`.
- [ ] Botón "Notas" en `frontend/src/pages/teacher/MyTeaching.jsx`.
- [ ] Verificar: `cd frontend && npm run build`.

## Cierre

- [ ] Micro-commits convencionales en español por unidad (identidad `abdair-coca`, sin Co-Authored-By).
- [ ] `verify-report.md` con evidencia de tests + build.