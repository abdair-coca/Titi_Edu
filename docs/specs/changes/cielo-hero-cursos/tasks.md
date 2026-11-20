# Tasks — Cielo 3D en el header de cursos

> **Change:** `cielo-hero-cursos`
> **Estado:** implementado; falta la medición en un celular real (4.3).
> Comandos de verificación: `cd frontend && npm run build` y los scripts `npm run test:*`.

## Fase 1 — Piezas compartidas con la habitación

- [x] 1.1 `hero3d/support.js`: `canShow3D`, `useIsMobile`, `useMediaQuery`, `useIdleLoad`, `useInViewActive` y `SceneBoundary` (sin three); `Hero3D` los usa sin cambiar su comportamiento.
- [x] 1.2 `hero3d/sceneKit.jsx`: `SoftEnvironment`, `ContextLossGuard` y `useWarmup` salen de `HeroScene`.
- [x] 1.3 `hero3d/dropGeometry.js`: forma de la gota compartida con `RoomToys`.

## Fase 2 — Cielo

- [x] 2.1 `heroSky/skyLayout.js`: mide el texto (`data-sky`) y arma carriles, zona del dron chico, aterrizaje sobre el buscador y piso.
- [x] 2.2 `heroSky/HeroSky.jsx`: decide 3D, carga diferida de `SkyScene`, pausa, lienzo detrás del texto (`-z-10` + `isolate`), máscara del borde derecho en desktop, presencia del mouse.
- [x] 2.3 `heroSky/SkyScene.jsx`: Canvas con `eventSource` en el contenedor y puntero calculado respecto del lienzo, misma luz que el cuarto, elenco por pantalla, monitor que apaga el cielo a la primera caída.
- [x] 2.4 `heroSky/skyKit.js`: px → mundo, damping, `useTouchable` (cursor + click que ignora la UI).
- [x] 2.5 `Drone.jsx` (repartidor y dron chico), `PaperPlane.jsx`, `SkyDrops.jsx` (gotas que suben, que caen y salpicadura), `Clouds.jsx`.
- [x] 2.6 `Courses.jsx`: contenedor de barra amarilla + hero con `HeroSky` y atributos `data-sky`.

## Fase 3 — Interacción

- [x] 3.1 Esquivar (repartidor) y mirar (dron chico) solo con puntero fino.
- [x] 3.2 Rizo hacia abajo del repartidor y voltereta del dron chico, con gota que cae y rebota sobre el buscador.
- [x] 3.3 Tirabuzón del avión, salpicadura de las gotas y aplastón de las nubes.
- [x] 3.4 Un toque sobre buscador/botones/links nunca llega al 3D.

## Fase 4 — Rendimiento y respaldo

- [x] 4.1 Chunk diferido propio; three compartido con la habitación.
- [x] 4.2 Reduced-motion / sin WebGL / ahorro de datos: sin lienzo ni descarga.
- [ ] 4.3 Medir FPS en un celular de gama media real con cielo + cuarto.

## Fase 5 — Docs y verificación

- [x] 5.1 `design.md` §10 "3D", §12 y §14; `motion.md` §4 y excepciones; `AGENTS.md`.
- [x] 5.2 `check-hero-3d-split.mjs`: también vigila el cielo y las piezas compartidas.
- [x] 5.3 `npm run build` limpio y todos los `npm run test:*` en verde.
- [x] 5.4 Verificación visual con capturas (desktop, mobile, click, tap, reduced-motion).
- [x] 5.5 `verify-report.md`.
