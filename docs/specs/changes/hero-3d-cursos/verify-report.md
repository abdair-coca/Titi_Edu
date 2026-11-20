# Verify report — Hero 3D en el catálogo de cursos

> **Fecha:** 2026-11-19 · **Change:** `hero-3d-cursos`
> **Resultado:** cumple la spec, salvo la medición en un celular real (pendiente).

## Comandos

| Comando | Resultado |
|---|---|
| `cd frontend && npm run build` | ✅ limpio (solo el aviso de Vite por el tamaño de `HeroScene`, esperado) |
| `npm run test:hero-3d` | ✅ `Hero 3D code split: OK` |
| Resto de `npm run test:*` (12 scripts) | ✅ todos OK |

## Peso (build de producción)

| Pieza | Tamaño |
|---|---|
| Chunk `Courses` | 37,8 KB · **10,4 KB gzip** (antes 10,4 KB: sin cambio) |
| Chunk diferido `HeroScene` | 914 KB · **249 KB gzip** (núcleo de three ≈ 85 %) |
| Modelos (8) | **87 KB** en total (antes de comprimir: 300 KB) |
| Poster `hero-3d-poster.webp` | **27 KB** (el `community.webp` anterior: 125 KB) |

## Comportamiento (Chrome headless con SwiftShader, sobre `vite preview`)

| Caso | Resultado |
|---|---|
| Desktop 1280 px | canvas montado, imagen oculta, se descargan los 8 modelos |
| `prefers-reduced-motion` | sin canvas y **sin descargar** el chunk ni los modelos; queda el poster |
| Mobile 390 px | 4 objetos, Titi `lg`; canvas estable a ~145 FPS (SwiftShader) |
| Mobile + Fast 3G | poster primero; el 3D aparece a los ~9 s, con el chunk sin comprimir (`vite preview` no comprime; Vercel sirve brotli) |
| API caída (CORS bloqueado en `:4173`) | sin categorías → queda el poster, sin errores visibles |
| Hover sobre la laptop | crece, sube y muestra la etiqueta "Programación" |
| Click sobre la laptop | filtra por Programación y baja a "Cursos en tendencia" |

## LCP (Fast 3G, desktop, 3 corridas)

| Versión | LCP |
|---|---|
| Hero anterior (`community.webp`) | 5,84 / 6,17 / 5,85 s |
| Hero 3D (poster como LCP) | **4,24 / 4,19 / 4,29 s** |
| Hero 3D con reduced-motion | 3,98 / 3,97 / 3,99 s |

El LCP mejora ~1,6 s porque el poster pesa menos; el 3D llega después del LCP.

## Hallazgos corregidos durante la verificación

- El tween de hover pisaba la entrada (`overwrite` sobre la misma escala): se separaron en dos grupos.
- El cursor de mano quedaba pegado después del scroll que dispara el click: se resetea al hacer click.
- El monitor de rendimiento caía a la imagen durante el calentamiento y la pérdida de contexto se disparaba al desmontar: ahora mide tras 3 s, se reinicia al volver a pantalla y el listener se quita al desmontar.
- La regla "solo categorías con cursos" dejaba un único objeto (producción tiene 1 curso): spec H2 ajustada.

## Pendiente

- **5.3:** medir FPS en un celular de gama media real y el LCP en producción (Vercel, con brotli).
- `public/hero/community.webp` quedó sin uso; se conserva hasta decidir si se borra.
