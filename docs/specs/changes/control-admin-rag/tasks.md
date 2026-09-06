# Tasks — Panel de Control y Monitoreo RAG para Administradores

> Marcar `[x]` al avanzar.
> Change: `control-admin-rag`

## Backend (U1)

- [x] Crear `backend/src/routes/admin-rag.js` con protección `requireAuth` + `requireRole('ADMIN')`.
- [x] Implementar `GET /api/admin/rag/lessons` con paginación, filtros (`courseId`, `status`, `search`) y resumen estadístico (`summary`), filtrando estrictamente lecciones publicadas.
- [x] Implementar `GET /api/admin/rag/lessons/:lessonId/fragments` retornando el contenido textual de los fragmentos activos.
- [x] Implementar `POST /api/admin/rag/lessons/:lessonId/test-query` para simulación semántica de recuperación con scores de similitud.
- [x] Implementar `POST /api/admin/rag/lessons/:lessonId/reindex` de forma sincrónica invocando `indexLesson`.
- [x] Agregar hooks de indexación automática al publicar cursos completos en `backend/src/routes/admin.js`, `backend/src/routes/courses.js` y `backend/src/routes/authoring.js`.
- [x] Asegurar que `ragEnabledForCourse` opere sobre todos los cursos publicados por defecto.
- [x] Montar la ruta en `backend/src/app.js` bajo `/api/admin/rag`.
- [x] Crear pruebas de integración en `backend/test/routes/admin-rag.test.js`.
- [x] Verificar pruebas backend: `npm --prefix backend test test/routes/admin-rag.test.js`.

## Frontend (U2)

- [x] Crear componente `frontend/src/pages/admin/AdminRag.jsx` con métricas clave, filtros y tabla de lecciones.
- [x] Implementar modal o panel `RagFragmentsModal` para inspeccionar los fragmentos textuales indexados.
- [x] Implementar acción de reindexación individual con estado de carga y refresco automático de fila.
- [x] Registrar la ruta `/admin/rag` en `frontend/src/App.jsx` bajo `AdminOnly`.
- [x] Agregar acceso directo a "Control RAG" en `frontend/src/pages/admin/AdminDashboard.jsx`.
- [x] Verificar build del frontend: `npm --prefix frontend run build`.

## Cierre y Verificación

- [x] Correr linter general: `npm --prefix backend run lint`.
- [x] Generar reporte de verificación `docs/specs/changes/control-admin-rag/verify-report.md`.
- [x] Micro-commits convencionales en español por unidad (identidad `abdair-coca`, sin `Co-Authored-By`).
