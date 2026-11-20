# Tasks — Habitación 3D en el hero de cursos

> **Change:** `habitacion-3d-cursos`
> **Estado:** implementado; falta la medición en un celular real (4.4).
> Comandos de verificación: `cd frontend && npm run build` y los scripts `npm run test:*`.

## Fase 1 — Habitación

- [x] 1.1 `roomLayout.js`: medidas, paleta y lugar de cada categoría (`CATEGORY_SLOTS`).
- [x] 1.2 `roomTextures.js`: texturas en canvas (piso de tablas, oclusión de paredes, manchas de contacto, "Titi" pintado, pintura, pelota).
- [x] 1.3 `RoomShell.jsx`: piso y paredes con espesor, ventana, repisas, escritorio, alfombra, atril, banquito, guirnalda y libros.
- [x] 1.4 Luz: hemisférica, luz principal con sombras, relleno desde la ventana y entorno generado con paneles emisivos (sin HDR externo); `NeutralToneMapping`.
- [x] 1.5 Cámara ortográfica isométrica que encuadra el cuarto según el tamaño del lienzo.

## Fase 2 — Categorías dentro del cuarto

- [x] 2.1 `HeroObject`: material estándar mate, sombras, apoyo por la base, normales si el modelo no trae.
- [x] 2.2 Hover (sube, crece, pill con el nombre) y click que filtra; área de toque del tamaño del modelo.
- [x] 2.3 Saludo de entrada escalonado y saltito periódico como pista.
- [x] 2.4 Las 8 categorías también en mobile (`heroModels.js` sin `rotation` ni tope por ancho).

## Fase 3 — Interacción

- [x] 3.1 `RoomRig.jsx`: arrastre ±35° con vuelta al frente, paralaje con el mouse, cursor, arrastre ≠ click.
- [x] 3.2 `touch-action: pan-y`: el gesto vertical scrollea la página.
- [x] 3.3 `RoomToys.jsx`: 7 sorpresas (lámpara, planta, reloj, gota, pelota, silla, puf).
- [x] 3.4 Chip "Arrastrá para girar" en `Hero3D` que se va con el primer arrastre; se quita el `<TitiMascot>` y el disco/anillo del fondo.

## Fase 4 — Rendimiento y respaldo

- [x] 4.1 Sombras redibujadas solo cuando algo se mueve.
- [x] 4.2 Escalera de calidad: alta (desktop) → baja → imagen; monitor sin tope superior de FPS.
- [x] 4.3 Poster nuevo desde la escena final (sin la pista ni paralaje) y `alt` actualizado en `Courses.jsx`.
- [ ] 4.4 Medir FPS en un celular de gama media real (headless con GPU de laptop: ver verify-report).

## Fase 5 — Docs y verificación

- [x] 5.1 `design.md` §10 "3D", §12 y §14; `motion.md` §4 y excepciones; `CREDITS.md`; `AGENTS.md`.
- [x] 5.2 `check-hero-3d-split.mjs`: el chunk principal tampoco importa piezas de la habitación.
- [x] 5.3 `npm run build` limpio y todos los `npm run test:*` en verde.
- [x] 5.4 Verificación visual con capturas (desktop, mobile, hover, giro, sorpresas) y LCP en Fast 3G.
- [x] 5.5 `verify-report.md`.
