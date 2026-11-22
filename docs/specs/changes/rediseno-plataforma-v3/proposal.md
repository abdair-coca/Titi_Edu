# Proposal — Rediseño v3 del resto de la plataforma

> **Change:** `rediseno-plataforma-v3`
> **Estado:** propuesto (2026-11-22). Pedido: "rediseñá el resto de la
> plataforma con el lenguaje visual v3 que ya tienen `/courses`, Inicio y
> Explorar, siguiendo `frontend/design.md` al pie de la letra".

## Intención

`/courses`, Inicio (`/feed`) y Explorar (`/explore`) ya hablan v3: borde oscuro
de 2 px, sombra dura oscura en lo que se toca, superficies con borde oscuro y
sombra difusa, títulos con una palabra de acento, pastillas, paneles oscuros e
íconos SVG con microinteracción. El resto de la app sigue en v2 (cards finas
`border-gray-100`, "Cargando…" en texto, errores sin forma común) y varias
pantallas todavía muestran **emojis** (racha del perfil, logros, ítems de la
tienda, certificados, portada de curso, notificaciones). Al pasar de Inicio a
Perfil o a Mis cursos se siente otra app.

Este change lleva el mismo lenguaje a todas las pantallas restantes, sin tocar
datos ni endpoints: es un rediseño visual.

## Alcance

**Entra** (por prioridad)

1. Perfil (+ `EditProfileModal`, `AchievementsSection`, `StreakBadge` hero e
   inline), Hashtag y Notificaciones.
2. Mis cursos (+ `DailyMissions`), Certificados (lista y verificación
   pública), Ranking y Tienda (+ `ItemCard`).
3. Detalle de curso.
4. Chrome: `Navbar` y `GuestShell`, solo ajustes visuales (mismos ítems y
   navegación).
5. Teacher y Admin: pasada visual v3 (headers, cards, tablas, botones,
   estados), sin cambiar lógica ni endpoints.
6. Learn: solo su chrome y solo si queda margen.

Piezas nuevas compartidas en `components/ui/v3.jsx` (cabecera de página,
superficie, botón secundario v3, insignia de rol girada, vacío con Titi,
barra animada) para no repetir clases larguísimas en cada pantalla.

**No entra**

- Backend y contratos de API. Si una mejora de UX necesita datos nuevos, se
  anota como pendiente en `spec.md`.
- Login/Register/`components/auth/*`, Courses, Feed, Explore, todo el 3D,
  toasts y celebraciones (animaciones cerradas).
- Cambiar props o comportamiento de componentes compartidos.

## Criterios de éxito

- Cero emojis en la interfaz de las pantallas tocadas (sí en contenido de
  usuarios). Los emojis que vienen de datos (`logro.icono`, `item.icono`,
  `categoria.icono`) se reemplazan por íconos SVG elegidos por tipo/código.
- Todo estado tiene forma: skeleton con la silueta real, vacío con
  `<TitiMascot state=…>` y CTA, error con `ErrorBox` + Reintentar.
- Tiles v3 para lo que navega; superficies v3 para lo que informa; botones con
  press; barras que se llenan desde 0; números clave con count-up.
- `npx vite build`, `test:catalog`, `test:hero-3d` en verde; 390 px sin scroll
  horizontal; `prefers-reduced-motion` respetado.

## Riesgos

- `StreakBadge`, `AchievementsSection`, `DailyMissions`, `ItemCard` se usan en
  más de un lugar: se mantienen props y variantes.
- Pantallas largas de teacher/admin (`EvaluationEditor`, `AdminRag`): la
  pasada es de superficie (headers, cards, botones), no de estructura.
