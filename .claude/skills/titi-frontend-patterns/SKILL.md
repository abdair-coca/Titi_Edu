---
name: titi-frontend-patterns
description: Patrones obligatorios para componentes React, páginas, consumo de API y diseño Titi en el frontend. Úsalo antes de crear o modificar archivos en frontend/src/. Disparadores - "nuevo componente", "nueva página", "agregar UI", "tabs", "modal", "formulario", "fetch en React", o cuando estés por escribir JSX/Tailwind en este repo.
---

# Patrones frontend — Titi

## 1. Estructura de una página

```jsx
import { useCallback, useEffect, useState } from 'react';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function MiPagina() {
  const { user, isAuthenticated } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await client.get('/api/...');
      if (data?.success) setData(data.data.X);
      else setError(data?.message || 'No se pudo cargar');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [/* deps */]);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetch} />;
  if (!data) return <EmptyState />;

  return <div>{/* contenido */}</div>;
}
```

**Tres estados siempre:** `loading` → skeleton, `error` → mensaje + reintentar, `empty` → Titi + CTA.

## 2. Cliente API

```js
import client from '../api/client.js';
// Ya incluye el JWT en Authorization automáticamente.
// baseURL viene de VITE_API_URL.

const { data } = await client.get('/api/users/me');
const { data } = await client.post('/api/posts', formData);  // multipart funciona con FormData
```

**Respuesta esperada siempre:** `{ success: true|false, data?: {...}, message?: '...' }`. Chequear `data?.success` antes de leer `data.data`.

## 3. Optimistic updates (like, save, follow)

Patrón de `PostCard.jsx`:

```js
async function toggleLike() {
  if (!isAuthenticated || liking) return;
  const prevLiked = likedByMe;
  const prevLikes = likes;
  setLikedByMe(!prevLiked);        // 1. update optimista
  setLikes(prevLikes + (prevLiked ? -1 : 1));
  setLiking(true);
  try {
    const { data } = await client.post(`/api/posts/${post.id}/like`);
    if (data?.success) {
      setLikedByMe(Boolean(data.data.liked));   // 2. confirma con respuesta del servidor
      setLikes(Number(data.data.likes ?? 0));
      onChange?.({ id: post.id, liked: data.data.liked, likes: data.data.likes });
    } else {
      setLikedByMe(prevLiked); setLikes(prevLikes);  // 3. rollback si el servidor dijo que no
    }
  } catch {
    setLikedByMe(prevLiked); setLikes(prevLikes);    // 4. rollback en error de red
  } finally {
    setLiking(false);
  }
}
```

**Notifica al parent** via `onChange` para que pueda filtrar listas (ej. quitar de "Likes" si el usuario quitó el like).

## 4. Sistema de diseño (resumen de `frontend/design.md`)

### Paleta
- `bg-titi-yellow` / `text-titi-yellow-dark` / `bg-titi-yellow-light` — acción principal.
- `bg-titi-cream` (`#FFFBF0`) — fondo de inputs, secciones cálidas.
- `bg-titi-dark` (`#1A1A2E`) — sidebar.
- `text-titi-dark` / `text-titi-text` — texto principal.
- `text-titi-muted` / `text-gray-500` — texto secundario.
- `bg-titi-red/10 text-titi-red` — like activo, peligro.
- `bg-titi-streak` (`#FF6B35`) — racha activa.
- `bg-titi-achievement` (`#A855F7`) — logros.

**NUNCA hex hardcodeado en JSX.** Si te falta un tono, agregalo a `tailwind.config.js`.

### Tipografía
- `font-sans` (Nunito) por default.
- Tamaños: `text-xs|sm|base|lg|xl|2xl|3xl|4xl`.
- Pesos: `font-medium`, `font-semibold`, `font-bold`, `font-extrabold`, `font-black` (solo números de racha).

### Jerarquía rápida

