# Plan técnico — Contexto autoral para Tutor RAG

## Objetivo

Permitir que docentes aporten contexto pedagógico público por texto pegado o archivo `.txt`/`.md`, manteniendo HTML como presentación/interactividad. El índice debe usar una sola fuente por lección, conservar compatibilidad legacy y exponer origen, sección, estado y fallos sin crear `Material` ni usar Cloudinary.

## Decisiones

- Campo provisional `contextoRag` en `Leccion`; el nombre final se confirma antes de implementar. Se persiste como texto opcional. El contrato JSON normaliza texto pegado y archivo leído por cliente a `{ texto, nombreOrigen }`; `nombreOrigen` permite validar `.txt`/`.md` sin multipart.
- Contexto no vacío tiene precedencia absoluta: corpus autoral exclusivo, origen `AUTOR`; no se agregan título, Markdown de lección ni HTML. Contexto vacío mantiene `lessonRagText()` y origen `HTML_FALLBACK`.
- `DocumentoRag` registra origen; `FragmentoRag` registra sección. Se conserva `version` de lección como revisión indexable, `hashContenido`, estado `PENDIENTE|LISTO|FALLIDO` y error truncado.
- Chunking autoral reconoce títulos/secciones y conserva su etiqueta en cada fragmento; normalización y deduplicación ocurren antes de embeddings. Citas devuelven origen, lección, módulo, sección y extracto exacto seguro. Nunca devuelven HTML original ni campos administrativos.
- Validación server-side rechaza extensión inválida, texto vacío o contenido no publicable (claves/respuestas, feedback privado, PII, notas, progreso, permisos y acciones de negocio). El rechazo no modifica revisión ni índice; fallo posterior deja diagnóstico y desactiva documento activo conforme al patrón actual.

## Flujo y contratos

1. `ModulesEditor` lee archivo con `File.text()`, valida `.txt`/`.md` y envía JSON junto con texto pegado al `PUT /api/authoring/lessons/:id` existente.
2. `authoring.js` valida forma, tamaño, extensión y corpus seguro; incluye `contextoRag` en fingerprint y snapshot de revisión. Mutación incrementa `Leccion.version` y llama `scheduleLessonIndex()` después de confirmar transacción.
3. `rag.service.js` selecciona fuente por precedencia, genera documento con origen y fragmentos estructurales, y actualiza estado diagnóstico. Recuperación propaga metadata a citas y mantiene umbral, deduplicación, `NO_EVIDENCE_ANSWER` y aislamiento de lección.
4. Consulta de autoría/status muestra origen (`AUTOR` o `HTML_FALLBACK`), estado y error sin exponer corpus restringido.

Contrato de escritura provisional:

```json
{"contextoRag":{"texto":"...","nombreOrigen":"guia.md"},"expectedFingerprint":"..."}
```

Para texto pegado, `nombreOrigen` es `null`; para limpiar, `contextoRag` es `null`. Respuestas mantienen `{ success, data }` o `{ success: false, message }`.

## Archivos afectados

- `backend/prisma/schema.prisma` y migración Prisma: campo autoral, enum/origen documental y sección de fragmento; defaults compatibles para documentos existentes.
- `backend/src/routes/authoring.js`: fingerprint, snapshot, validación y reindexación en actualización/restauración.
- `backend/src/services/rag.service.js`: selección de fuente, chunking/sección, origen, citas y diagnóstico.
- `backend/src/services/html-extractor.service.js`: conservar fallback seguro; no procesar HTML si existe contexto autoral.
- `frontend/src/pages/teacher/ModulesEditor.jsx`: editor de texto/archivo autoral, lectura local y envío JSON; no crear `Material`.
- Tests existentes en `backend/test/routes/authoring.test.js`, `backend/test/services/rag.indexing.test.js`, `backend/test/services/rag.retrieval.test.js`, `backend/test/services/rag.service.test.js` y pruebas frontend del editor.

## Pruebas

RED antes de producción para contrato inválido, precedencia/fallback, versionado/revisión, origen/sección/citas, contenido prohibido, diagnóstico y lectura `.txt`/`.md`. GREEN verifica regresiones de lecciones existentes, proveedor caído, permisos y contrato API. Ejecutar tests backend, lint y `npm --prefix frontend run build`; validar también `npm --prefix frontend run test:rag` si cubre editor.

## Migración y rollout

Aplicar migración aditiva con campo nullable y defaults de `HTML_FALLBACK`; no convertir materiales ni datos privados. Desplegar schema, backend y frontend en ese orden. Ejecutar reindexación controlada de lecciones publicadas para poblar metadata de origen/sección; fallos quedan visibles y no bloquean publicación. Activar por configuración existente de RAG y observar estados antes de ampliar.

## Riesgos

- Contenido autoral sensible puede ser ambiguo: rechazar conservadoramente y mostrar mensaje accionable.
- Cambio de chunking puede alterar citas y hashes: versionar por `Leccion.version` y conservar documentos previos inactivos.
- Reindexación masiva puede presionar proveedor: ejecutar por lotes, con fallos aislados y reintento operativo.

## Matriz de amenazas

N/A: no se agrega routing, shell, subprocess, automatización VCS/PR, clasificación de ejecutables ni integración de procesos.
