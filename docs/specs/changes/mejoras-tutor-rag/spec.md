# Spec — Mejoras del Tutor RAG

## U1 — Backend: recuperación híbrida

### Requisito 1.1 — Recuperación por fragmento

El tutor SHALL combinar similitud pgvector y coincidencia full-text de PostgreSQL
para recuperar fragmentos activos de contenido publicado. SHALL conservar prioridad
de la lección abierta y completar resultados con fragmentos del curso.

- **DADO** un curso con fragmentos y una consulta semántica **CUANDO** se busca
  contexto **ENTONCES** se devuelven resultados relevantes sin perder calidad vectorial.
- **DADO** una consulta con nombre o término exacto **CUANDO** se busca contexto
  **ENTONCES** se prioriza fragmento que contiene coincidencia textual relevante.

### Requisito 1.2 — Fallback de recuperación

Un fallo del full-text SHALL permitir continuar con recuperación vectorial. Curso sin
fragmentos recuperables SHALL producir contexto vacío, sin error técnico.

- **DADO** full-text sin coincidencias **CUANDO** vectorial encuentra fragmentos
  **ENTONCES** chat continúa con esos fragmentos.
- **DADO** curso sin fragmentos publicados **CUANDO** se consulta **ENTONCES** se
  devuelve respuesta controlada sin citas.

## U2 — Chat: historial request-scoped

### Requisito 2.1 — Historial reciente

Cada request SHALL aceptar últimos N turnos `user`/`assistant` de la conversación de
la lección. Backend SHALL permanecer stateless y no SHALL persistir conversación.

- **DADO** historial no vacío **CUANDO** se envía pregunta **ENTONCES** el modelo
  recibe historial delimitado como contexto no confiable, además de pregunta actual.
- **DADO** historial vacío **CUANDO** se envía pregunta **ENTONCES** request funciona
  sin crear almacenamiento de conversación.

### Requisito 2.2 — Contrato y límites

El endpoint SHALL conservar `{ success, data }` y errores `{ success: false, message }`.
Historial inválido, excesivo o con roles no permitidos SHALL ignorarse o recortarse;
no SHALL convertirse en instrucción privilegiada.

- **DADO** usuario sin inscripción, lección borrador o usuario no autorizado
  **CUANDO** solicita chat/status **ENTONCES** responde `403` y no recupera contexto.

## U3 — Grounding gradual

### Requisito 3.1 — Clasificación de evidencia

El tutor SHALL distinguir evidencia suficiente, parcial y ausente. Evidencia parcial
SHALL producir respuesta matizada que explicite cobertura incompleta e incluya solo
citas válidas. `NO_EVIDENCE_ANSWER` SHALL reservarse para ausencia de evidencia útil
en preguntas permitidas.

- **DADO** evidencia parcial **CUANDO** proveedor responde **ENTONCES** respuesta
  reconoce límite y sus citas pertenecen a fuentes recuperadas.
- **DADO** ausencia total de evidencia **CUANDO** se consulta **ENTONCES** responde
  `NO_EVIDENCE_ANSWER` con `citations: []`.

### Requisito 3.2 — Fallos del proveedor

Timeout, caída o respuesta inválida del proveedor SHALL convertirse en error
controlado, sin escrituras parciales ni exposición de secretos.

- **DADO** proveedor caído **CUANDO** se procesa chat **ENTONCES** API responde
  error controlado y no guarda conversación.

## U4 — Seguridad y regresiones

### Requisito 4.1 — Controles no debilitados

El sistema SHALL mantener detección de prompt injection, contexto no confiable,
bloqueo de acciones mutantes, validación estricta de citas, rate limits, permisos,
lecciones publicadas y acceso restringido a cursos habilitados. Eventos de seguridad
NO SHALL guardar texto completo de mensajes, historial, prompts ni respuestas.

- **DADO** mensaje para cambiar nota, progreso o inscripción **CUANDO** se recibe
  **ENTONCES** se bloquea sin retrieval ni proveedor.
- **DADO** respuesta con cita inexistente **CUANDO** se valida **ENTONCES** se
  rechaza de forma controlada y no se muestran citas inválidas.

### Requisito 4.2 — Compatibilidad operativa

El sistema SHALL conservar embeddinggemma-300m, 768 dimensiones, Cloudflare Workers
AI, prioridad de lección, fallback de curso, límites actuales y formato API. No SHALL
persistir conversación, procesar PDF, aplicar reranking ni requerir HNSW.

- **DADO** proveedor de embedding no disponible **CUANDO** se indexa o consulta
  **ENTONCES** operación informa fallo controlado sin alterar contenido principal.
- **DADO** curso habilitado con lección publicada **CUANDO** se consulta **ENTONCES**
  flujo existente continúa; lección borrador SHALL quedar excluida.
