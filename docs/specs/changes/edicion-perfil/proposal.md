# Proposal — Edición de perfil propio

> **Estado:** propuesta lista para revisión y ejecución.
> Orquestador: agente principal.

## Intención

Permitir a los usuarios de Titi personalizar su perfil dentro de la red social universitaria:
actualizar su biografía, cambiar su foto de perfil/avatar (subiendo una imagen propia o eligiendo
entre una galería de avatares predefinidos) y configurar una imagen de portada/banner de cabecera.
Todo desde un modal emergente accesible directamente en su perfil propio (`/profile/:username`).

## Alcance

### In Scope
- **Backend — Endpoints de perfil:**
  - `PUT /api/users/me`: actualización de `bio`, `avatarUrl` y `bannerUrl`.
  - `POST /api/users/me/avatar`: subida multipart de foto de perfil (Cloudinary / disco local, max 2MB, jpg/png/webp).
  - `POST /api/users/me/banner`: subida multipart de imagen de portada (Cloudinary / disco local, max 3MB, jpg/png/webp).
  - Modificación de `publicUser()` en `backend/src/routes/users.js` para incluir `bannerUrl`.
- **Frontend — UI y experiencia:**
  - Componente modal `EditProfileModal.jsx` activable con botón "Editar perfil" cuando `isSelf === true` en `Profile.jsx`.
  - Selector de avatar: opción de subir archivo propio (con preview) o seleccionar entre presets visuales (estilo Titi / DiceBear).
  - Selector de banner: opción de subir portada (con preview) o elegir un color/gradiente neutro preset.
  - Campo de texto para `bio` con contador en tiempo real (máximo 280 caracteres).
  - Actualización reactiva de `useAuth().updateUser` para reflejar el cambio de avatar inmediatamente en la `Navbar` y demás componentes sin necesidad de recargar la página.
- **Tests:**
  - Tests unitarios y de integración para las nuevas rutas de `users.js` (`test/routes/users.test.js`).

### Out of Scope
- Modificación de `username` o `email` (se mantienen inmutables).
- Campos de datos académicos o institucionales adicionales (carrera, universidad, etc.).
- Gamificación: no se otorgan Gotas ni misiones por editar perfil (operación CRUD pura).
- Herramienta pesada de recorte o crop client-side (se usa encuadre CSS `object-cover` y relación de aspecto fija).

## Hallazgos técnicos (exploración)

1. **Dual-DB & Persistencia:**
   - En Neo4j, el nodo `(u:Usuario)` almacena actualmente `bio` y `avatarUrl`. Añadir la propiedad `bannerUrl` es retrocompatible y no requiere migraciones estructurales.
   - En PostgreSQL, la tabla `Usuario` no almacena datos cosméticos del perfil social (cumpliendo la regla de oro dual-DB: lo social en Neo4j, lo educativo en Postgres).
2. **Infraestructura de uploads:**
   - Ya existe el servicio `uploadBuffer` (`backend/src/services/upload.service.js`) que maneja subida a Cloudinary con fallback a almacenamiento local en `backend/uploads/` cuando no hay credenciales configuradas en desarrollo.
3. **Contexto de Autenticación en Frontend:**
   - `AuthContext.jsx` ya cuenta con la función `updateUser(partial)` que actualiza el estado en memoria y sincroniza `localStorage`, permitiendo que la Navbar y otros componentes se actualicen de forma inmediata.

## Decisiones tomadas

1. **Avatar:** Ambas modalidades soportadas (subida de imagen personalizada + galería de avatares predefinidos).
2. **Campos:** `bio`, `avatarUrl` y `bannerUrl`.
3. **Inmutabilidad:** `username` y `email` permanecen inmutables.
4. **Portada:** Se incorpora `bannerUrl` editable en la cabecera del perfil.
5. **Gamificación:** Sin entrega de Gotas ni desbloqueo de misiones/logros.
6. **Flujo de UI:** Modal emergente directo en la página de perfil del usuario (`Profile.jsx`).

## Criterios de éxito

- [ ] El usuario autenticado ve el botón "Editar perfil" en su propio perfil (`isSelf`).
- [ ] Puede editar su biografía (hasta 280 caracteres) y guardarla.
- [ ] Puede seleccionar un avatar predefinido o subir una imagen propia (máx 2MB), viéndola reflejada al instante.
- [ ] Puede subir o cambiar una imagen de banner para su perfil.
- [ ] Los usuarios que visiten su perfil público ven el avatar, portada y biografía actualizados.
- [ ] Tests de backend en `test/routes/users.test.js` pasando al 100%.
- [ ] Build del frontend (`npm run build`) limpio y sin advertencias ni errores.
