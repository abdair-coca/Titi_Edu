# Tasks — Rediseño de Inicio y Explorar

> **Change:** `rediseno-inicio-explorar`
> **Estado:** implementado; falta probar con la API real y en celular.
> Verificación: `cd backend && npm test`, `cd frontend && npm run build`.

## Fase 1 — API (solo lectura)

- [x] 1.1 `GET /api/users/suggestions` (R6) antes de `/:username`.
- [x] 1.2 `GET /api/search/trending` (R8).
- [x] 1.3 Tests de ambos; `docs/api.md`.

## Fase 2 — Piezas sociales v3

- [x] 2.1 `components/social/Avatar.jsx` y `FollowButton.jsx` (optimista).
- [x] 2.2 `components/social/PersonCard.jsx` (tile + variante de lista) y `useSuggestions`.
- [x] 2.3 `components/social/TrendingHashtags.jsx` (pastillas + ranking) y `useTrending`.
- [x] 2.4 `Pill` exportada desde `catalog/CatalogFilters.jsx`; `useQuickViewParam` compartido.

## Fase 3 — Componentes compartidos

- [x] 3.1 `PostCard` v3 con doble toque para like (R4).
- [x] 3.2 `CreatePost` v3 plegable, sin emojis (R3).
- [x] 3.3 `AcademicActivityCard` v3 con vista rápida (R5).
- [x] 3.4 `CategoriesExplorer` con `categoryTheme` y pastillas v3.

## Fase 4 — Páginas

- [x] 4.1 `Feed.jsx`: orden R2, pestañas, sugerencias inline, rail, estados (R9).
- [x] 4.2 `Explore.jsx`: cabecera, filas, búsqueda en URL con pestañas, rail (R7).

## Fase 5 — Cierre

- [x] 5.1 `design.md` (§5.5 post v3, superficie v3, inventario §14).
- [x] 5.2 Tests backend + build frontend; capturas a 1280 y 390 px con datos simulados.
- [x] 5.3 `verify-report.md` y fila en el índice de `AGENTS.md`.
