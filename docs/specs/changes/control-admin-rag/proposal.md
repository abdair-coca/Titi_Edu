# Proposal — Panel de Control y Monitoreo RAG para Administradores

> **Estado:** propuesta en revisión.
> **Change:** `control-admin-rag`
> **Fecha:** 2026-09-05

## Intención

Dotar al administrador de TitiEdu de visibilidad y control total sobre el pipeline de indexación y recuperación vectorial (RAG) desde una interfaz dedicada en `/admin/rag`. Hoy la indexación ocurre tras bambalinas de forma asíncrona o mediante un endpoint puntual de curso sin UI de soporte, imposibilitando auditar qué contenido está vectorizado, qué modelo se usó, cuándo se indexó o diagnosticar lecciones con errores sin consultar directamente la base de datos PostgreSQL.

## Alcance

### In Scope
- **Backend:**
  - `GET /api/admin/rag/lessons`: Listado paginado y filtrable (por curso, estado y búsqueda) de lecciones con su estado RAG (`DocumentoRag`: `estado`, `modelo`, `indexadoAt`, `error`, conteo de fragmentos).
  - `GET /api/admin/rag/lessons/:lessonId/fragments`: Detalle del documento activo y sus fragmentos indexados (`FragmentoRag.contenido`, orden, metadata).
  - `POST /api/admin/rag/lessons/:lessonId/reindex`: Disparador de reindexación inmediata para una lección específica.
  - Extensión / unificación con `POST /api/admin/rag/courses/:courseId/reindex`.
  - Tests unitarios y de integración para las nuevas rutas administrativas.
- **Frontend:**
  - Nueva página `frontend/src/pages/admin/AdminRag.jsx` con dashboard de métricas (total, listas, fallidas, pendientes).
  - Tabla interactiva con filtros por curso, estado y búsqueda por título.
  - Modal o visor expandible para inspeccionar el contenido textual de los fragmentos (`chunks`) vectorizados.
  - Botón de reindexación individual por lección y masivo por curso con feedback visual de progreso.
  - Registro de la ruta `/admin/rag` protegida por `AdminOnly` en `App.jsx`.
  - Acceso desde `AdminDashboard.jsx` en la cuadrícula de paneles de gestión.

### Out of Scope
- Edición manual de vectores o fragmentos en base de datos.
- Cambio de proveedor de embeddings en caliente desde la UI (se mantiene gobernado por variables de entorno).
- Pruebas de chat arbitrario fuera del contexto de lecciones.

## Hallazgos Técnicos

- Los modelos de datos ya existen en Prisma (`backend/prisma/schema.prisma`):
  - `DocumentoRag`: `id`, `leccionId`, `version`, `estado` (`PENDIENTE`, `LISTO`, `FALLIDO`), `activo`, `hashContenido`, `modelo`, `error`, `indexadoAt`.
  - `FragmentoRag`: `id`, `documentoId`, `orden`, `contenido`, `embedding` (`vector(768)`).
- La lógica de indexación unitaria ya está desacoplada en `rag.service.js`:
  - `indexLesson(lessonId)`: Carga lección publicada, genera embeddings de fragmentos y actualiza `DocumentoRag` transaccionalmente.
  - `indexCourse(courseId)`: Itera e indexa lecciones de un curso publicado.
- El extractor semántico [`html-extractor.service.js`](file:///c:/Users/abdai/Desktop/base%20de%20datos/SocialNeo/backend/src/services/html-extractor.service.js) ya procesa presentaciones y juegos HTML.

## Enfoque de Arquitectura

- **Seguridad:** Todas las nuevas rutas exigen `requireAuth` y `requireRole('ADMIN')`.
- **Rendimiento:**
  - El listado de lecciones utiliza consultas Prisma optimizadas con paginación (`take`, `skip`) y proyección de campos esenciales (`_count` para fragmentos), evitando traer el array vectorial `embedding` a memoria.
  - La visualización de fragmentos se consulta bajo demanda (`on-demand`) solo al abrir el visor de una lección, omitiendo la columna binaria de vectores para mantener las respuestas JSON ligeras.
- **UI:** Interfaz plana siguiendo el sistema de diseño de Titi (paleta Nunito, `titi-yellow`, `titi-dark`, badges de estado planos sin gradientes).

## Criterios de Éxito

- [ ] Administrador visualiza el estado de indexación de todas las lecciones del catálogo.
- [ ] Administrador puede inspeccionar los fragmentos textuales indexados de cualquier lección.
- [ ] Si una lección falla o no está indexada, el botón "Reindexar" ejecuta la operación y actualiza el estado en tiempo real.
- [ ] No-admin o estudiantes reciben `403 Forbidden`.
- [ ] Tests de endpoints administrativos pasan (`npm --prefix backend test test/routes/admin-rag.test.js`).
- [ ] Build del frontend exitoso sin errores de tipos o empaquetado.
