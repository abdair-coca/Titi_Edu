# Tasks — Titi 3D en el cuarto de cursos

> **Change:** `titi-3d-cursos`
> **Estado:** implementado y pulido (fase 5); faltan 4.3 (FPS con GPU real) y 4.4.
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

## Fase 5 — Pulido visual (estilo toon y animación)

- [x] 5.1 Laboratorio visual: `titi-lab.html` (solo dev) + `scripts/titi-shots.mjs` (`npm run shots:titi`), capturas reproducibles desde frente, 3/4, costado, espalda, cara y poses.
- [x] 5.2 `titiRig.js`: aplicar la pose sale de `Titi.jsx` (lo comparten el cuarto y el laboratorio).
- [x] 5.3 `titiMaterials.js`: toon con factor de luz, tono de sombra por material, brillo, rim, sombras sin granulado y contorno en píxeles (con soporte de esqueleto).
- [x] 5.4 Cara medida sobre `Titi.png`: ojos "cuadraditos" con blanco visible, nariz en trapecio con dos brillos, "w" sobre el bigote, bigote desde las comisuras, cejas en mechones, chivita en punta, mejillas.
- [x] 5.5 Silueta: cola continua con esqueleto (antes 14 cápsulas quebradas) que cierra la espiral, mechón en llamitas, brazos y piernas que se afinan.
- [x] 5.6 Animación: `titiFace.js` (parpadeo con ease, sacadas, olfateo, orejas), canales `brow`/`browTilt`/`stache` en las poses, cabeza que deriva, respiración en cabeza y hombros, onda e inercia de la cola.
- [x] 5.7 Test de la cara en `check-titi-brain.mjs`; build, `test:titi-3d` y `test:hero-3d` OK.
- [x] 5.8 QA en el cuarto real (API simulada, reloj virtual): click, arrastre, caída, cursor, consola y llamadas de dibujo. Ver [verify-report.md](verify-report.md).
