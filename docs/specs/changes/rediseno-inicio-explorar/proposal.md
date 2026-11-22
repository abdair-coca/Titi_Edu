# Proposal — Rediseño de Inicio y Explorar

> **Change:** `rediseno-inicio-explorar`
> **Estado:** propuesto (2026-11-22). Pedido: "con el mismo design.md con el que
> se rediseñó cursos, rediseñá inicio y explorar".

## Intención

`/feed` (Inicio) y `/explore` (Explorar) siguen con el look v2: cards finas,
emojis en el composer y en la actividad académica, búsqueda plana y estados de
"Cargando…" en texto. `/courses` ya estrenó el lenguaje v3 (borde oscuro, sombra
dura oscura, pastillas, filas deslizables, vista rápida, íconos con
microinteracción). Esta propuesta lleva ese mismo lenguaje a las dos páginas
sociales y, de paso, refuerza el diferencial de Titi: **el aprendizaje es
social**. Inicio te deja seguir tu curso en un toque y ver qué aprenden tus
amigos; Explorar te ayuda a encontrar gente, temas y cursos de la comunidad.

## Alcance

**Entra**

- **Inicio:** saludo con acento, composer v3 (sin emojis, se expande al
  enfocarlo), fila *Continúa donde quedaste* (la misma del catálogo), pestañas
  *Todo / Publicaciones / Aprendizaje*, post v3, actividad académica v3 que abre
  la vista rápida del curso, sugerencias de gente para seguir, rail lateral con
  tu día (racha, gotas) + sugerencias + categorías. Vacío con Titi que vende el
  siguiente paso (seguir gente).
- **Explorar:** cabecera con buscador idéntico al de `/courses`, búsqueda en la
  URL (`?q=`), tendencias (#hashtags), fila *Gente para seguir*, fila de cursos
  que más toma la comunidad (con vista rápida), publicaciones recientes y rail
  con tendencias en ranking, categorías y acceso al catálogo. Resultados de
  búsqueda por pestañas (Todo / Personas / Publicaciones / Hashtags).
- Componentes compartidos v3: `PostCard`, `CreatePost`, `AcademicActivityCard`,
  `CategoriesExplorer` (los usan también Perfil, Hashtag y Mis cursos: quedan
  v3 por regla boy scout).
- **API (solo lectura):** `GET /api/users/suggestions` (gente para seguir:
  amigos de amigos y, si faltan, los más seguidos) y `GET /api/search/trending`
  (hashtags con más posts en los últimos 14 días).
- `design.md`: post v3, superficie v3 y piezas sociales en el inventario.

**No entra**

- Cambios en el modelo de datos, en cómo se crean posts, likes o follows.
- 3D en estas páginas (el 3D sigue siendo solo de `/courses`).
- Perfil, Notificaciones y Hashtag más allá de heredar el `PostCard` nuevo.

## Criterios de éxito

- Desde Inicio, seguir la lección pendiente es 1 toque; abrir el curso de un
  amigo y pedir inscribirse, 2.
- Cero emojis en Inicio, Explorar y los componentes tocados.
- Todo estado tiene forma: skeleton con la silueta real, vacío con siguiente
  paso, error con "Reintentar" en el lugar.
- Seguir a alguien y dar like se sienten instantáneos (optimistas con rollback).
- `npm test` del backend y `npm run build` del frontend en verde; 390 px sin
  scroll horizontal; `prefers-reduced-motion` respetado.

## Riesgos

- `PostCard` se usa en Perfil y Hashtag: el cambio es visual y mantiene props.
- La consulta de sugerencias en Neo4j debe ser acotada (LIMIT y sin recorrer
  todo el grafo): amigos de amigos a 2 saltos y relleno por seguidores.
