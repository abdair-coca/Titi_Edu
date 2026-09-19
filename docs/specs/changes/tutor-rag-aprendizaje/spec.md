# Spec — Tutor RAG orientado al aprendizaje

## Requisitos

### Requisito 1 — Contexto autoral de lección

Al crear o editar una lección, el autor MUST poder aportar contexto pedagógico opcional mediante texto pegado o archivo `.txt`/`.md`. HTML MUST seguir siendo la presentación o interactividad. El contexto autoral MUST tener precedencia absoluta y no combinarse automáticamente con extracción HTML. Sin contexto autoral, el sistema MUST conservar `HTML_FALLBACK` para lecciones existentes.

#### Scenario: Fuente autoral
- GIVEN una lección con contexto autoral válido
- WHEN se indexa
- THEN se usa exclusivamente como corpus pedagógico y el origen queda identificado como `AUTOR`.

#### Scenario: Fallback legacy
- GIVEN una lección sin contexto autoral
- WHEN se indexa
- THEN se extrae contenido seguro del HTML y el origen queda identificado como `HTML_FALLBACK`.

### Requisito 2 — Versionado y diagnóstico de indexación

El contexto autoral MUST quedar versionado, asociado a fingerprint y revisiones, y cada cambio aceptado MUST disparar reindexación. No se debe modelar como `Material` público ni requerir Cloudinary. El sistema MUST informar estado y origen de indexación, incluyendo fallos de validación o reindexación.

#### Scenario: Edición
- GIVEN una revisión autoral modificada
- WHEN se guarda
- THEN cambia fingerprint, se conserva revisión y se programa reindexación.

#### Scenario: Archivo inválido
- GIVEN un archivo distinto de `.txt` o `.md`
- WHEN se aporta como contexto
- THEN se rechaza con `{ success: false, message }` y no altera revisión ni índice.

### Requisito 3 — Corpus público seguro

El contexto autoral MUST contener solo material pedagógico publicable. MUST NOT incluir respuestas correctas, claves ocultas, feedback privado, PII, notas, progreso, permisos ni acciones de negocio. El índice y sus citas MUST aplicar las mismas restricciones a HTML evaluable; nunca deben exponer HTML original ni campos administrativos.

#### Scenario: Contenido prohibido
- GIVEN contexto autoral con una clave de respuesta o PII
- WHEN se valida o indexa
- THEN se rechaza o excluye de forma explícita y no llega al corpus estudiantil.

#### Scenario: Actividad evaluable
- GIVEN HTML con consigna visible y respuesta oculta
- WHEN se indexa sin contexto autoral
- THEN conserva consigna, excluye clave y ofrece explicación o pista, nunca solución.

### Requisito 4 — Grounding y recuperación

La recuperación MUST usar chunking estructural por sección o bloque, deduplicación y citas con origen, lección, módulo, sección y extracto exacto. MUST aplicar umbral efectivo en búsqueda híbrida y vectorial; si no queda evidencia calificada, devuelve `NO_EVIDENCE_ANSWER` con `citations: []`. Score técnico no debe presentarse como relevancia calibrada.

#### Scenario: Evidencia insuficiente
- GIVEN resultados bajo umbral sin coincidencia textual positiva
- WHEN se genera respuesta
- THEN no se invoca el generador.

### Requisito 5 — Tutoría y seguridad de sesión

`POST /api/lessons/:id/chat` MUST aceptar `intent` opcional (`DUDA`, `EXPLICAR`, `EJEMPLO`, `RESUMEN`, `PRACTICA`, `PISTA`, `RETROALIMENTAR`); omitido equivale a `DUDA`, desconocido devuelve `400`. Práctica no revela solución, feedback no crea nota ni intento, y contexto de progreso es efímero, mínimo y sin PII. Historial request-scoped MUST conservar turnos válidos y aislar lecciones; no se permiten acciones mutantes.

#### Scenario: Práctica
- GIVEN `intent=PRACTICA` sin respuesta previa
- WHEN consulta el estudiante
- THEN recibe una sola consigna sin solución.

### Requisito 6 — Compatibilidad y verificación

El contrato MUST conservar `{ success, data }` y `{ success: false, message }`; fallos del proveedor no alteran progreso. Lecciones legacy MUST seguir consultables. La matriz de regresión SHOULD cubrir precedencia autoral, fallback, revisiones, diagnóstico, inyección de prompts, claves HTML, historial, intención inválida, permisos y proveedor caído.

#### Scenario: Compatibilidad
- GIVEN cliente anterior sin `intent` y lección legacy
- WHEN consulta tutor
- THEN funciona con `DUDA` y `HTML_FALLBACK` sin mezclar conversaciones.
