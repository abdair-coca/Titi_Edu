# Tasks — Rediseño del catálogo de cursos

> **Change:** `rediseno-catalogo-cursos`
> **Estado:** implementado y publicado en `v4.0.0`; falta la prueba visual con sesión (8.2).
> Verificación: `cd backend && npm test`, `cd frontend && npm run build` y `npm run test:*`.

## Fase 1 — API (solo lectura)

- [x] 1.1 `GET /api/courses`: `_count.lecciones` publicadas (R11).
- [x] 1.2 `GET /api/courses/my/enrolled`: `avance`, `leccionesCompletadas`, `leccionesTotales`, `siguienteLeccionId` sin N+1 (R11).
- [x] 1.3 Tests de ambos endpoints; `docs/api.md` actualizado.

## Fase 2 — Base visual

- [x] 2.1 `components/catalog/categoryIcons.jsx`: mapa nombre → ícono SVG + color de acento, con respaldo genérico (R2).
- [x] 2.2 Microinteracciones de íconos en CSS (hover/foco del padre), apagadas con movimiento reducido.
- [x] 2.3 `frontend/design.md` sin emojis; sección nueva de íconos SVG y tarjeta de curso v3.

## Fase 3 — Catálogo

- [x] 3.1 `catalog/CourseCard.jsx` + skeleton (R5).
- [x] 3.2 `catalog/useCatalogFilters.js`: estado de búsqueda/filtros en la URL, filtrado y orden (R4).
- [x] 3.3 `catalog/CatalogFilters.jsx`: barra pegajosa, chips quitables, hoja de filtros en celular (R4).
- [x] 3.4 `catalog/CatalogGrid.jsx`: cuadrícula con FLIP (GSAP), vacío con Titi, error (R4, R10).
- [x] 3.5 Titi reacciona a la búsqueda (R9).

## Fase 4 — Filas curadas

- [x] 4.1 `catalog/CourseRow.jsx`: fila deslizable con snap, flechas condicionales, "Ver todo" (R3).
- [x] 4.2 Filas: Continúa (barra de avance), Amigos (avatares apilados), Para empezar, Nuevos, Más populares (R3).

## Fase 5 — Vista rápida

- [x] 5.1 `catalog/CourseQuickView.jsx`: panel lateral / hoja inferior, foco atrapado, Esc, `?curso=` (R6).
- [x] 5.2 Acciones por rol: login, inscribirse (optimista + rollback), seguir, ver curso (R6).

## Fase 6 — Rutas y bloque final

- [x] 6.1 `catalog/LearningPathMap.jsx`: camino serpenteante SVG, avance pintado, Titi en el siguiente paso (R7).
- [x] 6.2 `catalog/CatalogOutro.jsx`: visitante vs con sesión, cifras reales con conteo (R8).

## Fase 7 — Integración y limpieza

- [x] 7.1 `Courses.jsx`: queda el hero + composición de las secciones nuevas; fuera testimonios, promo, logros, cifras, categorías populares y footer.
- [x] 7.2 Quitar código muerto que solo usaba `Courses.jsx`.

## Fase 8 — Verificación

- [x] 8.1 Tests de backend y build/tests de frontend en verde.
- [ ] 8.2 Prueba visual en Chrome: desktop y 390 px como visitante (hecho); con sesión y movimiento reducido (pendiente).
- [x] 8.3 `verify-report.md` y fila nueva en el índice de `AGENTS.md`.

## Fase 9 — Release `v4.0.0`

> Decisión del usuario (2026-11-22): commits por fase directo en `main`, push al terminar, tag + Release en GitHub. Incluye todo lo hecho desde `v3.0.0`.

- [x] 9.1 `docs/roadmap.md` y tabla de versionado de `docs/conventions.md` con `v4.0.0`.
- [x] 9.2 Push de `main`, tag anotado `v4.0.0` y Release en GitHub con notas desde `v3.0.0`.
