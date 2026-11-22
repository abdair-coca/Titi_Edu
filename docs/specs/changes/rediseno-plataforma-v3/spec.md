# Spec — Rediseño v3 del resto de la plataforma

Requisitos de las pantallas que faltaban pasar al lenguaje v3 de `/courses`,
Inicio y Explorar (`frontend/design.md` §5.2 "tile v3" y "superficie v3",
§5.3, §5.5, §15). Rediseño visual: no cambia endpoints ni datos.

---

## R0 — Lenguaje común (todas las pantallas)

- **Tile v3** (navega o abre algo entero): `border-2 border-titi-dark
  rounded-2xl shadow-[0_5px_0_#1A1A2E]`, sube a `0_8px` al hover y se aplasta
  a `0_2px` al presionar.
- **Superficie v3** (informa): `border-2 border-titi-dark rounded-2xl` +
  sombra difusa; no se mueve. Lo que reacciona son sus botones.
- **Cabecera de página:** título `text-3xl sm:text-4xl font-black` con una
  palabra de acento en `text-titi-streak`, subtítulo de una línea y acciones a
  la derecha (abajo en celular).
- **Títulos de panel:** insignia de rol girada (`rounded-xl border-2
  border-titi-dark -rotate-6`, sólido del rol, ícono blanco u oscuro sobre
  amarillo) + título `text-lg font-extrabold` con acento.
- **Botón secundario v3:** blanco, `border-2 border-titi-dark`, sombra dura
  oscura de 3 px, amarillo al hover, se hunde al presionar (el de
  "Reintentar" y "Refrescar"). El primario sigue siendo `titi-btn-primary`.
- **Pastillas** (`Pill` del catálogo) para pestañas y filtros.
- **Paneles oscuros** (`bg-titi-dark`) con tiles `bg-white/5 border-2
  border-white/10` para resúmenes de gamificación y cierres.
- **Estados:** skeleton con la silueta real; vacío con `<TitiMascot state=…>`
  (siempre `state`) + título con acento + CTA; error con `ErrorBox` y
  Reintentar en el lugar.
- **Íconos** solo de `components/icons.jsx`; categorías con `categoryTheme` /
  `<CategoryIcon>` / `CourseCover`. **Cero emojis** en la interfaz: el emoji de
  datos (`logro.icono`, `item.icono`, `categoria.icono`) se reemplaza por un
  SVG elegido por `tipo`/`codigo`/categoría.
- Motion: `useStaggerReveal` en listas, `usePopIn` en bloques sueltos,
  `useCountUp` en números clave, barras que se llenan desde 0, press en todo
  clickeable. `prefers-reduced-motion` apaga todo. Voseo; "gotas", nunca "XP".
- 390 px sin scroll horizontal. Sin `bg-gradient-*` ni `blur-*`.

## R1 — Perfil (`/profile/:username`)

- Cabecera como superficie v3: portada a sangre (sin portada, tinte amarillo
  con la marca), avatar grande con borde oscuro superpuesto, `@usuario`,
  bio, ubicación como chip con círculo verde, fecha de alta.
- Acciones: propio → "Editar perfil" (botón secundario v3) y chip "Vos";
  ajeno → `FollowButton` (optimista con rollback). El contador de seguidores
  sigue al botón.
- Stats (posts, seguidores, seguidos) como tiles internos con count-up y
  ícono de rol.
- Racha (`StreakBadge` hero) v3: superficie con la llama, número con
  count-up, chip de estado con ícono SVG (sin "✓" ni "⏳"), barra hacia la
  próxima meta que se llena desde 0, hitos como pastillas con número (sin
  emojis).
- Logros (`AchievementsSection`) v3: superficie con insignia púrpura,
  contador `N / M` y barra; cada logro con ícono SVG por `tipo` (curso,
  racha, evaluación, social) en cuadro sólido púrpura si está desbloqueado,
  gris con candado si no. Error con `ErrorBox`.
- Pestañas Posts / Guardados / Likes como `Pill` con ícono en círculo sólido
  y contador. Skeleton de posts (`PostCardSkeleton`), vacío con Titi y CTA
  ("Publicar en Inicio" / "Ir a Explorar"), error con `ErrorBox`.
- `EditProfileModal` v3: panel con borde oscuro, cerrar con ícono, secciones
  con título, presets como mini tiles con borde oscuro al elegir, error con
  forma de §8.
- Pendiente (necesita API): los posts del perfil se filtran del feed de
  Explorar; un endpoint propio por usuario evitaría que falten posts viejos.

## R2 — Hashtag (`/hashtag/:tag`)

- Volver a Explorar con `BackLink`. Cabecera: cuadro amarillo girado con
  `HashIcon` + `#tag` con acento + cantidad de posts.
- Lista de `PostCard` con skeleton, vacío con Titi `pensando` + CTA
  "Publicar en Inicio", error con `ErrorBox`.
- Rail (lg+): `TrendingPanel` (otros temas) — reusa `useTrending`.

## R3 — Notificaciones (`/notifications`)

