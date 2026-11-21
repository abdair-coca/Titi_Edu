# Tasks — Titi 3D en el cuarto de cursos

> **Change:** `titi-3d-cursos`
> **Estado:** implementado; faltan 4.3 y 4.4.
> Verificación: `cd frontend && npm run build`, `npm run test:titi-3d` y `npm run test:hero-3d`.

## Fase 1 — Modelo

- [x] 1.1 `titiLook.js`: colores muestreados de `Titi.png`, huesos y escala.
- [x] 1.2 `titiGeometry.js`: tubo con radio variable (bigote, chivita).
- [x] 1.3 `TitiBody.jsx`: cuerpo articulado (cabeza, cara, brazos, piernas, cola en cadena) que expone sus articulaciones.
- [x] 1.4 Comparación con las fotos desde frente, iso, costado y espalda; ajustes de ojos, bigote, cejas, chivita y cola.

## Fase 2 — Comportamiento

- [x] 2.1 `titiPoses.js`: poses sentado, de pie, caminar, saludar, pensar, celebrar, cargado, cayendo, aterrizaje y mareo.
- [x] 2.2 `titiBrain.js`: estados, paseo dentro de la zona libre, cargar/soltar/tocar.
- [x] 2.3 `Titi.jsx`: amortiguación de poses, mirada al mouse/cámara, parpadeo, respiración, cola, mancha de contacto.

## Fase 3 — Integración con el cuarto

- [x] 3.1 `RoomRig`: `grab`/`release` (el cuarto no gira mientras se carga a Titi) y `poke` (redibujar sombras).
- [x] 3.2 `HeroScene` monta a Titi; `CAMERA_DIR` pasa a `roomLayout.js` para compartirla.
- [x] 3.3 Mobile sin sombra real de Titi.

## Fase 4 — Verificación y docs

- [x] 4.1 `scripts/check-titi-brain.mjs` (`npm run test:titi-3d`) y `check-hero-3d-split.mjs` con las piezas de Titi.
- [x] 4.2 `npm run build` limpio.
- [ ] 4.3 Arrastre con mouse real a velocidad normal y FPS del cuarto con Titi en desktop.
- [ ] 4.4 FPS en un celular de gama media real.
- [x] 4.5 `AGENTS.md` (índice de changes).
