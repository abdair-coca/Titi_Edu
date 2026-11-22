# Verify report — Rediseño del catálogo de cursos

> **Change:** `rediseno-catalogo-cursos` · **Fecha:** 2026-11-22 · **Versión:** `v4.0.0`

## Automático

| Qué | Resultado |
|---|---|
| `cd backend && npx vitest run` | 42 archivos, 644 tests en verde (17 omitidos, como antes). Nuevos: lecciones por curso en `GET /api/courses` (una consulta, catálogo vacío sin consulta) y avance de `/my/enrolled` (avance, siguiente lección, última actividad, sin N+1, curso terminado). |
| `npx eslint` sobre `routes/courses.js` y su test | sin errores |
| `cd frontend && npm run build` | ok |
| `npm run test:*` (15 scripts, incluye `test:hero-3d` y el nuevo `test:catalog`) | todos en verde |
| `test:catalog` | filtros (búsqueda sin acentos, categoría, nivel, largo, certificado), orden, URL ida y vuelta, enlace viejo `?categoria=<id>`, filas curadas (incluido catálogo chico) y rutas |
| Emojis en `frontend/design.md` | 0 |

## Manual (Chrome, backend y Vite locales, sin sesión)

| Escenario | Resultado |
|---|---|
| Desktop 1482 px: catálogo, pastillas con ícono y color de categoría, tarjeta v3 | ok |
| Tocar la tarjeta abre la vista rápida (panel derecho), `?curso=` en la URL, temario plegable, "Inicia sesión para inscribirte" | ok |
| Esc cierra la vista rápida y limpia la URL | ok |
| Filtro "Avanzado" sin resultados: chip quitable, "0 de 1 curso", Titi pensando con la lupa, "Limpiar todo" | ok |
| Bloque final de visitante con cifras reales y registro | ok, tras corregir el plural ("1 profe") y que Titi pisaba una cifra |
| Barra de filtros pegajosa con el header de visitante | ok, tras corregir que quedaba debajo del header |
| 390 px (iframe): sin scroll horizontal, tira de categorías + botón "Filtros", hoja inferior que se cierra arrastrando, vista rápida como hoja | ok |

## Hallazgos y decisiones

- Producción y desarrollo tienen **un solo curso publicado**: las filas temáticas
  repetían la misma tarjeta tres veces. Ahora solo aparecen con 8 cursos o más
  (R3); las rutas se ocultan solas porque sus cursos no existen todavía.
- Al quitar cursos del filtro, React los saca del DOM antes de animar: salen sin
  fundido (R10 actualizado).
- El Vite que ya estaba corriendo no tomaba los colores nuevos de Tailwind; hubo
  que reiniciarlo.

## Pendiente

- Probar con sesión: fila *Continúa* con avance, *Tus amigos*, botón
  "Inscribirme gratis" y bloque final con racha/gotas/próximo logro. La cuenta
  demo del seed no entra en la base compartida (otra contraseña).
- Probar con `prefers-reduced-motion` y medir en un celular real.
- Fuera de `/courses` quedan emojis en mensajes de Titi y otras pantallas; la
  regla nueva de `design.md` los prohíbe, se limpian con la regla boy scout.
