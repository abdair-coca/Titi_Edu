# Spec — Edición de perfil propio

## U1 — Backend: `PUT /api/users/me`

**Requisito:** el usuario autenticado puede actualizar sus campos de presentación (`bio`, `avatarUrl`, `bannerUrl`).

- **Autenticación:** `requireAuth`.
- **Payload (`req.body`):**
  - `bio` (opcional): string con longitud máxima de 280 caracteres.
  - `avatarUrl` (opcional): string URL válida o ruta relativa `/uploads/...`.
  - `bannerUrl` (opcional): string URL válida o ruta relativa `/uploads/...`, o `null`/vacío para quitar la portada.
- **Validaciones:**
  - Si `bio` supera los 280 caracteres, retorna `400 Bad Request` con mensaje descriptivo en español.
  - Campos inmutables como `username`, `email` o `id` enviados en el body deben ser ignorados y no modificados.
- **Persistencia:**
  - Actualiza las propiedades correspondientes en el nodo `(u:Usuario {id: req.user.id})` en Neo4j.
- **Respuesta (`{ success: true, data }`):**
  - Retorna el objeto `user` actualizado con la estructura de `publicUser()` incluyendo `bannerUrl`.

### Escenarios U1

- **DADO** un usuario autenticado
  **CUANDO** envía `PUT /api/users/me` con `{ bio: "Nueva bio", avatarUrl: "https://ejemplo.com/avatar.png" }`
  **ENTONCES** recibe `200 OK` con `{ success: true, data: { user } }` y los datos actualizados.
- **DADO** un usuario autenticado
  **CUANDO** envía una biografía de más de 280 caracteres
  **ENTONCES** recibe `400 Bad Request` con `{ success: false, message: "La biografía no puede superar los 280 caracteres" }`.
- **DADO** un usuario no autenticado
  **CUANDO** envía `PUT /api/users/me`
  **ENTONCES** recibe `401 Unauthorized`.

---

## U2 — Backend: `POST /api/users/me/avatar` y `POST /api/users/me/banner`

**Requisito:** el usuario puede subir archivos de imagen para usarlos como avatar o portada/banner.

- **Autenticación:** `requireAuth`.
- **Formato:** `multipart/form-data` con campo `file` o `image`.
- **Límites de archivo:**
  - Avatar: tamaño máximo de 2 MB. Tipos MIME permitidos: `image/jpeg`, `image/png`, `image/webp`.
  - Banner: tamaño máximo de 3 MB. Tipos MIME permitidos: `image/jpeg`, `image/png`, `image/webp`.
- **Almacenamiento:**
  - Usa `uploadBuffer` a Cloudinary (`titi/avatars` y `titi/banners`) si está configurado.
  - Fallback a disco local en `backend/uploads/avatars/` y `backend/uploads/banners/` en entornos sin Cloudinary.
- **Persistencia:**
  - Actualiza de inmediato la propiedad `avatarUrl` o `bannerUrl` en el nodo del usuario en Neo4j.
- **Respuesta (`{ success: true, data }`):**
  - Devuelve `{ success: true, data: { avatarUrl, user } }` o `{ success: true, data: { bannerUrl, user } }`.

### Escenarios U2

- **DADO** un archivo JPG válido menor a 2 MB
  **CUANDO** el usuario hace `POST /api/users/me/avatar`
  **ENTONCES** el archivo se almacena, se actualiza el nodo en Neo4j y responde `200 OK` con la URL.
- **DADO** un archivo que supera el límite de tamaño o con formato inválido (ej. PDF o GIF no permitido)
  **CUANDO** se intenta subir a `/avatar` o `/banner`
  **ENTONCES** responde `400 Bad Request` con mensaje de validación.

---

## U3 — Backend: Inclusión de `bannerUrl` en Perfiles

**Requisito:** los endpoints que devuelven información pública del usuario deben exponer la propiedad `bannerUrl`.

