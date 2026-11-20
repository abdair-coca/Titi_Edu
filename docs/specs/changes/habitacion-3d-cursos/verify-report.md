# Verify report — Habitación 3D en el hero de cursos

> **Fecha:** 2026-11-19 · **Change:** `habitacion-3d-cursos`
> **Resultado:** cumple la spec, salvo la medición en un celular real (pendiente).

## Comandos

| Comando | Resultado |
|---|---|
| `cd frontend && npm run build` | ✅ limpio (solo el aviso de Vite por el tamaño de `HeroScene`, esperado) |
| `npm run test:hero-3d` | ✅ `Hero 3D code split: OK` (ahora también vigila las piezas de la habitación) |
| Resto de `npm run test:*` (12 scripts) | ✅ todos OK |

## Peso (build de producción)

| Pieza | Antes (`hero-3d-cursos`) | Ahora |
|---|---|---|
| Chunk `Courses` | 10,4 KB gzip | **10,5 KB gzip** (chip + ícono de mano en `Hero3D`; sin three) |
| Chunk diferido `HeroScene` | 249 KB gzip | **258 KB gzip** (+ sombras suaves, cajas redondeadas) |
| Modelos | 87 KB (8) | **87 KB** (los mismos 8; el cuarto se arma en código) |
| Poster `hero-3d-poster.webp` | 27 KB | **29 KB** (1176 × 882, captura de la habitación) |

## Comportamiento (Chrome headless sobre el build/dev, backend local en :3001)

Las capturas se tomaron con la GPU de la laptop (Intel UHD, ANGLE D3D11) y sin
tope de vsync; SwiftShader (render por CPU) se usó solo para comparar.

| Caso | Resultado |
|---|---|
| Desktop 1280 px | cuarto completo en la caja (588 × 441), 8 categorías en su lugar, chip "Arrastrá para girar" |
| Mobile 390 px | mismo cuarto (358 × 268), las 8 categorías, DPR 1 sin antialias |
| Hover sobre la laptop | sube, crece y muestra la pill "Programación"; cursor de puntero |
| Arrastre −180 px / +200 px (mouse) | el cuarto gira hasta el tope de ±35°; el chip desaparece; vuelve al frente solo |
| Arrastre horizontal con el dedo (mobile) | gira el cuarto, `scrollY` no cambia, el chip desaparece |
| Deslizamiento vertical con el dedo sobre el canvas (mobile) | la página scrollea (`scrollY` 565 → 837) y el cuarto no gira |
| Click en la paleta (desktop) / tap en la laptop (mobile) | filtra y baja a "Cursos en tendencia" (`#trending` arriba de todo) |
| Click en la lámpara | se apaga la luz del escritorio |
| Click en la gota / pelota / planta | rebota / rueda al otro lado / se sacude (capturadas con el reloj de la página ralentizado) |
| Click en la gota junto a la laptop | no navega (área de toque de la laptop ajustada al modelo) |
| `prefers-reduced-motion` | sin canvas ni chunk; queda el poster |
| Consola | sin errores ni avisos en todas las corridas |

## FPS (GPU integrada Intel UHD, headless sin vsync)

| Página | FPS |
|---|---|
| `/courses` con la habitación, desktop calidad alta (DPR 1,5, antialias, PCSS) | 122 – 224 |
| `/courses` con la habitación, perfil mobile 390 px (DPR 1, PCF) | 146 – 559 |

Es la GPU de una laptop, no un celular: la medición en un celular real sigue pendiente.

En SwiftShader (sin GPU) la escena va a 5–9 FPS en desktop y ~30 en mobile:
ahí el monitor baja la calidad y termina en la imagen, que es el respaldo
esperado para equipos sin aceleración.

## LCP (Fast 3G, desktop, 3 corridas, `vite preview`)

| Versión | LCP |
|---|---|
| Escena anterior (`hero-3d-cursos`, poster 27 KB) | 4,24 / 4,19 / 4,29 s |
| Hero anterior a todo el 3D (`community.webp`), medido hoy | 6,25 / 6,21 / 6,23 s |
| Habitación (poster 32 KB, primera tanda) | 4,32 / 4,57 / 4,36 s |
| **Habitación (poster final 29 KB)** | **4,42 / 4,42 / 4,41 s** |
| Habitación con reduced-motion (poster final) | 4,00 / 4,02 / 4,05 s |

El LCP sigue siendo el poster y la escena llega después. Respecto de la escena
anterior sube ~0,15 s; parte es ruido de la máquina (una tanda intermedia con
el mismo build dio 4,68 / 4,78 / 4,44 s), pero queda dentro del tope de 4,5 s.

## Hallazgos corregidos durante la verificación

- La paleta se veía negra: su modelo no trae normales; ahora se calculan al cargar.
- La caja de toque agrandada de la laptop tapaba a la gota vecina: el área de
  toque ahora es del tamaño del modelo (mínimo 0,3 por lado).
- Pasar por encima de objetos mientras se arrastra mostraba etiquetas: ahora no.
- `PerformanceMonitor` contaba cada "mejora" como vaivén (`flipflops`) y en
  pantallas de más de 60 Hz terminaba volviendo a la imagen sin motivo: se
  quitó el tope superior y la vuelta a la imagen queda solo por caídas.
- El rebote de la gota duraba 460 ms: ajustado a 400 ms.

## Pendiente

- Medir FPS en un celular de gama media real y el LCP en producción (Vercel, brotli).
