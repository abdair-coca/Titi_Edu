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
