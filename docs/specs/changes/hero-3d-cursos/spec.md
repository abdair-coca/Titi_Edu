# Spec — Hero 3D en el catálogo de cursos

Requisitos de lo que debe cumplir el hero 3D de `/courses`. Describen el qué; el
cómo queda en `tasks.md`.

---

## H1 — Ubicación y convivencia con el hero actual

- La escena ocupa la columna visual del hero (hoy `community.webp`); el bloque
  de texto, buscador y stats queda igual.
- El hero mantiene su alto actual: la escena no empuja el contenido al cargar
  (caja con relación de aspecto fija reservada desde el primer render).
- El resto de la página (`Courses.jsx`) no cambia de comportamiento.

## H2 — Objetos de la escena

- Un objeto 3D por categoría, tomado de un modelo gratuito ya hecho. Propuesta
  inicial (se ajusta según lo que haya disponible):

  | Categoría | Objeto |
  |---|---|
  | Programación | laptop |
  | Idiomas | globo terráqueo |
  | Matemáticas | calculadora o dados |
  | Diseño | paleta o lápiz |
  | Ciencias | matraz |
  | Negocios | maletín o gráfico de barras |
  | Humanidades | libro abierto |
  | Música | guitarra o nota musical |

- Desktop muestra hasta 8 objetos; mobile, los 4 de categorías con más cursos.
- Aparecen las categorías que existen en la API y tienen modelo, primero las de
  más cursos (igual que las pills, que también muestran categorías vacías;
  tocar una vacía muestra el estado vacío del catálogo). Si no hay ninguna, se
  muestra la imagen de respaldo.
  *(Ajustado al implementar: la versión anterior pedía "al menos un curso", pero
  producción tiene un solo curso publicado y la escena quedaba con un objeto.)*
- Todos los objetos usan material toon plano (rampa de 3 tonos) con los colores
  del propio modelo; se descarta el resto del material. Sin gradientes, blur,
  reflejos ni postprocesado.
- Titi aparece en el centro con `<TitiMascot>` superpuesto a la escena, nunca
  como modelo 3D ni emoji (se probó y se ve bien).

## H3 — Interacción

- **Ambiente:** los objetos flotan suavemente en loop (equivalente al
  `titi-float` del login).
- **Puntero (solo mouse):** la escena se inclina levemente hacia el cursor
  (máximo ±6°, como Titi en el login). En touch no hay seguimiento.
- **Hover / tap:** el objeto crece y se eleva con rebote leve (≤ 400 ms) y
  muestra el nombre de la categoría; el cursor cambia a puntero.
- **Click / tap en un objeto:** aplica el filtro de esa categoría y baja a
  "Cursos en tendencia", igual que las pills de categoría.
- No hay drag para rotar, zoom con rueda ni nada que capture el scroll de la
  página (en mobile el gesto vertical siempre scrollea).

## H4 — Entrada (motion)

- Mientras carga se ve la imagen de respaldo; al estar lista la escena, cambia
  con un fade ≤ 300 ms sin salto de layout.
- Los objetos entran con pop escalonado (≤ 400 ms cada uno, ≤ 3 simultáneos),
  usando los tokens de `MOTION`.

## H5 — Respaldo a imagen estática

Se muestra la imagen estática (sin descargar el chunk 3D) cuando:

- `prefers-reduced-motion: reduce` está activo;
- el navegador no soporta WebGL;
- el usuario tiene activado el ahorro de datos (`navigator.connection.saveData`).

Se cambia a la imagen estática si la escena ya cargó y:

- se pierde el contexto WebGL;
- el rendimiento cae de forma sostenida por debajo del mínimo (H6) incluso tras
  bajar la calidad;
- ocurre un error al cargar un modelo (la escena nunca rompe la página).

La imagen de respaldo tiene `alt` descriptivo y es la candidata a LCP.

## H6 — Rendimiento y peso

- three, R3F y drei viven en un chunk aparte que se descarga solo cuando el
  hero va a mostrar 3D. El chunk de `Courses` no los incluye. El chunk pesa
  ~249 KB gzip (la estimación inicial era ~200): casi todo es el núcleo de
  three, que no admite tree-shaking.
- Modelos comprimidos: ≤ 400 KB en total en desktop y ≤ 200 KB en mobile.
- Resolución: DPR máximo 1.5 en desktop y 1 en mobile.
- El render se pausa cuando el hero sale de pantalla o la pestaña no está visible.
- Objetivo: ≥ 50 FPS en un laptop promedio y ≥ 30 FPS en un celular de gama
  media; si cae, se reduce la calidad antes de pasar al respaldo.
- El LCP del hero no empeora respecto a la versión con `community.webp`.

## H7 — Accesibilidad

- El canvas es decorativo (`aria-hidden`); el filtro por categoría sigue
  disponible por teclado con las pills existentes.
- La escena no atrapa el foco ni el scroll.

## H8 — Licencias y créditos

- Solo modelos CC0 o CC-BY. Cada modelo queda registrado en
  `frontend/public/models/CREDITS.md` (nombre, autor, fuente, licencia).

## Casos borde

- **API de categorías caída o vacía:** imagen de respaldo, sin error visible.
- **Invitado:** ve la misma escena; el tap filtra igual (el catálogo es público).
- **Categoría sin objeto asignado:** no aparece en la escena.
- **Resize u orientación del celular:** la escena se reacomoda sin recargar modelos.
- **Navegar fuera de `/courses`:** el canvas se desmonta y libera memoria GPU.
