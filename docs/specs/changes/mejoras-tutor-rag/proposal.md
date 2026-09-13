# Propuesta — Mejoras del Tutor RAG

## Intención

Mejorar precisión, continuidad y honestidad del Tutor IA. Hoy recuperación vectorial puede perder nombres o términos exactos; chat envía solo mensaje actual; grounding responde binariamente aunque exista evidencia parcial. El estudiante debe recibir respuestas relevantes, contextualizadas y citadas, sin debilitar controles de seguridad.

## Alcance

### In Scope
- Búsqueda híbrida por fragmento: pgvector (`<=>`) + búsqueda full-text de PostgreSQL (`tsvector`), manteniendo prioridad de lección y fallback de curso.
- Historial reciente en cada request del chat: últimos N turnos `user`/`assistant` desde `tutorConvos`; backend continúa stateless.
- Grounding gradual: respuesta parcial con citas y matiz cuando evidencia cubre solo parte; `NO_EVIDENCE_ANSWER` únicamente sin evidencia útil.
- Tests y documentación del contrato actualizado, preservando formato API `{ success, data }`.

### Out of Scope
- Cambiar `embeddinggemma-300m`, 768 dimensiones o Cloudflare Workers AI.
- Reranking cross-encoder, índice ANN/HNSW (Fase 5), persistencia de conversaciones en Postgres o soporte PDF.

## Capacidades

- **Tutor RAG** (modificada): recuperación híbrida, contexto conversacional request-scoped y tres niveles de grounding.

## Hallazgos

- `backend/src/services/rag.service.js:566` usa `FragmentoRag.embedding` con `<=>`; `schema.prisma:301` declara `vector(768)`. No existe columna `tsvector` (`schema.prisma:296-306`).
- `searchCourseContext` (`rag.service.js:592`) ya aplica prioridad de lección y fallback de curso; `chatWithCourseContext` (`:620`) centraliza rate limit, bloqueo, recuperación y validación.
- `generateAnswer` (`:400-412`) envía `[system, user]`, sin historial, y fuerza `NO_EVIDENCE_ANSWER`; `validateGroundedAnswer` (`:638-642`) mantiene ese binario.
- `LearnCourse.jsx` conserva `tutorConvos` por `lessonId`. `docs/rag-security.md` exige tratar historial y fragmentos como datos no confiables; `docs/api.md:91-105` documenta chat y citas.

## Enfoque

Extender request y prompt con historial delimitado como contexto no confiable. Añadir soporte full-text e índice adecuado para fragmentos, combinar ambas señales con ranking determinista y conservar presupuesto/prioridad actuales. Ajustar clasificación de evidencia y respuesta parcial, manteniendo intactas detección de prompt injection, bloqueo de acciones, validación de citas, rate limits y errores controlados.

## Decisiones

- No persistir conversación ni texto completo en eventos de seguridad.
- Respuestas parciales siempre incluyen citas válidas y explicitan cobertura incompleta.
- Fallos de búsqueda full-text no bloquean operación principal: fallback vectorial; cambios de esquema deben ser reversibles.
- **Reversión:** desactivar búsqueda híbrida y gradiente mediante configuración/rollback de código; conservar columna e índice sin usarlos hasta corregir migración.

## Criterios de éxito

- [ ] Consultas con nombres o términos exactos recuperan fragmentos relevantes; consultas semánticas conservan calidad actual.
- [ ] Historial reciente llega al LLM sin persistirse ni convertirse en instrucción privilegiada.
- [ ] Evidencia parcial produce respuesta matizada con citas; ausencia total conserva `NO_EVIDENCE_ANSWER`.
- [ ] Prompt injection, acciones mutantes, permisos, rate limits y validación de citas mantienen regresiones verdes.
- [ ] Tests backend y `npm run build` frontend pasan.
