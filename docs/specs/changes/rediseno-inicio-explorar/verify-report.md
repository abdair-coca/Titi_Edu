# Verify report — Rediseño de Inicio y Explorar

> **Change:** `rediseno-inicio-explorar` · **Fecha:** 2026-11-22
> **Estado:** implementado y verificado con datos simulados; falta probarlo
> contra la API real (Neo4j con datos) y en un celular.

## Automático

| Comando | Resultado |
|---|---|
| `cd backend && npm test` | 43 archivos, 655 tests en verde (17 omitidos) (11 nuevos en `test/routes/social-discovery.test.js`: sugerencias, tendencias y `isFollowing` en la búsqueda) |
| `cd backend && npx eslint` sobre lo tocado | sin errores |
| `cd frontend && npx vite build` | verde |
| `npm run test:catalog`, `test:hero-3d`, `test:markdown-url` | pass (el catálogo comparte `useQuickViewParam` y `Pill`) |
| Búsqueda de emojis en páginas y componentes tocados | ninguno |

## Visual (Playwright + Chromium, API simulada con `page.route`)

Sesión falsa en `localStorage`, todas las llamadas a `localhost:3001` respondidas
con datos de ejemplo (posts, actividad, inscripciones, sugerencias, tendencias,
búsqueda). Movimiento reducido activado.

| Pantalla | 1280 px | 390 px | Notas |
|---|---|---|---|
| Inicio con contenido | ok | ok | saludo, composer, *Continuá*, pestañas con contador, posts y actividad v3, sugerencias inline en celular, rail *Tu día* / gente / categorías |
| Inicio vacío | ok | ok | Titi `pensando` sin emoji, "Ir a Explorar" y fila *Empezá por acá* |
| Composer desplegado | ok | — | imagen, sonido y ubicación con ícono SVG; contador y Publicar |
| Vista rápida desde una actividad | ok | — | panel derecho sobre Inicio, `?curso=` en la URL |
| Explorar | ok | ok | buscador del catálogo, tendencias (pastillas en celular, ranking en rail), gente para seguir, cursos de la comunidad, publicaciones |
| Explorar con búsqueda | ok | — | pestañas con contador, persona con "Siguiendo" real, tarjeta propia "Sos vos", término resaltado |

Sin errores de consola ni scroll horizontal en ninguna captura.

## Arreglado en el camino

- `TitiMascot` sumaba un emoji a la burbuja aun con `state` (el `mood` por
  defecto es `happy`). Con `state` ya no hay emoji; las llamadas viejas con
  `mood` no cambian.

## Pendiente

- Probar con la API real: que la consulta de sugerencias responda rápido con
  el grafo de producción y que seguir desde las tarjetas sume gotas.
- Pasada en un celular real (doble toque en la imagen para dar like).