- Cabecera con acento y "Marcar todo como leído" (botón secundario v3).
- Pestañas `Pill` Todas / Sin leer con contador.
- Cada notificación es un tile v3 compacto: avatar v3 + insignia de tipo
  (like rojo con `HeartIcon`, comentario azul, seguir azul `UsersIcon`, logro
  púrpura, lección nueva verde `BooksIcon`, respuesta azul) + texto sin
  emojis + extracto del post + hace cuánto. Sin leer: fondo
  `titi-yellow-light` y punto rojo.
- Skeleton con la silueta de la fila, vacío con Titi `idle` + CTA "Ir a
  Explorar", error con `ErrorBox`.

## R4 — Mis cursos (`/my-courses`)

- Cabecera con acento; Ranking y Tienda (primarios) y Mis certificados
  (secundario v3) como hasta ahora.
- Resumen: panel oscuro *Tu progreso* con tres tiles (progreso promedio con
  barra, gotas totales, racha) con count-up.
- Ruta de aprendizaje: nodos con el **sólido de la categoría** y borde oscuro;
  cada curso es un tile v3 horizontal con `CourseCover`, nivel, estado
  ("Completado" verde con `CheckIcon`), barra animada y "Continuar" (primario,
  1 toque a la lección). Nodo "+N" igual.
- `DailyMissions` v3: superficie con insignia amarilla, filas con ícono por
  evento, barra animada desde 0, recompensa en gotas; completada en tinte
  amarillo con check. Error con `ErrorBox`.
- `CategoriesExplorer` (ya v3) y Actividad reciente v3 (superficie, chips
  sólidos, toggle al pie).
- Banner de cierre como panel oscuro con Titi `saludo`.
- Vacío con Titi `pensando` + "Ver catálogo de cursos"; error con `ErrorBox`;
  skeleton con la silueta nueva.

## R5 — Certificados (`/certificates`, `/verify/:codigo`)

- Cabecera con acento y subtítulo.
- Cada certificado: superficie v3 con banda superior `CourseCover` de la
  categoría (sin emoji), insignia de certificado dorada, título, fecha, código
  en caja crema, "Copiar código" (secundario v3, check SVG al copiar) y "Ver
  verificación" (primario).
- Vacío con Titi `pensando` + "Ir a mis cursos"; error con `ErrorBox`;
  skeleton con la silueta real.
- Verificación pública: superficie v3 válida (verde) o no válida (rojo, ícono
  SVG en lugar de "✕"); volver con flecha SVG.

## R6 — Ranking (`/leaderboard`)

- Cabecera con acento. Temporada como panel oscuro con cuenta regresiva.
- Podio top 3 (tiles con medalla de color, avatar v3 y gotas) cuando hay 3 o
  más; resto como filas de superficie; mi fila en tinte amarillo con chip
  "Vos". Gotas con count-up.
- Vacío con Titi `pensando` + "Ir a Explorar" (seguir gente); error con
  `ErrorBox`; skeleton con la silueta de la fila.
- Layout más ancho en desktop: lista + rail con "Cómo sumar gotas".

## R7 — Tienda (`/shop`) e `ItemCard`

- Cabecera con acento + saldo en tile oscuro con count-up.
- `ItemCard` v3: superficie con cuadro sólido girado y **ícono SVG por
  `codigo`** (congelar racha, intento extra, multiplicador; genérico regalo),
  "Tenés N", descripción, precio en gotas y "Comprar" primario. Sin saldo:
  texto "Te faltan N gotas".
- "Cómo obtener más gotas" en panel oscuro con tiles internos.
- Vacío con Titi + CTA; error con `ErrorBox`; skeleton con la silueta.

## R8 — Detalle de curso (`/courses/:id`)

- Volver al catálogo con `BackLink`. Portada `CourseCover` (sin gradiente ni
  blur ni emoji), nivel `LevelChip`, categoría con su color, título con
  `font-black`, autor, fecha, inscritos y descripción, en superficie v3.
- Módulos como lista numerada en superficie v3 con nodo del color de la
  categoría, lecciones y si trae evaluación.
- Panel de inscripción sticky (superficie v3): título sin emoji, stats con
  insignias, mensajes de éxito/error con forma §8, CTA primario.

## R9 — Chrome (`Navbar`, `GuestShell`)

- Mismos ítems, rutas y comportamiento. Solo ajustes: avatar con `Avatar`
  v3, burbuja de no leídas con borde oscuro, botones de la barra móvil con
  press; `GuestShell` con borde inferior oscuro y botones v3.

## R10 — Teacher y Admin

- Cabeceras con acento, cards → superficies v3, tiles que navegan → tile v3,
  botones secundarios v3, estados de carga/vacío/error con las piezas comunes.
  Sin cambios de lógica ni endpoints. Tablas sin stagger (motion.md).

## R11 — Learn (opcional)

- Solo chrome (header, barras, botones) y solo si queda margen; la lógica de
  carga, navegación y tutor no se toca (la vigilan los `test:learn-*`,
  `test:tutor-*`, `test:html-lesson`, `test:rag`).