- `publicUser()` en `backend/src/routes/users.js` incluye `bannerUrl: p.bannerUrl || null`.
- Los endpoints `GET /api/users/me` y `GET /api/users/:username` entregan `bannerUrl` dentro de `data.user`.

### Escenarios U3

- **DADO** un usuario con `bannerUrl` configurado
  **CUANDO** cualquier usuario autenticado consulta `GET /api/users/:username`
  **ENTONCES** la respuesta contiene `data.user.bannerUrl` con la URL correspondiente.
- **DADO** un usuario sin portada
  **CUANDO** se consulta su perfil
  **ENTONCES** `data.user.bannerUrl` es `null`.

---

## U4 — Frontend: Vista de Perfil con Banner y Botón de Edición

**Requisito:** `Profile.jsx` renderiza una cabecera con portada y el botón "Editar perfil" si se trata del perfil propio.

- **Cabecera de Perfil:**
  - Si `user.bannerUrl` está definido, renderiza la imagen de portada con `object-cover` y altura fija (ej. `h-36 sm:h-48`).
  - Si no hay `bannerUrl`, renderiza un fondo temático plano con la paleta de Titi (`bg-titi-yellow/20` o un patrón suave sin gradientes ni blur, respetando la regla de UI plana).
  - El avatar circular se superpone a la portada con borde blanco o crema (`border-4 border-white`).
- **Acción de Edición:**
  - Si `isSelf === true`, junto a la etiqueta "Vos", se muestra el botón accesible "Editar perfil" (`titi-btn-ghost` o `titi-btn-secondary`).
  - Al hacer click, abre el modal emergente `EditProfileModal`.

### Escenarios U4

- **DADO** que el usuario visita su propio perfil (`isSelf === true`)
  **CUANDO** carga la página
  **ENTONCES** ve el botón "Editar perfil".
- **DADO** que el usuario visita el perfil de otra persona (`isSelf === false`)
  **CUANDO** carga la página
  **ENTONCES** NO ve el botón "Editar perfil", sino los botones de Seguir/Siguiendo.

---

## U5 — Frontend: Modal de Edición `EditProfileModal.jsx`

**Requisito:** un modal accesible y limpio para editar biografía, seleccionar/subir avatar y elegir/subir portada.

- **Diseño visual:**
  - Modal centrado con fondo oscuro semitransparente, tarjeta con bordes redondeados (`rounded-2xl`) y estética Titi (UI plana, sin gradientes).
  - Encabezado con título "Editar perfil" y botón de cerrar (X).
- **Sección Avatar:**
  - Selector dual:
    1. Subir foto desde el dispositivo (input de archivo con preview inmediata).
    2. Elegir de una lista de avatares predefinidos (galería de opciones estilo DiceBear / Titi).
- **Sección Portada / Banner:**
  - Selector dual:
    1. Subir imagen de portada desde el dispositivo (con preview horizontal).
    2. Elegir un preset de fondo temático plano.
- **Sección Biografía:**
  - Campo `textarea` con valor inicial de `user.bio`.
  - Contador de caracteres en tiempo real: `x / 280`.
  - Validación visual si se llega al límite.
- **Guardado y Feedback:**
  - Botón "Guardar cambios" con estado de carga (`disabled` + texto "Guardando...").
  - Botón "Cancelar" que descarta cambios y cierra el modal.
  - Al completarse con éxito:
    - Llama a `updateUser` de `AuthContext` con los nuevos datos (`avatarUrl`, `bannerUrl`, `bio`).
    - Actualiza el estado local de `profile` en `Profile.jsx`.
    - Muestra un toast o notificación de éxito y cierra el modal.

### Escenarios U5

- **DADO** el modal abierto
  **CUANDO** el usuario selecciona un avatar predefinido y pulsa "Guardar"
  **ENTONCES** se envía la petición, se actualiza el perfil en pantalla y el modal se cierra.
- **DADO** el modal abierto
  **CUANDO** el usuario sube un archivo de avatar nuevo
  **ENTONCES** se envía a `/api/users/me/avatar`, se actualiza la vista y la Navbar muestra la nueva foto.
