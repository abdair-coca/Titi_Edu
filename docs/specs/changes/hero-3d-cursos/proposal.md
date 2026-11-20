# Proposal — Hero 3D en el catálogo de cursos

> **Estado:** implementado, pendiente de medir en un celular real. Primera fase de "3D en /courses".

## Intención

El hero de `/courses` es lo primero que ve un invitado y hoy es una ilustración
estática (`/hero/community.webp`). Lo reemplazamos por una escena 3D interactiva
hecha con modelos low-poly gratuitos: objetos que representan las categorías
flotan alrededor de Titi y, al tocar uno, el catálogo baja a "Cursos en
tendencia" filtrado por esa categoría. La idea es que el catálogo transmita "acá
se aprende jugando" sin perder la estética plana de Titi ni la velocidad de
carga.

## Alcance

### Dentro

- Escena 3D en la columna derecha del hero de `Courses.jsx` (el texto, el
  buscador y los stats no cambian).
- Modelos 3D **gratuitos ya hechos** (CC0 preferido; CC-BY con crédito), uno por
  categoría destacada, recoloreados a la paleta Titi con material toon plano.
- Titi presente con `<TitiMascot>` (regla de oro), superpuesto a la escena.
- Interacción: flotación ambiental, inclinación leve hacia el puntero (solo
  mouse), hover/tap con pop y tap en un objeto = filtrar por su categoría.
- 3D **liviano también en mobile** (menos objetos, menor resolución) y respaldo a
  imagen estática cuando el 3D no conviene.
- Dependencias nuevas: `three`, `@react-three/fiber@8`, `@react-three/drei@9`
  (v8/v9 porque el proyecto está en React 18), cargadas solo en un chunk diferido.
- Sección "3D" en `frontend/design.md` y `frontend/motion.md`.

### Fuera (fases siguientes)

- Áreas destacadas, medallas de logros y rutas de aprendizaje en 3D.
- Modelo 3D propio de Titi y objetos creados a medida.
- `CourseCard` del grid en 3D (son muchas y ya tienen portada).
- Scroll cinematográfico, parallax o cámara libre (prohibido por `motion.md`).

## Decisiones tomadas

1. Solo el hero en esta fase.
2. React Three Fiber + drei.
3. 3D liviano también en mobile.
4. Modelos 3D gratuitos ya existentes primero; objetos propios después.
5. Titi en el centro con `<TitiMascot>` superpuesto, solo si se ve bien en el
   hero (se probó y se ve bien).
6. Imagen de respaldo: captura de la propia escena (`/hero/hero-3d-poster.webp`,
   27 KB) en lugar de `community.webp` (125 KB).

## Riesgos

- **Peso:** three + R3F + drei pesan unos 200 KB gzip, más los modelos. Se
  mitiga con un chunk diferido, compresión de modelos y presupuestos fijos (spec H6).
- **Equipos de gama baja / datos móviles:** respaldo automático a imagen (spec H5).
- **Licencias:** solo CC0 o CC-BY, registradas en `public/models/CREDITS.md`.
- **Estética:** modelos de terceros con estilos distintos; se unifican
  reemplazando sus materiales por toon plano de la paleta.

## Criterios de éxito

- [ ] El hero muestra la escena 3D en desktop y mobile, con respaldo cuando corresponde.
- [ ] Tocar un objeto filtra el catálogo por su categoría y baja a Tendencias.
- [ ] El chunk de `Courses` no incluye three (code split verificado por script).
- [ ] Presupuestos de peso y FPS de la spec H6 cumplidos.
- [ ] `prefers-reduced-motion` muestra la imagen estática, sin canvas.
- [ ] `npm run build` limpio y checklist de `design.md` §12 / `motion.md` §6 en verde.
