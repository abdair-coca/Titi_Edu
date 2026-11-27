# Tasks — Learn con el lenguaje v3

> **Change:** `rediseno-learn-v3`
> **Estado:** implementado; falta probar con la API real y en un celular.
> Verificación por etapa: `cd frontend && npx vite build` + los chequeos de
> Learn/tutor (`test:learn-*`, `test:tutor-*`, `test:html-lesson`,
> `test:rag`); capturas a 1280 y 390 px con la API simulada.

## Fase 0 — Base

- [x] 0.1 `proposal.md`, `spec.md`, `tasks.md`.

## Fase 1 — LearnCourse

- [x] 1.1 Índice del curso y cajón (R1) + botón del índice (R2).
- [x] 1.2 Lección: cabecera, superficie, barra de acción (R3).
- [x] 1.3 Riel y paneles (R4).
- [x] 1.4 Avisos (R5) y estados de la página (R6).

## Fase 2 — Evaluación y comentarios

- [x] 2.1 `EvaluationQuiz` (R7).
- [x] 2.2 `LessonComments` (R8).
- [x] 2.3 Chrome de `TutorPanel` y `HtmlLessonPlayer` (primera vuelta: íconos y textos de 11 px).

## Fase 4 — Tutor IA y recursos (segunda vuelta)

- [x] 4.1 `TutorPanel` completo: cabecera, contexto, conversación, fuentes, entrada, vacío, clave (R9).
- [x] 4.2 Respuestas estructuradas `tutor/*` (R10).
- [x] 4.3 `HtmlLessonPlayer`: cifras de la actividad, carga y error (R11).
- [x] 4.4 `GearIcon` y `KeyIcon` en `icons.jsx`; fuera los íconos locales del tutor.
- [x] 4.5 Capturas del tutor (vacío, conversación, quiz, otra lección, sin clave, ajustes) y de la actividad HTML.

## Fase 3 — Cierre

- [x] 3.1 `design.md` (§14, §17) y `verify-report.md`.
- [x] 3.2 Fila en el índice de `AGENTS.md`; fase 6 de `rediseno-plataforma-v3` apunta acá.
