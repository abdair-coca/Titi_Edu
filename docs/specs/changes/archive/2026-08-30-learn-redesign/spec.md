# Archivo — Rediseño Sección Learn (`pages/LearnCourse.jsx`)

> **Histórico. IMPLEMENTADO.** Spec viva original en `frontend/agent.md`.
> Layout de 3 columnas + Tutor IA como panel lateral. Se guarda para contexto;
> no es trabajo pendiente.

## Qué quedó implementado

- **Layout 3 columnas** dentro del shell: izquierda (nav curso + progreso +
  lecciones con ✓), centro (video + lección + acción), derecha (riel de paneles).
- **Riel derecho colapsable** (uno abierto a la vez): Tutor IA / Notas /
  Materiales / Comentarios. Desktop `lg:w-[26rem]`; móvil = bottom-sheet.
- **Notas**: `NotaLeccion` + `GET/PUT /api/lessons/:id/note`.
- **Tutor IA (rediseño)**: dejó de ser la card inline `RagTutorCard` (eliminada)
  y pasó a panel lateral. Consume `GET /api/lessons/:id/chat/status` y
  `POST /api/lessons/:id/chat`. Backend stateless; conversación client-side en
  `LearnCourse` keyed por `lessonId` (`tutorConvos`).

## Decisiones tomadas (Tutor IA)

1. **Endpoint real** `POST /api/lessons/:id/chat` (Groq/RAG). Fuentes reales
   (`citations`: `title`, `moduleTitle`, `excerpt`, `similarity` → % real),
   relevancia nunca inventada. "Ver material" navega client-side.
2. **Loading honesto**: etapas temporizadas (Analizando → Buscando) + conteo REAL
   de fuentes de la respuesta + reveal.
3. **Errores**: mensaje genérico + "Reintentar"; detalle técnico solo a
   `console.error` — nunca al alumno.
4. **Conversación client-side** (backend stateless): `tutorConvos` keyed por
   `lessonId`. Nueva conversación = resetea ese key.
5. **Mobile**: bottom-sheet full-height (`titi-sheet-in`); desktop grid-cols
   0fr→1fr (motion.md §3).
6. **Estados sin disponibilidad**: si `enabled`/`indexed` faltan, panel muestra
   estados honestos (no pantalla rota).

## Responsive

Desktop (lg+): 3 columnas, izquierda y derecha `sticky`. Móvil: una columna,
izquierda → drawer, derecha → paneles colapsados debajo del contenido + Tutor IA
como bottom-sheet.

## Convenciones aplicadas

UI plana (sin gradiente/blur); `<TitiMascot>` nunca 🐒; paneles entran con
`usePopIn`/grid-collapse, listas con `useStaggerReveal` (deps por valor,
motion.md §5), ≤400ms, respeta `prefers-reduced-motion`; servicios externos en
`try/catch` que no rompe.

## QA

Responsive 375px/1440px verificado.