| Elemento | Clases |
|---|---|
| Título de página | `text-3xl font-extrabold text-titi-dark` |
| Título de sección | `text-2xl font-bold text-titi-dark` |
| Título de card | `text-base font-bold text-titi-dark` |
| Subtítulo | `text-sm font-medium text-gray-500` |
| Cuerpo | `text-base text-titi-text` |
| Label / badge | `text-xs font-semibold` |
| Botón primario | `text-base font-bold` |

### Botón primario (estilo Duolingo)

```jsx
<button className="
  bg-titi-yellow text-titi-dark font-bold text-base
  px-6 py-3 rounded-xl
  shadow-[0_4px_0px_#E6B800]
  hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5
  active:shadow-none active:translate-y-0
  transition-all duration-150
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Inscribirme al curso
</button>
```

La sombra inferior `shadow-[0_4px_0px_#E6B800]` que se aplana al click es la firma visual de Titi.

### Botón secundario

```jsx
<button className="
  bg-white text-titi-dark font-semibold text-sm
  px-5 py-2.5 rounded-xl
  border border-gray-200
  hover:bg-gray-50 hover:border-gray-300
  transition-all duration-150
">Ver detalles</button>
```

### Card

```jsx
<div className="
  bg-white rounded-2xl border border-gray-100
  shadow-[0_2px_8px_rgba(0,0,0,0.06)]
  hover:shadow-[0_8px_24px_rgba(255,217,61,0.2)]
  hover:-translate-y-1
  transition-all duration-200
  overflow-hidden
">
```

Bordes siempre `rounded-xl` (chico) o `rounded-2xl` (card grande). Nunca `rounded` solo en contenedores.

### Input

```jsx
<input className="
  w-full bg-titi-cream border border-gray-200 rounded-xl
  px-4 py-3 text-sm font-medium text-titi-dark
  placeholder:text-gray-300
  focus:outline-none focus:border-titi-yellow focus:ring-2 focus:ring-titi-yellow/20
  transition-all duration-150
" />
```

### Estado vacío con Titi

```jsx
<div className="flex flex-col items-center justify-center py-16 px-8 text-center">
  <img
    src="/Titi.png" alt="Titi"
    className="w-24 h-24 mb-4 object-contain drop-shadow-sm select-none"
    draggable={false}
  />
  <h3 className="text-xl font-bold text-titi-dark mb-2">{titulo}</h3>
  <p className="text-sm text-gray-400 mb-6 max-w-xs">{descripcion}</p>
  <button className="...botón primario...">{cta}</button>
</div>
```

**SIEMPRE `/Titi.png`. NUNCA emoji 🐒.**

### Estado de error

```jsx
<div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
  <span className="text-red-500 text-lg">⚠️</span>
  <div>
    <p className="text-sm font-semibold text-red-700">{titulo}</p>
    <p className="text-xs text-red-500 mt-0.5">{mensaje}</p>
  </div>
</div>
```

### Skeleton

```jsx
<div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
  <div className="h-44 bg-gray-100" />
  <div className="p-4 flex flex-col gap-3">
    <div className="h-3 bg-gray-100 rounded w-1/3" />
    <div className="h-4 bg-gray-100 rounded w-3/4" />
  </div>
</div>
```

## 5. Layout principal

```jsx
<div className="flex min-h-screen bg-titi-cream">
  <Navbar />
  <main className="md:ml-64 flex-1 p-4 sm:p-6 md:p-8 pt-20 md:pt-8 pb-20 md:pb-8 max-w-screen-xl mx-auto">
    {children}
  </main>
</div>
```

El sidebar es fijo (`fixed`) y mide `w-64`. El contenido tiene `md:ml-64`. En móvil hay top bar + bottom nav, por eso `pt-20 md:pt-8 pb-20 md:pb-8`.

## 6. Guards por rol y auth

En `App.jsx`:

