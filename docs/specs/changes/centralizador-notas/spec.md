# Spec — Centralizador de notas docente

## U1 — Backend: `GET /api/courses/:courseId/grades`

**Requisito:** el teacher-owner de un curso (o un `ADMIN`) puede obtener las
calificaciones de todos los estudiantes inscritos, desglosadas por evaluación y
lección HTML evaluable.

- Auth: `requireAuth` + teacher-owner del curso o `ADMIN`.
- Respuesta (`{ success, data }`): por cada estudiante inscrito:
  - `usuario`: id, nombre, username.
  - `progreso`: lecciones completadas / total.
  - `evaluaciones`: por cada evaluación del curso (módulos + final): mejor nota,
    aprobado, intentos usados.
  - `html`: por cada lección con recurso HTML evaluable: `mejorPuntaje`.
  - `completado` (de `Inscripcion`).
- Una query Prisma con includes anidados. Prohibido N+1.
- Mount en `backend/src/app.js`.

### Escenarios

- **DADO** un teacher-owner **CUANDO** pide `/grades` de su curso
  **ENTONCES** recibe la lista completa con `{ success: true, data }`.
- **DADO** un usuario no-owner **CUANDO** pide `/grades`
  **ENTONCES** recibe `403` con mensaje en español.
- **DADO** un estudiante **CUANDO** pide `/grades`
  **ENTONCES** recibe `403`.
- **DADO** un curso sin inscritos **CUANDO** pide `/grades`
  **ENTONCES** recibe `data` con lista vacía (sin error).

## U2 — Frontend: `CourseGrades.jsx`

**Requisito:** el profesor ve una tabla de estudiantes × evaluaciones con notas,
filtra por módulo → lección y exporta CSV client-side.

- Nueva página `frontend/src/pages/teacher/CourseGrades.jsx`:
  - Tabla estudiantes × evaluaciones.
  - Filtro por módulo → lección (misma tabla).
  - Colores aprobado/reprobado, UI plana (sin `bg-gradient-*` ni `blur-*`).
  - Exportar CSV client-side.
- Ruta `/teaching/:courseId/grades` en `frontend/src/App.jsx`.
- Botón "Notas" en `frontend/src/pages/teacher/MyTeaching.jsx`.

### Escenarios

- **DADO** un curso con notas **CUANDO** el profe abre la página
  **ENTONCES** ve la tabla con todas las evaluaciones y colores por estado.
- **DADO** un módulo seleccionado en el filtro **CUANDO** el profe elige una lección
  **ENTONCES** la tabla muestra solo las evaluaciones de esa lección.
- **DADO** la tabla visible **CUANDO** el profe pulsa "Exportar CSV"
  **ENTONCES** descarga un archivo con los datos visibles.

## Fuera de alcance (reiterado)

Edición de notas · `NotaLeccion` · export server-side · promedios ponderados.