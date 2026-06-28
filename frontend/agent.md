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

> **Estado: PARCIAL.** El backend de **notas** está implementado (`NotaLeccion` +
> `GET/PUT /api/lessons/:id/note`). El layout de 3 columnas y la card "Profundiza"
> (stub de IA) son el spec de abajo. Implementar el resto **solo cuando el usuario
> lo pida** (no es parte del plan de Etapa 6).

### Objetivo: layout de 3 columnas dentro del shell

```
┌──────────────┬───────────────────────────────┬──────────────────┐
│  IZQUIERDA   │           CENTRO              │     DERECHA      │
│  (nav curso) │   (video + lección + acción)  │  (paneles)       │
├──────────────┼───────────────────────────────┼──────────────────┤
│ ← Volver     │  Video 16:9                    │ ▸ Notas      [^] │
│ Título curso │  Título lección [Guardar nota] │ ▸ Materiales [^] │
│ PROGRESO ▓▓  │  Descripción                   │ ▸ Comentarios[^] │
│ ✓ Lección 1  │  ┌ Profundiza (chips IA) ─────┐│                  │
│ ✓ Lección 2  │  [Siguiente →] [✓ Completada]  │                  │
└──────────────┴───────────────────────────────┴──────────────────┘
```

### Cambios por zona

- **Izquierda:** mover la barra de progreso al sidebar (bajo el título del curso,
  label `PROGRESO DEL CURSO`). Lecciones con ✓ y activa resaltada (ya existe).
  Quitar del centro el "✕" cerrar y el toggle de progreso.
- **Centro:** video arriba (ya existe). Fila de título + botón "Guardar nota".
  Descripción (`leccion.contenido`) debajo del título. Card **"Profundiza en este
  tema"** (NUEVA, **stub**): fondo destacado, ✨, 4 chips de prompt ("preguntas de
  práctica", "explica simple", "resumen", "ejemplos reales"); respuesta mock por
  ahora, contrato listo para `POST /api/lessons/:id/ai` con Claude API (key **nunca**
  en el frontend). Fila de acción: "Siguiente lección →" (solo navegación) +
  "✓ Lección completada" (reusa el botón actual).
- **Derecha (NUEVA):** riel vertical de íconos (Notas / Materiales / Comentarios),
  colapsado por defecto, uno abierto a la vez. Notas = textarea ligada al endpoint
  de notas (comparte estado con "Guardar nota"). Materiales reusa `MaterialChip`.
  Comentarios mueve `<LessonComments>` adentro con contador (N) y empty state Titi.

### Decisiones tomadas

1. **Notas** → Postgres (`NotaLeccion`). **Implementado.**
2. **"Profundiza" (IA)** → stub por ahora; Claude API después (`titi-backend-patterns`).
3. **like / dislike / flag** → omitir.
4. **Siguiente lección** → solo frontend (navegación entre `activeId`).

### Responsive

Desktop (lg+): 3 columnas, izquierda y derecha `sticky`. Móvil: una columna,
izquierda → drawer (ya existe), derecha → paneles colapsados debajo del contenido.

### Convenciones

UI plana (sin gradiente/blur); `<TitiMascot>` nunca 🐒; paneles entran con `usePopIn`,
listas con `useStaggerReveal` (deps por valor, `motion.md` §5), ≤400ms, respeta
`prefers-reduced-motion`; servicios externos (Claude API) en `try/catch` que no rompe.
