# Informe de verificación — Tutor RAG orientado al aprendizaje

**Fecha:** 2026-09-17
**Change:** `tutor-rag-aprendizaje`
**Alcance:** Etapas 1, 2 y 3

## Resultado

Etapas 1–3 cerradas técnicamente. El frontend conecta las acciones rápidas con
intenciones pedagógicas, mantiene el ciclo de práctica por `lessonId` y envía
`RETROALIMENTAR` al responder una consigna. El backend conserva grounding, permisos,
corpus seguro y contexto de aprendizaje minimizado.

## Matriz de regresión

| Caso | Evidencia | Resultado |
|---|---|---|
| Duda semántica y término exacto | `rag.service.test.js`, `rag.retrieval.test.js` | PASS |
| Consulta fuera de evidencia | `rag.chat-security.test.js` | PASS; conserva `NO_EVIDENCE_ANSWER` |
| Evidencia parcial y fallback híbrido-vectorial | `rag.retrieval.test.js` | PASS |
| HTML evaluable con claves JSON, JavaScript y `data-*` | `html-extractor.service.test.js` | PASS; claves excluidas |
| Contexto `NECESITA_REFUERZO` y `LOGRADO` | `rag.learning.test.js` | PASS; solo metadata agregada |
| Intenciones válidas e inválida | `rag.learning.test.js`, `routes/rag.test.js` | PASS; inválida responde `400` |
| Práctica sin solución y feedback sin mutaciones | `rag.learning.test.js`, `rag.chat-security.test.js` | PASS |
| Prompt injection, cambio de nota/progreso e inscripción | `rag.chat-security.test.js` | PASS; bloqueado |
| Seguimiento, reintento y aislamiento por lección | `check-tutor-history.mjs`, regresiones backend | PASS |
| Acciones rápidas y posteriores | `check-rag-contract.mjs`, `TutorPanel.jsx` | PASS; intents explícitos |
| Estado práctica por `lessonId`, limpieza y feedback | `tutorPractice.js`, `check-rag-contract.mjs`, `LearnCourse.jsx` | PASS |
| Citas y lenguaje de fuente | `TutorPanel.jsx`, `check-rag-contract.mjs` | PASS; sin porcentaje de relevancia |

## Comandos

```text
npm --prefix frontend run test:rag       PASS
npm --prefix frontend run test:tutor-history PASS
npm --prefix frontend run test:html-lesson PASS
npm --prefix frontend run build          PASS
npm --prefix backend test                PASS — 32 archivos, 328 tests
npm --prefix backend run lint            PASS
git diff --check                         PASS
```

El build muestra únicamente advertencia existente de chunks mayores a 500 kB.

## Prueba de integración local

Con curso piloto configurado, estudiante inscrito y documentos `LISTO`:

- Prompt genérico de explicación: HTTP `200`, respuesta con 2 citas.
- Prompt genérico de ejemplo: HTTP `200`, respuesta con 1 cita.
- No se ejecutaron migraciones, seed ni cambios de progreso/notas.

## Riesgos residuales

- Pruebas frontend son contratos Node y helpers puros; no existe runner de componentes
  React instalado en este repositorio.
- Build mantiene advertencia de tamaño de chunks.
- Validación de proveedor se ejecutó en entorno local/staging con ruta directa; producción
  debe continuar usando gateway y sus controles de estado compartido.
