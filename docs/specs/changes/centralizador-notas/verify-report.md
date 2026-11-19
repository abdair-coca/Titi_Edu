# Verify Report — Centralizador de notas docente

> **Change:** `centralizador-notas`
> **Fecha:** 2026-11-19
> **Resultado:** APROBADO (tests backend verdes, lint limpio, build frontend limpio).
> Pendiente no bloqueante: smoke visual con un curso real.

## Resumen

El profesor dueño de un curso (o un `ADMIN`) ve las notas de todos los inscritos en
`/teacher/courses/:id/grades`: mejor nota por evaluación, puntaje de cada lección HTML
evaluable, progreso y si completó el curso. Puede filtrar por módulo y lección y
exportar CSV desde el navegador.

- **Backend:** `GET /api/courses/:courseId/grades` en `backend/src/routes/grades.js`,
  montado en `backend/src/app.js`.
- **Frontend:** `frontend/src/pages/teacher/CourseGrades.jsx`, ruta en `App.jsx` y botón
  "Notas" en cada tarjeta de `MyTeaching.jsx`.

## Corrección al cerrar

`intentosUsados` devolvía el `numero` del mejor intento, no cuántos intentos hizo el
estudiante (con un 90 en el 1.º y un 60 en el 2.º reportaba 1). Se corrigió en `efa7bca`
contando los intentos por estudiante y evaluación; el test nuevo falla sin la corrección.
La página no muestra ese campo, así que no cambia nada visible.

## 1. Tests backend

```bash
cd backend && npx vitest run test/routes/grades.test.js
```

```
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

Casos cubiertos:

- Profesor owner recibe notas, puntajes HTML, fechas límite y progreso (50 % y 100 %).
- Intentos usados: cuenta todos los intentos aunque el mejor no sea el último.
- `ADMIN` ve notas de cualquier curso.
- Estudiante → `403`.
- Profesor que no es del curso → `403` con mensaje en español.
- Curso inexistente → `404`.
- Curso sin inscritos → `estudiantes: []`.
- Sin token → `401`.

Suite completa y lint:

```bash
cd backend && npx vitest run && npm run lint
```

```
 Test Files  42 passed | 1 skipped (43)
      Tests  621 passed | 17 skipped (638)
```

`eslint src test` sin errores.

## 2. Build frontend

```bash
cd frontend && npm run build
```

`✓ built` sin errores (solo el aviso de tamaño de chunk que ya existía).
`CourseGrades.jsx` no usa `bg-gradient-*` ni `blur-*`.

## 3. Diferencias con la spec

| Spec | Implementado | Motivo |
|---|---|---|
| Una query Prisma con includes | Número fijo de consultas, tres en paralelo | Evita includes enormes; sigue sin N+1 |
| `usuario`: id, nombre, username | id, username, email | `Usuario` no tiene `nombre`; el email sirve en el CSV |
| Filtro de lección muestra "sus evaluaciones" | Acota las columnas HTML de esa lección | Las evaluaciones cuelgan del módulo, no de la lección |
| Ruta `/teaching/:courseId/grades` | `/teacher/courses/:id/grades` | Igual que el resto de rutas docentes |
| — | Filtro "solo final" y `404` para curso inexistente | Extras |

## 4. Pendiente (no bloquea)

- Smoke visual con la app corriendo: abrir "Notas" de un curso con inscritos, filtrar
  por módulo y lección, y exportar CSV.
