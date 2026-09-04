# Tasks — Edición de perfil propio

> **Change:** `edicion-perfil`
> **Estado:** pendiente de implementación

## Fase 1 — Backend (API & Persistencia)

- [x] 1.1 Modificar `publicUser(node)` en `backend/src/routes/users.js` para incluir `bannerUrl: p.bannerUrl || null`.
- [x] 1.2 Implementar `PUT /api/users/me` en `backend/src/routes/users.js` para actualizar `bio`, `avatarUrl` y `bannerUrl` en Neo4j con validación de longitud (máx 280 caracteres en bio).
- [x] 1.3 Configurar endpoints de subida `POST /api/users/me/avatar` y `POST /api/users/me/banner` con `multer` en memoria, validación de MIME/tamaño y almacenamiento vía `uploadBuffer` (Cloudinary / disco).
- [x] 1.4 Escribir tests de integración en `backend/test/routes/users.test.js` cubriendo casos de éxito, validaciones y rechazo de no autenticados.

## Fase 2 — Frontend (Componentes & UI)

- [x] 2.1 Definir catálogo de avatares predefinidos (presets de DiceBear / Titi) y opciones de banners planos para selección rápida.
- [x] 2.2 Crear el componente modal `frontend/src/components/EditProfileModal.jsx` con tabs o secciones para Avatar (upload + presets), Portada (upload + presets) y Biografía (textarea con contador max 280).
- [x] 2.3 Actualizar `frontend/src/pages/Profile.jsx` para renderizar el banner de cabecera con avatar superpuesto y el botón "Editar perfil" cuando `isSelf === true`.
- [x] 2.4 Conectar `EditProfileModal` con los endpoints de backend y con `useAuth().updateUser` para propagación reactiva en Navbar y vistas.

## Fase 3 — Verificación y Cierre

- [x] 3.1 Ejecutar suite de tests de backend (`npm test` o `npx vitest run test/routes/users.test.js`).
- [x] 3.2 Comprobar el build de frontend con `npm run build` en el directorio `frontend/`.
- [x] 3.3 Generar `verify-report.md` con la evidencia de pruebas.
