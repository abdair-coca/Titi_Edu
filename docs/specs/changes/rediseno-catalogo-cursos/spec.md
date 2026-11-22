# Spec — Rediseño del catálogo de cursos

Requisitos de `/courses` debajo del hero. El hero (`rediseno-hero-cursos`,
`cielo-hero-cursos`, `habitacion-3d-cursos`, `titi-3d-cursos`) no cambia; el
buscador del hero sigue siendo la búsqueda del catálogo.

---

## R1 — Orden de la página

1. Hero (sin cambios).
2. Filas curadas (R3). Se ocultan mientras hay búsqueda o filtros activos.
3. Catálogo completo con filtros (R4).
4. Rutas de aprendizaje (R7).
5. Bloque final adaptado (R8).

Sin testimonios, promo oscura, bloque de logros suelto, tira de cifras,
"Categorías populares" ni footer.

## R2 — Íconos

- Ningún emoji en la página. Cada categoría tiene un ícono SVG elegido por su
  nombre (sin acentos, minúsculas); categorías sin mapa usan un ícono genérico.
- Trazo uniforme, esquinas redondeadas, `currentColor`, mismo tamaño óptico.
- Microinteracción al hover/foco/tap del elemento que lo contiene (un trazo
  se dibuja, un detalle gira o rebota), ≤ 300 ms, apagada con movimiento
  reducido.
- Cada categoría tiene además un color de acento de la paleta `titi-*` para
  portadas sin imagen y para su pastilla activa.

## R3 — Filas curadas

| Fila | Quién la ve | Contenido | Orden |
|---|---|---|---|
| Continúa donde quedaste | con sesión e inscripciones sin terminar | tarjeta con barra de avance y botón "Seguir" que lleva a la siguiente lección | último avance primero |
| Tus amigos están aprendiendo | con sesión y recomendaciones | tarjeta con avatares apilados y "N amigos" | como devuelve la API |
| Para empezar desde cero | todos | cursos de nivel inicial | más inscritos primero |
| Nuevos | todos | publicados más recientes | fecha desc |
| Más populares | todos | más inscritos | inscritos desc |

- Una fila sin cursos no se muestra. Máximo 10 tarjetas por fila.
- Cada fila se desliza en horizontal (scroll con snap; flechas en desktop que
  aparecen solo si hay más para ver) y tiene "Ver todo", que aplica el filtro
  equivalente al catálogo y baja hasta él.
- Un curso puede repetirse entre filas, no dentro de la misma.

## R4 — Catálogo completo

- Título "Todos los cursos" con el contador de resultados.
- Barra de filtros pegajosa al scrollear (como hoy las tabs):
  - **Categoría:** pastillas con ícono SVG; "Todas" por defecto.
  - **Nivel:** inicial, intermedio, avanzado (selección múltiple).
  - **Largo:** corto (≤ 5 lecciones), medio (6–12), largo (> 12).
  - **Orden:** populares (por defecto), nuevos, A-Z.
  - **Con certificado:** interruptor.
- Filtros activos se ven como chips quitables, con "Limpiar todo".
- En celular, categoría queda como tira deslizable y el resto se abre en una
  hoja inferior "Filtros (N)".
- El estado de búsqueda y filtros vive en la URL (`?q=&cat=&nivel=&largo=&orden=&cert=`)
  para poder compartirlo y volver atrás.
- Tocar un objeto del cuarto 3D o una categoría sigue filtrando y baja al
  catálogo, como hoy.
- Estados: skeleton con la forma de la tarjeta nueva; vacío con Titi buscando
  y "Limpiar filtros"; error con "Reintentar".

## R5 — Tarjeta de curso

- Borde oscuro de 2 px, esquinas `rounded-2xl`, sombra dura inferior que se
  aplasta al presionar (firma de Titi).
- Portada: imagen del curso; sin imagen, fondo del color de la categoría con
  su ícono SVG grande.
