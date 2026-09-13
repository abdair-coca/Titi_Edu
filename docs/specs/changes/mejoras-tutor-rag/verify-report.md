# Verify Report — Mejoras del Tutor RAG

> **Change:** `mejoras-tutor-rag`
> **Fecha:** 2026-09-13
> **Resultado:** ✅ Verificado

## Resumen

Se implementaron las tres mejoras sobre el pipeline RAG sin cambiar el modelo de
embedding (embeddinggemma-300m, 768 dims, Cloudflare Workers AI):

1. **Búsqueda híbrida**: `searchFragments` combina pgvector + full-text Postgres
   (`tsvector`) con Reciprocal Rank Fusion; fallback a vector puro si el full-text falla.
2. **Historial request-scoped**: `POST /api/lessons/:id/chat` acepta `history`
   (últimos N turnos); el backend sigue stateless; el historial se envía al modelo
   como contexto no confiable.
3. **Grounding gradual**: evidencia parcial → respuesta matizada con citas válidas;
   `NO_EVIDENCE_ANSWER` solo sin evidencia útil.

## Cambios

| Archivo | Acción | Detalle |
|---|---|---|
| `backend/prisma/migrations/20260913010000_rag_hybrid_tsvector/migration.sql` | Creado | Columna `tsv tsvector` generada + índice GIN |
| `backend/prisma/schema.prisma` | Modificado | `FragmentoRag.tsv Unsupported("tsvector")` |
| `backend/src/services/rag.service.js` | Modificado | `searchFragmentsHybrid`/`searchFragmentsVector` + fallback, `normalizeChatHistory`, historial en `generateAnswer`, prompt de grounding gradual (`RAG_EVIDENCE_THRESHOLD`) |
| `backend/src/routes/rag.js` | Modificado | Acepta y valida `history` en POST chat |
| `frontend/src/components/TutorPanel.jsx` | Modificado | Envía historial de `conversation` al chat |
| `docs/api.md`, `docs/rag-security.md` | Modificado | Contrato y controles actualizados |

## Verificación

- Tests backend: `npm test` → **30 files / 301 tests passed** (10 nuevos).
- Nuevos tests: hybrid SQL terms, fallback híbrido→vector, `normalizeChatHistory`
  (roles, límite, recorte), historial al proveedor (roles order, sin `system`),
  history inválido en route, sin historial en requests bloqueados.
- Lint backend: `npm run lint` → sin errores.
- Build frontend: `npm run build` → OK (42.47s).

## Escenarios probados

| Escenario | Resultado |
|---|---|
| Consulta semántica recupera fragmentos (regresión) | ✅ tests previos verdes |
| Consulta con término exacto usa full-text (`ts_rank_cd`, `"tsv"`) | ✅ |
| Columna `tsv` inexistente → fallback vectorial, sin error 500 | ✅ |
| Historial llega como `[system, user, assistant, user]`; turnos `system` descartados | ✅ |
| Historial vacío / no array → 400 controlado o array vacío | ✅ |
| Mensaje de acción mutante → bloqueado sin retrieval ni proveedor, con o sin historial | ✅ |
| Evidencia parcial → prompt de matiz; ausencia total → `NO_EVIDENCE_ANSWER` | ✅ |
| Prompt injection en historial → evento `history_injection_signal` | ✅ |

## Riesgos / notas

- La columna `tsv` es generada (`GENERATED ALWAYS AS ... STORED`): el reindexado
  de fragmentos existentes la recalcula automáticamente; no se requiere reindexar
  cursos. Si se revierte la migración, el fallback vectorial mantiene operativo el chat.
- Peso RRF configurable via `RAG_HYBRID_VECTOR_WEIGHT`/`RAG_HYBRID_FTS_WEIGHT`
  (default 0.7/0.3) y umbral de evidencia via `RAG_EVIDENCE_THRESHOLD` (default 0.45).
- El historial se trunca a 1000 chars por turno y a `RAG_CHAT_HISTORY_LIMIT` turnos
  (default 8) en el backend; el frontend envía lo que `tutorConvos` tiene por lección.

## Criterios de éxito

- [x] Consultas con términos exactos priorizan fragmentos; semánticas conservan calidad.
- [x] Historial llega al LLM sin persistirse ni convertirse en instrucción privilegiada.
- [x] Evidencia parcial produce respuesta matizada con citas; ausencia total → `NO_EVIDENCE_ANSWER`.
- [x] Prompt injection, acciones mutantes, permisos, rate limits y citas mantienen regresiones verdes.
- [x] Tests backend y build frontend pasan.