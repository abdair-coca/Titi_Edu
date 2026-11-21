# Verify report — Titi 3D en el cuarto de cursos (pulido visual)

> **Fecha:** 2026-11-21 · **Change:** `titi-3d-cursos` (fase 5)
> **Resultado:** cumple T1, T1b, T2 y T3 en render por software; falta medir FPS
> con GPU real y en un celular (tareas 4.3 y 4.4).

## Comandos

| Comando | Resultado |
|---|---|
| `cd frontend && npm run build` | ✅ limpio (solo el aviso de tamaño de chunks que ya existía) |
| `npm run test:titi-3d` | ✅ `vida propia, carga, toque, poses y cara OK` |
| `npm run test:hero-3d` | ✅ `Hero 3D code split: OK` (Titi sigue fuera del chunk principal) |
| `npm run shots:titi -- <carpeta>` (con `npm run dev`) | ✅ 15 capturas + hoja de contacto, sin errores de consola |

## Comparación visual

Capturas del laboratorio (misma luz, ambiente y tono que el cuarto), antes y
después, desde los mismos ángulos:

- [antes-despues.webp](antes-despues.webp): frente, 3/4, costado, espalda, cara y celebrando.
- [referencia-vs.webp](referencia-vs.webp): `Titi.png` junto al antes y al después.
- [hoja-angulos.webp](hoja-angulos.webp): todos los ángulos y expresiones del después.
- [cuarto-interaccion.webp](cuarto-interaccion.webp): en el cuarto real: sentado → click (celebra) → arrastre (cuelga) → soltar (aterriza) → se recupera.

| Rasgo | Antes | Después |
|---|---|---|
| Color del pelaje en la luz | (247, 204, 99) — anaranjado, lavado por el tone mapping | **(251, 202, 47)** = `#FBCA2F` exacto |
| Sombra en la espalda | (151, 107, 1) — marrón | (230, 160, 33) — dorado cálido |
| Ojos | pupila enorme, el antifaz tapa el blanco | blanco visible alrededor, pupila abajo-adentro, brillo arriba-izquierda (como la imagen) |
| Boca | dos arcos que parecían dientes, tapados por el bigote | "w" fina bajo la nariz, encima del bigote |
| Bigote | cuernos romos que nacen bajo la nariz | medialunas blancas desde las comisuras, puntas para arriba, sombra gris lavanda |
| Cola | 14 cápsulas con quiebres visibles, gancho | una malla continua con esqueleto; espiral cerrada |
| Mechón / cejas / chivita | 3 conos rígidos / óvalos / gota | llamitas inclinadas / mechones con punta / chivita en punta |
| En el cuarto (~60 px) | se confunde con el piso y la alfombra | se despega por el color y el contorno fino |

## Comportamiento en el cuarto real

Chrome headless con SwiftShader (render por CPU, ~5 fps reales), `/courses` con
la API simulada (8 categorías). Con el reloj normal el monitor de rendimiento
vuelve a la imagen (correcto a 5 fps), así que se usó un **reloj virtual**
(cada frame avanza 1/45 s) para probar la interacción.

| Caso | Resultado |
|---|---|
| Cursor sobre Titi | `pointer` |
| Click | celebra: brazos arriba, saltitos, boca abierta, cejas y puntas del bigote arriba |
| Arrastre en diagonal | cuelga del puntero, brazos arriba, bigote caído; la mancha de contacto se achica |
| Soltar | cae, se aplasta, ceño, y vuelve a sentarse |
| Consola | sin errores ni avisos `[titi]` |

## Rendimiento

| Medida (página entera, mismos pasos) | Antes | Después |
|---|---|---|
| Llamadas de dibujo por frame | 156 | **160** (+30 contornos, −26 por la cola en una sola malla con su sombra) |
| Triángulos por frame | 44,6 k | 62,5 k (barridos suaves y contornos) |
| Chunk diferido `HeroScene` | 40,6 KB gzip | 46,3 KB gzip |
| Movimiento máximo por frame sentado (umbral de sombras 0,004) | — | 0,0029: no redibuja sombras en reposo |

