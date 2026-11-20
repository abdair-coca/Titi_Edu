# Tasks — Rediseño del header y hero de cursos

> **Change:** `rediseno-hero-cursos`
> **Estado:** implementado; falta medir FPS en un celular real (4.3).
> Verificación: `cd frontend && npm run build` y los scripts `npm run test:*`.

## Fase 1 — Hero minimalista

- [x] 1.1 `Courses.jsx`: fuera barra de promo, chip y cifras (`HeroStat`, `useCountUp`); párrafo de una línea.
- [x] 1.2 El hero llena la primera pantalla en desktop (`useHeroFillsScreen` → `--hero-top`), contenido centrado.
- [x] 1.3 Buscador con borde oscuro y sombra dura (design v2); avisa foco por el puente.

## Fase 2 — Título letra a letra

- [x] 2.1 `lib/heroBridge.js`: pub/sub sin three entre título, cielo y cuarto.
- [x] 2.2 `heroTitle/letterSprings.js`: resortes por letra (mover, girar, estirar) con un solo rAF.
- [x] 2.3 `heroTitle/HeroTitle.jsx`: tres renglones, Nunito 900 fluido (`cqi` + `svh`), entrada escalonada, hover/tap, texto para lectores, palabra destacada que se achica si no entra.
- [x] 2.4 Puente con el cuarto: `HeroObject` → `onHover` → `roomHover` cambia "hoy" por la categoría.

## Fase 3 — Cielo ↔ letras

- [x] 3.1 `skyLayout.js`: mide la tinta de cada letra (métricas de la fuente), franja de globos, zona del dron chico junto al título.
- [x] 3.2 `skyLetters.js`: viento, superficie bajo una gota, letra al azar, cambio de capa sin tocar texto.
- [x] 3.3 Gotas: rebotan sobre la letra de abajo (la aplastan) y pueden resbalar al renglón siguiente; sin gotas que suben.
- [x] 3.4 Avión: paseo con rizo o choque contra una letra al azar (tambaleo + retroceso + tirabuzón).
- [x] 3.5 Drones: viento, gota espontánea sobre una letra al azar, visita a la letra tocada, miran el buscador con foco.
- [x] 3.6 `Balloons.jsx` reemplaza a `Clouds.jsx`: globos que se apartan del mouse y revientan soltando gotas.
- [x] 3.7 Lienzo medio (desktop): avión y globos pasan por detrás o por delante del texto; el cambio de capa espera a que no toquen letras.

## Fase 4 — Verificación

- [x] 4.1 `npm run build` y todos los `npm run test:*` (incluye `test:hero-3d` con los archivos nuevos).
- [x] 4.2 Prueba visual en Chrome (desktop y 390 px en iframe).
- [ ] 4.3 Medir FPS en un celular real.