```jsx
<Route element={<RequireAuth />}>
  <Route path="/feed" element={<Feed />} />
  {/* ... */}
  <Route element={<RequireRole role="PROFESOR" />}>
    <Route path="/teacher" element={<MyTeaching />} />
  </Route>
</Route>
```

`RequireAuth` redirige a `/login` si `!isAuthenticated`. `RequireRole` redirige a `/feed` (con mensaje) si `user.rol !== role`.

## 7. Tabs (patrón de `Profile.jsx`)

```jsx
const [tab, setTab] = useState('posts');

<div role="tablist" className="flex gap-2 mb-5 border-b-2 border-titi-border px-1">
  <TabButton active={tab === 'posts'} onClick={() => setTab('posts')} icon={...} label="Posts" count={...} />
  {isSelf && (
    <>
      <TabButton active={tab === 'saved'} onClick={() => setTab('saved')} label="Guardados" count={...} />
      <TabButton active={tab === 'liked'} onClick={() => setTab('liked')} label="Likes" count={...} />
    </>
  )}
</div>

{tab === 'posts' && <PostsList ... />}
{tab === 'saved' && <PostsList ... />}
```

**Carga perezosa por tab:** solo fetcheás cuando el usuario entra a la pestaña, y cacheás con un flag `xxxLoaded`.

## 8. Modal de confirmación

Usar `ConfirmModal.jsx` existente:

```jsx
<ConfirmModal
  open={confirmOpen}
  title="¿Eliminar curso?"
  message="Esta acción no se puede deshacer."
  confirmLabel="Eliminar"
  destructive
  onConfirm={handleDelete}
  onCancel={() => setConfirmOpen(false)}
/>
```

Toda acción destructiva pasa por modal de confirmación. Nunca `window.confirm`.

## 9. Helpers `lib/format.js`

```js
import { resolveMediaUrl, relativeTime, formatDate } from '../lib/format.js';

resolveMediaUrl('/uploads/abc.jpg')  // → 'http://localhost:3001/uploads/abc.jpg'
relativeTime(post.createdAt)         // → 'hace 2 horas'
formatDate(user.createdAt)           // → '5 de junio de 2026'
```

## 10. Antipatrones a evitar

- ❌ `fetch()` directo en lugar de `client` (pierde el JWT).
- ❌ Hex hardcodeado en `className` (rompe el sistema).
- ❌ Emoji 🐒 en cualquier lugar (la mascota es `/Titi.png`).
- ❌ `rounded` solo en cards (debe ser `rounded-xl` o `rounded-2xl`).
- ❌ Olvidar el estado de `loading` o `error` (al menos uno aparecerá ante el usuario en algún momento).
- ❌ Animaciones > 300ms (la app se siente lenta).
- ❌ Más de 3 elementos animándose simultáneamente.
- ❌ `useEffect` sin cleanup (cancellation flag) en fetches que dependen de params de URL.
- ❌ Modificar estado del padre desde el hijo sin un `onChange` explícito.

## Checklist antes de marcar un componente como terminado

- [ ] Usa solo colores `titi-*` y `gray-*`.
- [ ] Tipografía con peso correcto para su jerarquía.
- [ ] Estado hover con sombra/elevación correspondiente.
- [ ] Estado loading (skeleton o spinner).
- [ ] Estado vacío con `/Titi.png` y CTA si aplica.
- [ ] Estado de error con botón "Reintentar".
- [ ] Bordes `rounded-xl` / `rounded-2xl`.
- [ ] Transiciones ≤ 300ms.
- [ ] Botón principal con sombra inferior estilo Duolingo.
- [ ] Disabled state en botones interactivos.
- [ ] Optimistic update + rollback en mutaciones.

## Skills hermanas

- `titi-orientation` — mapa del repo.
- `titi-backend-patterns` — cómo se sirve la API que estás consumiendo.
- `titi-dual-db` — modelo de datos detrás del API.
