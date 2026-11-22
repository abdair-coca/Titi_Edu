# Proposal — Rediseño del catálogo de cursos

> **Change:** `rediseno-catalogo-cursos`
> **Estado:** propuesto (2026-11-22), decisiones tomadas con el usuario por quiz.

## Intención

Todo lo que está debajo del hero de `/courses` se rehace para un solo trabajo:
**descubrir y elegir un curso rápido**. Hoy la página mezcla el catálogo con
bloques de marketing (promo oscura, testimonios inventados, logros, cifras,
footer sin enlaces) y el usuario tiene que scrollear mucho para decidir.

La meta es que sea impresionante y bonita sin dejar de ser útil: tarjetas
juguetonas tipo Duolingo, íconos SVG con microinteracciones, vista rápida sin
salir del catálogo, reordenamiento animado al filtrar y Titi acompañando.

## Alcance

**Entra**

- Filas curadas arriba: *Continúa donde quedaste* (con sesión), *Tus amigos
  están aprendiendo*, *Para empezar desde cero*, *Nuevos* y *Más populares*.
- Catálogo completo en cuadrícula con filtros: categoría, nivel, largo del
  curso (por lecciones), orden (populares, nuevos, A-Z) y "con certificado".
- Tarjeta de curso nueva (borde oscuro, sombra dura, portada con color e ícono
  de la categoría, microinteracciones).
- Vista rápida: panel lateral en desktop, hoja inferior en celular.
- Rutas de aprendizaje como camino serpenteante con Titi en tu siguiente paso.
- Un bloque final adaptado: visitante → beneficios + cifras reales + registro;
  con sesión → racha, gotas y próximo logro.
- Íconos SVG por categoría (mapa en el frontend) en lugar de emojis.
- Backend, solo lecturas: conteo de lecciones en la lista de cursos; avance y
  siguiente lección en `/api/courses/my/enrolled`.
- `frontend/design.md` sin emojis.

**No entra**

- El hero: título, buscador, cuarto 3D, cielo y todo three.js quedan tal cual.
- Migraciones o cambios en el modelo de datos (el campo `Categoria.icono` se
  ignora, no se borra).
- Otras páginas que usan `RecommendedCourseCard` o `CategoriesExplorer`
  (Feed, Explore, MyCourses) no cambian; si un componente se comparte, la
  versión nueva vive aparte.

**Se quita**

- Testimonios de ejemplo, promo "Reimaginá", bloque de logros, tira de cifras
  (se fusionan en el bloque final), "Categorías populares" y el footer.

## Criterios de éxito

- Un visitante encuentra y abre la vista rápida de un curso en ≤ 2 interacciones
  desde que termina el hero.
- Ningún emoji en `/courses` ni en `design.md`.
- Filtrar o buscar reordena con animación y nunca deja la página sin respuesta
  (siempre hay resultados, vacío con Titi, o error con reintentar).
- `npm run build`, tests del backend y del frontend en verde; Lighthouse de
  accesibilidad sin regresión.
- Funciona en 390 px sin scroll horizontal y respeta `prefers-reduced-motion`.

## Riesgos

- **Muchos archivos**: `Courses.jsx` (1265 líneas) se divide en componentes
  bajo `components/catalog/`.
- **Rendimiento**: animaciones FLIP con muchas tarjetas; se limita a las
  visibles y se desactiva con movimiento reducido.
- **Backend**: el avance por curso debe calcularse en una sola consulta, sin
  N+1.
