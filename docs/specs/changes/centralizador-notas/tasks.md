# Tasks — Centralizador de notas docente

> Marcar `[x]` al avanzar. Orquestación token-barata (subagentes caveman ultra).
> Exploración ya hecha — no más agentes explore.

## Backend (U1)

- [x] Crear `backend/src/routes/grades.js` con `GET /api/courses/:courseId/grades`.
- [x] Guard: `requireAuth` + teacher-owner (`curso.profesores`) o `ADMIN`.
      _También cuenta como owner el `creadorId`; curso inexistente → 404._
- [x] Una query Prisma con includes (inscripciones → usuario; evaluaciones →
      intentos; lecciones → recursoHtml → resultados). Sin N+1.
      _Se resolvió con un número fijo de consultas (curso, evaluación final,
      inscripciones y tres en paralelo para intentos, progreso y resultados HTML),
      sin consultas por estudiante._
- [x] Shape de respuesta: `usuario`, `progreso`, `evaluaciones`, `html`, `completado`.
      _`usuario` trae `id`, `username` y `email` (no hay `nombre`); `intentosUsados`
      cuenta todos los intentos desde `efa7bca`._
- [x] Curso sin inscritos → `data` con lista vacía.
- [x] Mount en `backend/src/app.js`.
- [x] Verificar: `npx vitest run test/routes/grades.test.js`.

## Tests backend

- [x] `backend/test/routes/grades.test.js` (Prisma mockeado, patrón existente):
      owner ve notas · no-owner → 403 · estudiante → 403 · curso sin inscritos → lista vacía.
      _Además: admin, 404, 401 e intentos usados._

## Frontend (U2)

- [x] Crear `frontend/src/pages/teacher/CourseGrades.jsx` (tabla estudiantes × evaluaciones).
- [x] Filtro módulo → lección (misma tabla).
      _Las evaluaciones son por módulo: el filtro de lección acota las columnas de
      lecciones HTML evaluables. Hay también un filtro "solo final"._
- [x] Colores aprobado/reprobado, UI plana (sin gradiente/blur).
- [x] Exportar CSV client-side.
- [x] Ruta `/teaching/:courseId/grades` en `frontend/src/App.jsx`.
      _Quedó como `/teacher/courses/:id/grades`, alineada con el resto de rutas docentes._
- [x] Botón "Notas" en `frontend/src/pages/teacher/MyTeaching.jsx`.
- [x] Verificar: `cd frontend && npm run build`.

## Cierre

- [x] Micro-commits convencionales en español por unidad (identidad `abdair-coca`, sin Co-Authored-By).
      _El código entró en `19e0a10` junto con `control-admin-rag`, no por unidad; la
      corrección y el cierre sí van en micro-commits._
- [x] `verify-report.md` con evidencia de tests + build.
