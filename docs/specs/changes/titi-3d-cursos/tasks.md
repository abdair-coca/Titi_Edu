# Tasks — Titi 3D en el cuarto de cursos

> **Change:** `titi-3d-cursos`
> **Estado:** implementado, pulido (fase 5) y con dirección de arte refinada (fase 6); faltan 4.3 (FPS con GPU real) y 4.4.
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

## Fase 6 — Dirección de arte (mismo personaje, acabado de mascota de juego)

- [x] 6.1 `titiSculpt.js`: piezas "esculpidas" con formas suaves fundidas (campos de distancia) pasadas a una malla, con normales del campo y color por vértice.
- [x] 6.2 Cabeza en una sola pieza: cráneo, mejillas llenas, hocico, mentón, arco de cejas suave, cuencas poco profundas y base de las orejas; antifaz pintado (sin las esferas que parecían antiparras).
- [x] 6.3 Bigote medido de nuevo sobre `Titi.png`: puente blanco bajo la nariz con la "w" encima, alas que bajan sobre la mejilla, más allá de las orejas, y terminan en una punta fina que sube; segunda capa debajo (los dos tonos de la imagen).
- [x] 6.4 Ojos más grandes y algo más separados, metidos en la cuenca; nariz y pupilas toon (sin reflejo de plástico).
- [x] 6.5 Cejas como mechones gruesos (altas adentro, bajan hacia afuera) pegadas al cráneo; mechón de la coronilla como cresta baja de tres puntas.
- [x] 6.6 Cuerpo: torso en forma de pera con la panza pintada, muslos en forma de pata de pollo, manos y pies en una pieza con dedos marcados; orejas ahuecadas.
- [x] 6.7 Cola: 20 huesos cortos con pesos suaves (B-spline) y curvatura que crece de a poco; espiral limpia que se cierra hacia adentro; normales exactas en la punta.
- [x] 6.8 Costo: mallas armadas en ~0,2 s (desktop), 62 llamadas de dibujo (antes 98) y 124 k triángulos (antes 98 k) en el laboratorio. Build y tests OK; capturas en [verify-report.md](verify-report.md).
- [x] 6.9 Mejillas a la medida de `Titi.png` (silueta alineada por nariz y pies): media anchura de la cara bajo las orejas 0,272 / 0,270 / 0,265 contra 0,276 / 0,269 / 0,264 de la imagen (antes 0,296 / 0,300 / 0,301); también avanzan menos de frente. Ver [fase6-mejillas.webp](fase6-mejillas.webp).