## Pendiente

- FPS con GPU real en desktop (4.3) y en un celular de gama media (4.4): el
  render por software no sirve para medirlo.

---

# Fase 6 — Dirección de arte

> **Fecha:** 2026-11-21 · **Resultado:** mismo personaje, con acabado de
> mascota de juego; T1, T1b y T2 siguen cumpliéndose en render por software.

## Comandos

| Comando | Resultado |
|---|---|
| `cd frontend && npm run build` | ✅ limpio (solo el aviso de tamaño de chunks que ya existía); `HeroScene` 48,2 KB gzip |
| `npm run test:titi-3d` | ✅ `vida propia, carga, toque, poses y cara OK` |
| `npm run test:hero-3d` | ✅ `Hero 3D code split: OK` |
| `npm run shots:titi -- <carpeta>` | ✅ 15 capturas sin errores de consola |
| `/courses` con la API simulada | ✅ sin errores de consola (en render por software el monitor de rendimiento muestra el póster) |

## Comparación visual

- [fase6-antes-despues.webp](fase6-antes-despues.webp): `Titi.png`, antes y después desde frente, 3/4, costado, espalda, cara y cara 3/4.
- [fase6-poses.webp](fase6-poses.webp): saludo, festejo, caminata, cargado, caras de festejo y de pensar, parpadeo y vista del cuarto.

| Rasgo | Antes (fase 5) | Después (fase 6) |
|---|---|---|
| Cabeza | esfera + 2 esferas de antifaz (parecían antiparras) + mejillas y hocico sueltos | una sola pieza: mejillas llenas, hocico, mentón, arco de cejas y cuencas; antifaz pintado |
| Bigote | dos medialunas desde las comisuras, finas, puntas como cuernos | puente bajo la nariz con la "w" encima; alas gruesas sobre la mejilla, dos capas y punta fina que sube (silueta de la imagen) |
| Ojos | sobresalían de perfil, algo chicos y juntos | más grandes y separados, metidos en la cuenca; pupila y nariz toon |
| Cejas / mechón | arcos finos / tres espigas altas | mechones gruesos altos adentro / cresta baja de tres puntas |
| Cuerpo | torso de 3 esferas, ancas como pelotas, dedos sueltos | torso en pera con panza pintada, muslos en pata de pollo, manos y pies con dedos marcados |
| Cola | subía hasta el bigote y terminaba en gancho | baja al costado y cierra una espiral limpia (20 huesos, pesos suaves) |

### Ajuste de mejillas

Las mejillas se veían grandes. Se midió la silueta de `Titi.png` alineada con
la captura de frente (nariz y pies) y se pasó a unidades de la cabeza:

| Altura (unidades de cabeza) | Imagen | Antes | Después |
|---|---|---|---|
| −0,06 (bajo las orejas) | 0,276 | 0,296 | **0,272** |
| −0,08 (altura de la "w") | 0,269 | 0,300 | **0,270** |
| −0,10 | 0,264 | 0,301 | **0,265** |

La mejilla también avanza menos de frente (z en (0,2; −0,1): 0,206 → 0,184).
El bigote se apoya solo en la nueva superficie. Comparación:
[fase6-mejillas.webp](fase6-mejillas.webp). Build y tests OK.

## Rendimiento (laboratorio, sin sombras, misma vista)

| Medida | Antes | Después |
|---|---|---|
| Llamadas de dibujo | 98 | **62** (menos piezas sueltas) |
| Triángulos | 98 k | 124 k (piezas esculpidas; resolución recortada donde no se ve) |
| Armado de las mallas al montar (Node, desktop) | ~70 ms | ~220 ms (la cabeza ~100 ms) |

En un celular el armado puede rondar 0,5–1 s una sola vez al montar la escena;
entra en la tarea pendiente 4.4.

## Pendiente

- Igual que antes: FPS con GPU real (4.3) y en un celular de gama media (4.4),
  ahora incluyendo el tiempo de armado de las mallas.

