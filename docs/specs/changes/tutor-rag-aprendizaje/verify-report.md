# Informe de verificación — Tutor RAG orientado al aprendizaje

**Fecha:** 2026-09-18
**Change:** `tutor-rag-aprendizaje`
**Alcance:** Etapas 1, 2, 3 y Etapa 4 de implementación

## Resultado

Etapas 1–3 cerradas técnicamente. Etapa 4 queda implementada, verificada en código y
reindexada en la base configurada: 6 lecciones publicadas procesadas, 6 documentos
activos en estado `LISTO` y 76 fragmentos disponibles. La migración fue aditiva y no
eliminó datos existentes.
El frontend conecta las acciones rápidas con
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
| Contexto autoral válido y archivo `.txt`/`.md` | `routes/authoring.test.js`, `rag.service.test.js`, `ModulesEditor.jsx` | PASS; JSON, extensión y contenido público seguro |
| Precedencia autoral sin HTML/Markdown existente | `rag.indexing.test.js` | PASS; documento `AUTOR` exclusivo |
| Fallback legacy y claves evaluables | `rag.indexing.test.js`, `html-extractor.service.test.js` | PASS; `HTML_FALLBACK` y extractor seguro |
| Fingerprint, revisión, versión y reindexación | `routes/authoring.test.js`, `rag.indexing.test.js` | PASS; guardado/restauración programan indexación |
| Origen, sección, deduplicación y citas | `rag.retrieval.test.js`, `admin-rag.test.js` | PASS; metadata propagada sin corpus autoral a estudiantes |
| No exposición de contexto autoral | `lessons.test.js`, `courses.js` select explícito | PASS; respuesta pública omite `contextoRag` |
| Migración aditiva | `rag-assessment-safe-migration.test.js` | PASS; sin DROP, Material ni Cloudinary |

## Comandos

```text
npm --prefix frontend run test:rag       PASS
npm --prefix frontend run test:tutor-history PASS
npm --prefix frontend run test:html-lesson PASS
npm --prefix frontend run build          PASS — warning existente de chunks >500 kB
npm --prefix backend test                PASS — 32 archivos, 336 tests
npm --prefix backend run lint            PASS
npx prisma validate --schema prisma/schema.prisma PASS
npx prisma migrate deploy --schema prisma/schema.prisma PASS — migración aditiva aplicada
git diff --check                         PASS
```

La corrida focalizada RED/GREEN también pasó: `npm --prefix backend test -- --run
test/routes/authoring.test.js test/services/rag.indexing.test.js
test/services/rag.retrieval.test.js test/prisma/rag-assessment-safe-migration.test.js`.

El build muestra únicamente advertencia existente de chunks mayores a 500 kB.

## Prueba de integración local

Con curso piloto configurado, estudiante inscrito y documentos `LISTO`:

- Prompt genérico de explicación: HTTP `200`, respuesta con 2 citas.
- Prompt genérico de ejemplo: HTTP `200`, respuesta con 1 cita.
- No se ejecutó seed ni se modificaron progreso/notas.
- Reindexación operativa: 6 lecciones publicadas procesadas; 5 quedaron `UNCHANGED` y
  1 fue `INDEXED`; 6 documentos activos quedaron `LISTO`.

## Riesgos residuales

- Pruebas frontend son contratos Node y helpers puros; no existe runner de componentes
  React instalado en este repositorio.
- Build mantiene advertencia de tamaño de chunks.
- La base conserva 2 documentos históricos `FALLIDO` y 11 documentos antiguos inactivos;
  ninguno está activo ni participa en recuperación. No se ejecutó seed ni se modificaron
  progreso/notas.
- Validación de proveedor se ejecutó en entorno local/staging con ruta directa; producción
  debe continuar usando gateway y sus controles de estado compartido.
