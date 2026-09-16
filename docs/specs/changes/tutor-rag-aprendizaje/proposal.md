# Propuesta — Tutor RAG orientado al aprendizaje

> **Estado:** propuesta en revisión.
> **Change:** `tutor-rag-aprendizaje`
> **Fecha:** 2026-09-16

## Intención

Convertir el Tutor IA de un buscador conversacional con citas en un apoyo de
aprendizaje formativo. Debe ayudar a comprender, practicar y corregir errores sin
resolver evaluaciones por adelantado, sin inventar evidencia y sin tratar datos
personales como material de estudio.

## Problemas observados

- `TutorPanel.jsx` ofrece acciones como "Hazme una pregunta" y "corregí mi respuesta",
  pero backend no recibe una intención pedagógica explícita. La interacción puede
  terminar en una explicación genérica en vez de práctica guiada.
- La construcción actual de historial usa `slice(0, -1)` siempre. En seguimientos
  elimina la última respuesta del tutor y rompe continuidad; en reintentos puede
  eliminar el único turno disponible.
- `extractLessonHtmlContent()` indexa campos como `correcta`, `answer` y
  `data-answer`. En actividades evaluables, el tutor puede recibir la clave de
  respuesta aunque el estudiante todavía no haya intentado resolverla.
- `RAG_EVIDENCE_THRESHOLD` marca evidencia como parcial, pero no evita que fragmentos
  débiles entren al contexto. Además, la UI presenta similitud coseno como
  "Relevancia: X%", una precisión que el sistema no calibra.
- El chat conoce curso y lección, pero no usa estado mínimo de avance o desempeño del
  estudiante para ajustar explicación, dificultad o necesidad de refuerzo.
- Los archivos adjuntos (`Material`) todavía no tienen texto extraído; quedan fuera
  del corpus aunque el estudiante los vea en la lección.

## Alcance

### Incluye

- Contexto de aprendizaje efímero y minimizado: avance de lección/curso y banda de
  desempeño del módulo, consultado solo para el estudiante autenticado del curso.
- Intenciones pedagógicas explícitas para duda, explicación, ejemplo, resumen,
  práctica, pista y retroalimentación.
- Práctica guiada: una pregunta por turno, sin solución antes del intento, feedback
  cualitativo después de la respuesta y siguiente paso concreto.
- Umbral efectivo de evidencia, deduplicación de fragmentos y presentación honesta
  de fuentes, conservando búsqueda híbrida y prioridad de lección.
- Corpus seguro para estudiantes: excluir claves de respuestas y datos ocultos de
  actividades evaluables.
- Corrección de continuidad del historial request-scoped y regresiones de seguridad,
  permisos y contrato API.

### No incluye

- Cambio de `embeddinggemma-300m`, 768 dimensiones, proveedor o gateway.
- Indexación de PDF, Word, imágenes, audio, video u OCR. Requiere un pipeline de
  extracción y validación separado.
- Persistencia de conversaciones, notas personales, comentarios o PII.
- Calificación oficial, modificación de notas/progreso/inscripciones o nuevas
  herramientas ejecutables para el LLM.
- Reranking cross-encoder, índice ANN/HNSW o verificación semántica automática de
  cada afirmación del modelo.

## Decisiones de arrastre

- Parte de `mejoras-tutor-rag`: mantiene recuperación híbrida, historial stateless,
  citas, límites, bloqueo de acciones y grounding existente.
- El contexto del estudiante se calcula en backend y se envía como metadatos de
  aprendizaje, nunca como texto libre del usuario ni como documento indexado.
- Una caída al cargar contexto opcional no bloquea una consulta respaldada por el
  corpus; se usa perfil neutral y se registra el fallo técnico sin texto de chat.
- El tutor no reemplaza una evaluación: su feedback no crea `Intento` ni cambia
  `Progreso`.

## Plan en tres etapas

### Etapa 1 — Seguridad y evidencia confiable

Corregir fugas de claves de respuesta, aplicar umbral real de evidencia, deduplicar
fragmentos y reparar continuidad del historial. Esta etapa protege integridad
académica y evita que el tutor construya respuestas sobre fuentes débiles.

**Cierre:** regresiones de extractor, retrieval, citas, historial y seguridad verdes.
Después del cierre se pausa el trabajo y se solicita feedback del usuario.

### Etapa 2 — Tutoría formativa y adaptación

Agregar `intent` pedagógico, contexto mínimo de progreso/desempeño y reglas de
explicación, práctica, pista y retroalimentación. Esta etapa cambia conducta del
tutor sin modificar notas ni progreso oficial.

**Cierre:** contrato de intención, contexto minimizado y escenarios pedagógicos
verificados. Después del cierre se pausa el trabajo y se solicita feedback del usuario.

### Etapa 3 — Experiencia de estudio y cierre

Conectar acciones rápidas y estado de práctica en frontend, corregir lenguaje de
fuentes, completar documentación, build y matriz integral de regresión.

**Cierre:** flujo completo probado en frontend/backend y `verify-report.md` generado.

### Puertas de avance

No se inicia una etapa posterior automáticamente. Al cerrar cada etapa se informan
cambios, pruebas, riesgos pendientes y decisiones; el usuario debe dar feedback
explícito antes de continuar.

## Criterios de éxito

- Una consulta de seguimiento conserva la respuesta previa del tutor y no mezcla
  conversaciones entre lecciones.
- Una acción de práctica genera una sola consigna sin revelar su solución; una
  respuesta del estudiante recibe feedback, error conceptual y próximo paso con
  citas cuando existe evidencia.
- Ningún fragmento estudiantil contiene claves de respuesta de HTML evaluable; una
  solicitud directa de solución recibe explicación o pista, no la clave.
- Fragmentos bajo el umbral no se usan como evidencia suficiente y una consulta sin
  evidencia calificada conserva `NO_EVIDENCE_ANSWER`.
- Explicaciones se adaptan al estado mínimo del estudiante sin enviar PII, notas ni
  datos de otros usuarios.
- Se mantienen permisos, bloqueo de acciones, rate limits, errores controlados,
  `npm --prefix backend test` y `npm --prefix frontend run build`.
