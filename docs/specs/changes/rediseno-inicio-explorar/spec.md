# Spec — Rediseño de Inicio y Explorar

Requisitos de `/feed` (Inicio) y `/explore` (Explorar) con el lenguaje visual
v3 de `/courses` (`frontend/design.md` §5.3, §5.5, §15).

---

## R1 — Lenguaje visual común

- Tarjetas que navegan o abren algo enteras (curso, persona): **tile v3** —
  borde oscuro de 2 px, `rounded-2xl`, sombra dura oscura que sube al hover y
  se aplasta al presionar.
- Superficies que solo muestran (post, actividad, paneles del rail):
  **superficie v3** — borde oscuro de 2 px, `rounded-2xl`, sombra difusa,
  sin levantar ni hundirse. Lo que se toca adentro es lo que reacciona.
- Títulos de sección con una palabra de acento en `text-titi-streak`
  ("Gente para **seguir**").
- Pastillas (pestañas, hashtags, filtros) iguales a las del catálogo:
  blancas con borde gris; activas en amarillo con borde y sombra oscuros.
- Íconos SVG de `icons.jsx`; categorías con `categoryTheme` y su
  microinteracción. Ningún emoji en la interfaz (sí en contenido de usuarios).
- Sin `bg-gradient-*` ni `blur-*`. Respeta `prefers-reduced-motion`.

## R2 — Inicio: orden de la página

1. Saludo "Hola, **@usuario**" + subtítulo + botón refrescar (ícono que gira).
2. Composer v3.
3. Fila *Continúa donde quedaste* (si hay inscripciones sin terminar), la misma
   tarjeta del catálogo, con "Seguir" directo a la siguiente lección.
4. Pestañas *Todo / Publicaciones / Aprendizaje* con contador.
5. Línea de tiempo (posts + actividad académica mezclados por fecha).
6. En pantallas sin rail (< lg), una fila *Gente para seguir* dentro de la
   línea de tiempo, después de la cuarta entrada.

Rail (lg+, pegajoso): *Tu día* (racha y gotas con conteo animado, link a Mis
cursos), *Gente para seguir* (lista de 4), *Categorías*.

## R3 — Composer v3

- Plegado: avatar + campo "¿Qué estás aprendiendo hoy?" con la forma del
  buscador del catálogo. Al enfocarlo o escribir se despliega.
- Desplegado: texto (máx. 500, contador), imagen con vista previa y quitar,
  sonido y ubicación como selectores con ícono SVG (sin emojis), botón
  primario "Publicar".
- Errores en el lugar; éxito con mensaje breve y el post aparece arriba.
- Esc o "Cancelar" con el campo vacío lo pliega.

## R4 — Post v3 (`PostCard`)

- Superficie v3. Cabecera: avatar con borde oscuro, `@usuario`, hace cuánto,
  menú de opciones (sin cambios).
- Imagen a sangre entre bordes oscuros; **doble toque/clic en la imagen da
  like** con un corazón que hace pop (sin repetir si ya tenía like).
- Sonido y ubicación como chips con círculo sólido del rol.
- Hashtags como pastillas que llevan a `/hashtag/:tag`.
- Acciones como botones pastilla con press: like (rojo sólido cuando está
  activo, el corazón late), comentarios (azul cuando están abiertos), guardar
  (amarillo cuando está guardado). Like y guardar siguen optimistas con
  rollback.

## R5 — Actividad académica v3

- Superficie v3. Cabecera con avatar, "@amigo se inscribió en / completó /
  desbloqueó el logro", hace cuánto y un cuadro sólido del rol girado con su
  ícono (azul, verde, púrpura).
- Curso: mini tile v3 con portada de la categoría (`CourseCover`), categoría
  con su color, título y botón "Ver curso". Tocarlo abre la **vista rápida**
  (`?curso=`) sin salir de Inicio; desde ahí uno se inscribe.
- Logro: insignia en tinte púrpura con el nombre del logro.
- Curso borrado: texto "Este curso ya no está disponible".

## R6 — Gente para seguir

- `GET /api/users/suggestions?limit=N` (N ≤ 20, por defecto 10): personas que
  no sigo ni soy yo. Primero amigos de amigos ordenados por cuántos amigos en
  común; si faltan, las más seguidas. Cada una trae `mutualCount`,
  `mutualSample` (hasta 3 usuarios) y `followerCount`.
- Tarjeta de persona (tile v3): avatar grande, `@usuario`, bio en 2 líneas,
  "Seguido por @a y N más" o "N seguidores", botón **Seguir** (amarillo) que
  pasa a **Siguiendo** (blanco con check) al instante; si falla, vuelve atrás
  y avisa. Toda la tarjeta lleva al perfil.
- Variante compacta en lista para el rail.
- Sin sugerencias: la sección no se muestra.
- Seguir desde Inicio recarga la línea de tiempo al cerrar la sesión de
  sugerencias (no en cada toque) para no hacer saltar la página.

## R7 — Explorar: orden de la página

1. Cabecera: "Descubrí tu **comunidad**", subtítulo y buscador con la forma del
   del catálogo (borde y sombra oscuros, limpiar con X). En < lg, debajo,
   tendencias como pastillas deslizables.
2. Sin búsqueda:
   - Fila *Gente para seguir* (tarjetas de persona).
   - Fila *Lo que está aprendiendo la comunidad*: cursos con más inscritos,
     tarjeta de curso v3, abre la vista rápida. Solo si hay cursos.
   - *Publicaciones recientes* (scroll infinito) + rail (lg+): *Tendencias*
     en ranking (#1…#5 con cantidad de posts), *Categorías*, acceso al
     catálogo.
3. Con búsqueda (`?q=` en la URL, con debounce): se ocultan las filas; pestañas
   *Todo / Personas / Publicaciones / Hashtags* con contadores; personas como
   tarjetas, hashtags como pastillas, publicaciones como filas compactas.

## R8 — Tendencias

- `GET /api/search/trending?limit=N` (N ≤ 20, por defecto 8): hashtags con más
  posts creados en los últimos 14 días; si no hay ninguno reciente, los de más
  posts de siempre. `{ hashtags: [{ name, postCount }] }`.
- Tocar un hashtag lleva a `/hashtag/:tag`.
- Sin tendencias: el bloque no se muestra.

## R9 — Estados

- Carga: skeletons con la silueta del post v3, de la tarjeta de persona y de la
  tarjeta de curso. Nada de "Cargando…" solo en texto.
- Vacío de Inicio: Titi `pensando` + "Seguí a alguien para ver su actividad" +
  sugerencias inline + botón "Ir a Explorar".
- Vacío de Explorar sin publicaciones: Titi `idle` + invitación a publicar en
  Inicio.
- Búsqueda sin resultados: Titi `pensando` + término buscado + "Limpiar
  búsqueda".
- Error: mensaje claro + "Reintentar" en el lugar. Fallos de sugerencias o
  tendencias no rompen la página: su bloque se oculta.

## R10 — Movimiento

- Entradas escalonadas (`useStaggerReveal`) en listas y filas; conteo animado
  en racha y gotas; press hundido en todo lo que se toca; corazón con pop.
- Todo ≤ 400 ms y apagado con movimiento reducido.

## R11 — API

- Respuestas `{ success, data }` / `{ success: false, message }` en español.
- Ambos endpoints requieren sesión (como el resto de lo social) y tienen tests.
