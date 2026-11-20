# Verify report — Cielo 3D en el header de cursos

> **Fecha:** 2026-11-20 · **Change:** `cielo-hero-cursos`
> **Resultado:** cumple la spec, salvo la medición en un celular real (pendiente).

## Comandos

| Comando | Resultado |
|---|---|
| `cd frontend && npm run build` | ✅ limpio (solo el aviso de Vite por el tamaño del chunk de three, esperado) |
| `npm run test:hero-3d` | ✅ `Hero 3D code split: OK` (ahora también vigila `HeroSky`, `skyLayout`, `support.js` y las piezas compartidas) |
| Resto de `npm run test:*` (12 scripts) | ✅ todos OK |

## Peso (build de producción, gzip)

| Pieza | Antes | Ahora |
|---|---|---|
| Chunk `Courses` | 10,3 KB | **11,8 KB** (`HeroSky` + `skyLayout`; sin three) |
| Habitación (three + escena) | 256 KB en un chunk | **224 KB** three compartido (Rollup lo nombra `sceneKit-*.js`) + **34 KB** `HeroScene` = 258 KB, igual que antes |
| Cielo `SkyScene` | — | **6,7 KB** (usa el mismo three; no lo duplica) |
| Modelos / imágenes nuevas | — | ninguna (todo con figuras básicas en código) |

## Comportamiento (Chromium headless, `vite preview` y `vite dev`, API simulada con Playwright)

En este contenedor no hay GPU: WebGL corre por CPU (SwiftShader). Ahí el
monitor de rendimiento apaga el cielo (y el cuarto vuelve a la imagen), que
es el respaldo esperado. Para capturar las interacciones se desactivó el
monitor **solo durante la prueba** (no quedó en el código) y se avanzó el
reloj de la página a pasos (`performance.now` controlado desde Playwright).

| Caso | Resultado |
|---|---|
| Desktop 1280 px | lienzo de 639 × 494 desde el borde de la pantalla hasta antes del cuarto, borde derecho fundido; repartidor en la fila del badge, dron chico a la derecha del párrafo, avión con estela, 3 gotas, 3 nubes; todo detrás del texto |
| Mobile 390 px | lienzo de borde a borde (390 × 538) hasta las cifras; solo repartidor + avión; el cuarto (más abajo) fuera del lienzo |
| Click en el repartidor (desktop) | rizo hacia abajo visible detrás del título; suelta una gota que cae y queda apoyada en el borde del buscador; cursor de puntero |
| Click en el dron chico | voltereta en el lugar con saltito (no tapa el título) y suelta una gota |
| Tap en el repartidor (mobile, touch) | mismo rizo + gota; el scroll de la página no se bloquea |
| `prefers-reduced-motion` | 0 lienzos; no se descargan `SkyScene` ni three |
| Rendimiento bajo (SwiftShader) | el cielo se apaga a la primera caída (`[heroSky] se apaga el cielo: rendimiento bajo`) |
| Habitación | igual que antes (mismas piezas, solo se movieron helpers a módulos compartidos) |
| Consola | sin errores |

## Pendiente

- Medir FPS en un celular de gama media real con cielo + cuarto juntos.
- Esquive del mouse y salpicadura de gotas revisados en código y a ojo en dev;
  no hay captura paso a paso de esos dos.
