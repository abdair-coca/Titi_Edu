# Tasks — Tutor RAG orientado al aprendizaje

> Marcar `[x]` al avanzar.
> Change: `tutor-rag-aprendizaje`
>
> Regla: cerrar una etapa, ejecutar sus pruebas, informar resultados y pedir
> feedback explícito. No iniciar etapa siguiente sin respuesta del usuario.

## Etapa 1 — Seguridad y evidencia confiable

### Backend

- [x] Hacer extractor HTML consciente de HTML evaluable y excluir claves/atributos de respuesta (`correcta`, `answer`, `solution`, `data-answer`, equivalentes).
- [x] Aplicar umbral efectivo a resultados híbridos y vectoriales antes de construir contexto final; preservar coincidencia full-text positiva como excepción explícita.
- [x] Deduplicar fragmentos por contenido normalizado sin romper prioridad de lección ni relleno del curso.
- [x] Mantener `NO_EVIDENCE_ANSWER` cuando no queden fragmentos calificados y evitar invocar al generador en ese caso.
- [x] Verificar que citas estudiantiles solo expongan contenido seguro, extracto y metadata publicada.
- [x] Mantener bloqueo de acciones mutantes, prompt injection, rate limits, permisos y errores controlados.

### Frontend

- [x] Corregir construcción de historial para excluir solo mensaje actual, conservar último turno del tutor y no duplicar reintentos.
- [x] Mantener conversaciones aisladas por `lessonId` y comportamiento stateless del backend.

### Pruebas y puerta

- [x] Agregar regresiones del extractor para claves en JSON, JavaScript, atributos `data-*` y contenido visible permitido.
- [x] Agregar tests de umbral, coincidencia full-text, deduplicación, ausencia de evidencia y fallback híbrido-vectorial.
- [x] Agregar regresiones de historial para seguimiento, reintento y aislamiento por lección.
- [x] Ejecutar `npm --prefix backend test`.
- [x] Ejecutar `npm --prefix backend run lint`.
- [x] Informar cambios, evidencia y riesgos; pedir feedback explícito antes de Etapa 2.

> Etapa 1 cerrada técnicamente; Etapa 2 permanece bloqueada hasta feedback explícito.

## Etapa 2 — Tutoría formativa y adaptación

### Backend

- [ ] Definir `intent` permitido (`DUDA`, `EXPLICAR`, `EJEMPLO`, `RESUMEN`, `PRACTICA`, `PISTA`, `RETROALIMENTAR`) con default compatible `DUDA`.
- [ ] Validar `intent` en `POST /api/lessons/:id/chat`, devolver `400` para valores desconocidos y conservar el contrato API.
- [ ] Implementar carga request-scoped del contexto mínimo usando solo curso/lección actual, `Progreso`, `Inscripcion` e intentos relevantes.
- [ ] Convertir progreso y desempeño a estados agregados sin enviar PII, notas, respuestas, claves ni datos de otros usuarios al proveedor.
- [ ] Usar contexto neutral cuando la carga opcional falle y registrar únicamente evento técnico sin texto de conversación.
- [ ] Extender prompt con reglas por intención, adaptación de dificultad y ciclo práctica → respuesta → feedback.
- [ ] Asegurar que `PRACTICA` no revele solución antes del intento y que `PISTA` no entregue solución completa.
- [ ] Asegurar que `RETROALIMENTAR` produzca feedback cualitativo con próximo paso, sin crear `Intento`, cambiar `Progreso` ni asignar nota oficial.
- [ ] Mantener controles de seguridad y no ejecutar acciones desde el LLM.

### Pruebas y puerta

- [ ] Agregar tests de validación de `intent`, contexto neutral, minimización de datos y adaptación por estados de aprendizaje.
- [ ] Agregar tests de prompt/flujo para duda, explicación, práctica, pista y retroalimentación sin solución ni mutaciones.
- [ ] Ejecutar tests backend y lint de etapa.
- [ ] Informar cambios, evidencia y riesgos; pedir feedback explícito antes de Etapa 3.

## Etapa 3 — Experiencia de estudio y cierre

### Frontend

- [ ] Asociar intención pedagógica a acciones rápidas y acciones posteriores de `TutorPanel.jsx`.
- [ ] Mantener estado de práctica por `lessonId`, limpiar al cambiar de lección o iniciar conversación nueva y enviar `RETROALIMENTAR` al responder.
- [ ] Retirar etiqueta `Relevancia: X%` o reemplazarla por una descripción honesta de fuente/score técnico no calibrado.
- [ ] Ajustar textos de interfaz para distinguir tutoría formativa de calificación oficial.

### Pruebas, documentación y cierre

- [ ] Agregar regresiones de interacción frontend para acciones, estado de práctica y citas.
- [ ] Ejecutar `npm --prefix frontend run test:rag`.
- [ ] Ejecutar `npm --prefix frontend run build`.
- [ ] Actualizar `docs/api.md` con `intent`, contexto formativo, reglas de práctica y campos de citas.
- [ ] Actualizar `docs/rag-security.md` con protección de claves evaluables y límites de contexto del estudiante.
- [ ] Actualizar `README.md` si cambia la descripción pública del Tutor RAG.
- [ ] Ejecutar `npm --prefix backend test` y `npm --prefix backend run lint` como regresión final.
- [ ] Generar `docs/specs/changes/tutor-rag-aprendizaje/verify-report.md` con evidencia de tests y matriz de aprendizaje.
- [ ] Marcar tareas completadas y preparar micro-commits convencionales en español, sin `Co-Authored-By`.
