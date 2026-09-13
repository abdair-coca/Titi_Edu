# Tasks — Mejoras del Tutor RAG

> Marcar `[x]` al avanzar.
> Change: `mejoras-tutor-rag`

## Backend (U1) — Recuperación híbrida

- [x] Crear migración Prisma `20260913010000_rag_hybrid_tsvector`: columna `tsvector` en `FragmentoRag` (generada desde `contenido`) + índice `GIN` para full-text español (`config 'spanish'`). Mantener reversible (drop column + index).
- [x] Actualizar `backend/prisma/schema.prisma` model `FragmentoRag` con la columna `tsvector`/campo correspondiente (patrón `Unsupported` si Prisma no lo expone).
- [x] En `indexLesson` (`rag.service.js:460`): poblar/persistir el `tsvector` al indexar fragmentos (reindexar cursos existentes requiere regresión o reindexado manual — documentar).
- [x] Modificar `searchFragments` (`rag.service.js:566`) para combinar similitud vectorial (`<=>`) + ranking full-text (`ts_rank_cd`) con peso determinista (ej. RRF o suma ponderada), conservando filtros (curso publicado, módulo/lección publicados, documento activo `LISTO`) y prioridad de lección.
- [x] Implementar fallback: si el full-text falla o devuelve vacío, retornar solo vectorial (sin bloquear la operación principal).
- [x] Test de regresión: consulta semántica conserva calidad; consulta con término exacto prioriza fragmento textual (`backend/test/`).

## Backend (U2) — Chat con historial request-scoped

- [x] Extender `chatWithCourseContext` (`rag.service.js:620`) para aceptar historial `history` (últimos N turnos `user`/`assistant`, N configurable `RAG_CHAT_HISTORY_LIMIT`, default ej. 8).
- [x] En `generateAnswer` (`rag.service.js:400`): insertar historial en `messages` como contexto no confiable (delimitado, después del system prompt, nunca como instrucción), seguido del mensaje actual.
- [x] Validar/clipear historial en el request: roles permitidos (`user`/`assistant`), texto ≤ tope por turno, ignorar turnos inválidos, recortar a N recientes.
- [x] En `rag.js` (`POST /lessons/:id/chat`, línea 69): aceptar `history` opcional en el body y pasarlo al servicio; conservar validación de `message` (requerido, ≤1000 chars).
- [x] No persistir conversación ni guardar texto completo en eventos de seguridad (mantener contrato `docs/rag-security.md`).

## Backend (U3) — Grounding gradual

- [x] Ajustar clasificación de evidencia en el flujo de chat: distinguir suficiente / parcial / ausente según cobertura de los fragmentos recuperados.
- [x] Actualizar system prompt en `generateAnswer`: evidencia parcial → respuesta matizada que explicita cobertura incompleta y usa solo citas válidas; `NO_EVIDENCE_ANSWER` reservado a ausencia total.
- [x] Adaptar `validateGroundedAnswer` (`rag.service.js:638`) y la política de rechazo para no degradar respuestas parciales legítimas (citas válidas siguen obligatorias).
- [x] Mantener intactos: detección de prompt injection, bloqueo de acciones mutantes, validación de citas, rate limits, permisos y errores controlados.

## Frontend (U4)

- [x] En `TutorPanel.jsx` (`ask`, línea 129): enviar los últimos N turnos de `conversation` como `history` en el POST `/api/lessons/:id/chat` (filtrando role `tutor` → `assistant`), sin duplicar el mensaje actual.
- [x] Manejar respuesta parcial sin cambios de contrato visual (citas y answer se renderizan como hoy).
- [x] Verificar que `tutorConvos` keyed por `lessonId` (`LearnCourse.jsx:90,716`) alimenta el historial sin fuga entre lecciones.

## Tests y verificación

- [x] Tests backend verdes: `npm --prefix backend test` (regresión completa, incluyendo `test/routes/rag.test.js` y tests de `rag.service`).
- [x] Frontend build verde: `npm --prefix frontend run build`.
- [x] Linter backend: `npm --prefix backend run lint`.
- [x] Documentar contrato nuevo en `docs/api.md` (sección Tutor RAG) y `docs/rag-security.md` si aplica.
- [x] Generar reporte `docs/specs/changes/mejoras-tutor-rag/verify-report.md`.
- [x] Micro-commits convencionales en español por unidad (identidad `abdair-coca`, sin `Co-Authored-By`).