- Contenido: categoría (ícono + nombre), título (2 líneas máx.), nivel como
  chip, lecciones, profe (inicial + usuario), inscritos y, si aplica, amigos
  inscritos y "Certificado".
- Microinteracciones (puntero fino): inclinación leve que sigue al mouse
  (≤ 4°), la portada se acerca, el ícono se anima. En táctil: solo el
  aplastado al tocar.
- Toda la tarjeta es un botón accesible (Enter/Espacio) que abre la vista
  rápida; un enlace secundario lleva directo a la página del curso.

## R6 — Vista rápida

- Desktop (≥ 768 px): panel desde la derecha (~440 px), el catálogo queda
  visible detrás con un velo plano oscuro (sin blur).
- Celular: hoja inferior que se cierra deslizándola hacia abajo.
- Muestra: portada, categoría, título, nivel, profe(s), descripción (3–4
  líneas con "ver más"), temario (módulos con sus lecciones, plegables),
  inscritos, amigos inscritos, si emite certificado.
- Acción principal:
  - Visitante → "Inicia sesión para inscribirte" (vuelve a la vista tras login).
  - Estudiante no inscrito → "Inscribirme" (actualiza la vista y la fila
    *Continúa* sin recargar).
  - Inscrito → "Seguir aprendiendo" a la siguiente lección.
  - Profesor/admin → "Ver curso".
- "Ver página del curso" siempre presente.
- Cierra con Esc, el velo, la X o el gesto. El foco queda atrapado mientras
  está abierta y vuelve a la tarjeta al cerrar. La URL guarda `?curso=<id>`.
- Carga sus datos al abrirse (skeleton propio; error con reintentar).

## R7 — Rutas de aprendizaje

- Las mismas 3 rutas curadas de hoy (resueltas contra el catálogo real).
- Cada ruta es un camino serpenteante: nodos circulares por curso unidos por
  un sendero en zigzag, estrella en la meta.
- Con sesión, los cursos completados pintan el sendero y Titi
  (`<TitiMascot>`) se para junto al siguiente paso. Sin sesión, Titi espera en
  el primer nodo.
- Tocar un nodo abre la vista rápida de ese curso.
- Celular: el camino ocupa todo el ancho y las rutas se eligen con pestañas.

## R8 — Bloque final

- **Visitante:** beneficios (3–4 con ícono SVG), cifras reales de la
  comunidad (cursos, profes, lecciones, categorías) con conteo animado al
  entrar en pantalla, y botón primario de registro.
- **Con sesión:** tu racha, tus gotas y el próximo logro que te falta, con un
  botón a tus logros.
- Nada inventado: si un dato no está, no se muestra.

## R9 — Titi reacciona

- Con búsqueda escrita: al haber resultados, Titi celebra brevemente junto al
  contador; sin resultados, Titi busca con lupa en el estado vacío.
- Una sola reacción por cambio de resultados (sin repetir mientras escribís).

## R10 — Movimiento y rendimiento

- Al cambiar filtros o búsqueda, las tarjetas se deslizan a su nuevo lugar
  (FLIP con GSAP); las que salen se desvanecen y las nuevas entran con
  saltito. Duración ≤ 300 ms, máximo ~12 tarjetas animadas (las visibles).
- Con `prefers-reduced-motion`: cambios instantáneos, sin inclinación ni
  animación de íconos.
- Sin `bg-gradient-*` ni `blur-*`. Solo colores `titi-*` y `gray-*`.
- 390 px sin scroll horizontal de página.

## R11 — API (solo lectura)

- `GET /api/courses`: cada curso suma `_count.lecciones` (lecciones
  publicadas en módulos publicados).
- `GET /api/courses/my/enrolled`: cada inscripción suma `avance` (0–100),
  `leccionesCompletadas`, `leccionesTotales` y `siguienteLeccionId` (null si
  terminó), calculado sin una consulta por curso.
- Respuestas con `{ success, data }`; campos existentes sin cambios.
- Tests de backend para ambos.
