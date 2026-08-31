# agent.md (frontend) — Titi

Guía de trabajo específica del frontend.

- Sistema visual → `frontend/design.md`
- Animación / motion → `frontend/motion.md`
- Arquitectura, API, convenciones, roadmap → `../docs/`
- Mapa del repo + estado actual → `../AGENTS.md`

**Histórico de rediseños ya implementados** (catálogo de Cursos v2 y v2.1):
`../docs/archive/courses-redesign.md`.

---

## Spec viva — Rediseño Sección Learn (`pages/LearnCourse.jsx`)

> **Estado: IMPLEMENTADO.** Layout de 3 columnas, riel lateral Notas/Materiales/
> Comentarios, notas (`NotaLeccion` + `GET/PUT /api/lessons/:id/note`) ya viven
> en `pages/LearnCourse.jsx`. QA responsive 375px/1440px verificado.

> **Tutor IA (rediseño): IMPLEMENTADO.** El tutor dejó de ser la card inline
> `RagTutorCard` (eliminada) y ahora es un **panel lateral** desde el riel
> derecho (`TutorPanel.jsx`, ancho desktop `lg:w-[26rem]`, móvil = bottom-sheet
> full-height). Consume los endpoints reales `GET /api/lessons/:id/chat/status`
> y `POST /api/lessons/:id/chat`. El backend es **stateless**: la conversación
> vive en `LearnCourse` keyed por lección (`tutorConvos`), nunca se mezclan
> lecciones y sobrevive al abrir/cerrar el panel.

### Objetivo: layout de 3 columnas dentro del shell

```
┌──────────────┬───────────────────────────────┬──────────────────┐
│  IZQUIERDA   │           CENTRO              │     DERECHA      │
│  (nav curso) │   (video + lección + acción)  │  (paneles)       │
├──────────────┼───────────────────────────────┼──────────────────┤
│ ← Volver     │  Video 16:9                    │ ✨ Tutor IA  [^] │
│ Título curso │  Título lección [Guardar nota] │ ▸ Notas      [^] │
│ PROGRESO ▓▓  │  Descripción                   │ ▸ Materiales [^] │
│ ✓ Lección 1  │  [Siguiente →] [✓ Completada]  │ ▸ Comentarios[^] │
│ ✓ Lección 2  │                                │                  │
└──────────────┴───────────────────────────────┴──────────────────┘
```

### Cambios por zona

- **Izquierda:** barra de progreso en el sidebar (bajo el título del curso,
  label `PROGRESO DEL CURSO`). Lecciones con ✓ y activa resaltada.
- **Centro:** video arriba. Título + "Guardar nota". Descripción
  (`leccion.contenido`). Fila de acción: "Siguiente lección →" + botón de
  completar. La card "Profundiza" / `RagTutorCard` **ya no existe** en el cuerpo.
- **Derecha:** riel vertical de íconos (**Tutor IA / Notas / Materiales /
  Comentarios**), colapsado por defecto, uno abierto a la vez.

### Tutor IA — decisiones tomadas

1. **Endpoint real**: `POST /api/lessons/:id/chat` (Groq/RAG). Fuentes reales
   (`citations`: `title`, `moduleTitle`, `excerpt`, `similarity` → % real),
   relevancia **nunca inventada**. "Ver material" navega client-side a la
   lección citada (misma página, sin URLs inventadas).
2. **Loading honesto**: etapas temporizadas (Analizando → Buscando) + el conteo
   REAL de fuentes de la respuesta + reveal. No se afirma ninguna operación
   que el backend no haga.
3. **Errores**: mensaje genérico + "Reintentar"; detalle técnico solo a
   `console.error` — nunca al alumno.
4. **Conversación client-side** (backend stateless): `tutorConvos` en
   `LearnCourse`, keyed por `lessonId`. Nueva conversación = resetea ese key.
5. **Mobile**: bottom-sheet full-height (`titi-sheet-in`); en desktop el panel
   entra con el grid-cols 0fr→1fr del patrón de colapso (motion.md §3).
6. **Estados sin disponibilidad**: si `enabled`/`indexed` faltan, el panel
   muestra estados honestos (no pantalla rota) y el botón del riel sigue.

### Responsive

Desktop (lg+): 3 columnas, izquierda y derecha `sticky`. Móvil: una columna,
izquierda → drawer, derecha → paneles colapsados debajo del contenido + Tutor IA
como bottom-sheet.

### Convenciones

UI plana (sin gradiente/blur); `<TitiMascot>` nunca 🐒; paneles entran con
`usePopIn`/grid-collapse, listas con `useStaggerReveal` (deps por valor,
`motion.md` §5), ≤400ms, respeta `prefers-reduced-motion`; servicios externos
en `try/catch` que no rompe.
