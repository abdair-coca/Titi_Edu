# Tasks — Hero 3D en el catálogo de cursos

> **Change:** `hero-3d-cursos`
> **Estado:** implementado; falta la medición en un celular real (5.3).
> Comandos de verificación: `cd frontend && npm run build` y los scripts `npm run test:*`.

## Fase 0 — Assets (sin código de la app)

- [x] 0.1 Elegir un modelo gratuito por categoría (Poly Pizza: Kenney, CreativeTrio, smallbigsquare, Poly by Google, J-Toastie, jeremy), solo CC0 o CC-BY.
- [x] 0.2 Comprimir cada modelo (`gltf-transform optimize`, meshopt, texturas WebP 128 px): 300 KB → 87 KB los 8.
- [x] 0.3 Guardarlos en `frontend/public/models/hero/` y registrar `frontend/public/models/CREDITS.md`.

## Fase 1 — Base 3D

- [x] 1.1 Instalar `three@0.172.0`, `@react-three/fiber@8.18.0` y `@react-three/drei@9.122.0` (versión exacta).
- [x] 1.2 `HeroScene` en `frontend/src/components/hero3d/` con cámara fija y luz plana.
- [x] 1.3 `HeroObject`: carga con `useGLTF` (meshopt), materiales toon con los colores del modelo, tamaño normalizado y flotación ambiental.
- [x] 1.4 Script `scripts/check-hero-3d-split.mjs` (`npm run test:hero-3d`).

## Fase 2 — Integración en el hero

- [x] 2.1 `Hero3D` en `Courses.jsx`: imagen de respaldo en el flujo (reserva el alto) y `lazy()` de `HeroScene` al quedar libre el navegador tras la carga.
- [x] 2.2 Respaldo (H5): reduced-motion, sin WebGL y ahorro de datos → imagen sin descargar el chunk.
- [x] 2.3 `<TitiMascot>` superpuesto en el centro (se ve bien, queda).
- [x] 2.4 Fade imagen → escena (300 ms) sin salto de layout.

## Fase 3 — Interacción

- [x] 3.1 Hover/tap con pop y etiqueta de categoría (`Html` de drei).
- [x] 3.2 Click/tap → `setCategoria` + `goToTrending`.
- [x] 3.3 Inclinación hacia el puntero solo con mouse (±6°).

## Fase 4 — Mobile y rendimiento

- [x] 4.1 Perfil mobile: 4 objetos, DPR 1, sin antialias.
- [x] 4.2 Render en pausa (`frameloop="demand"`) fuera de pantalla y con la pestaña oculta.
- [x] 4.3 `PerformanceMonitor` tras 3 s de calentamiento: baja la resolución y, a la tercera caída, vuelve a la imagen; pérdida de contexto y errores de carga → imagen.
- [x] 4.4 `/hero/hero-3d-poster.webp` (captura de la escena a 2x, 27 KB) como respaldo y LCP.

## Fase 5 — Docs y verificación

- [x] 5.1 Sección "3D" en `frontend/design.md` (§10, inventario §14, checklist §12) y `frontend/motion.md` (catálogo §4 y excepciones).
- [x] 5.2 `npm run build` limpio; `Courses` sin three (10,4 KB gzip), `HeroScene` aparte (249 KB gzip).
- [ ] 5.3 Medición manual de FPS en un celular de gama media real (en headless se midió el resto: ver verify-report).
- [x] 5.4 Checklists `design.md` §12 y `motion.md` §6.
- [x] 5.5 `verify-report.md`.
