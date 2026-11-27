# Verify report — Rediseño v3 del resto de la plataforma

> **Change:** `rediseno-plataforma-v3` · **Fecha:** 2026-11-22
> **Estado:** implementado y verificado con datos simulados; falta probarlo
> contra la API real y en un celular. El chrome de Learn quedó afuera.

## Automático

| Comando | Resultado |
|---|---|
| `cd frontend && npx vite build` | verde después de cada etapa |
| `npm run test:catalog`, `test:hero-3d` | pass |
| `test:learn-init`, `test:learn-active-lesson`, `test:learn-cache`, `test:learn-panels`, `test:learn-code-split` | OK (Learn no se tocó; `TutorPanel` usa `ConfirmModal`, que cambió solo de estilo) |
| `test:tutor-history`, `test:tutor-key-banner`, `test:html-lesson`, `test:rag` | OK |
| `test:authoring-contract`, `test:deadline`, `test:markdown-url` | OK (editores docentes) |
| Backend | sin cambios (`git diff` vacío en `backend/`), no se corrió `vitest` |
| Búsqueda de emojis en los archivos tocados | ninguno en la interfaz; queda el `placeholder` del campo ícono de Admin › Categorías (es dato, §17) |
| `bg-gradient-*`, `blur-*`, `text-[10/11px]`, "XP" visibles en lo tocado | ninguno |

## Visual (Playwright + Chromium, API simulada con `page.route`)

Sesión falsa en `localStorage` (estudiante y admin), respuestas de ejemplo
para cada endpoint, movimiento reducido. 1280 px y 390 px. **Cero scroll
horizontal y cero errores de consola en las 50 capturas.**

| Pantalla | 1280 | 390 | Notas |
|---|---|---|---|
| Perfil propio / ajeno / no existe | ok | ok | portada a sangre, avatar `xl`, stats con conteo, racha y logros en el rail (tira deslizable en celular), pestañas `Pill`, modal de edición v3 |
| Hashtag con posts / vacío | ok | ok | `RoleBadge` + `#tag`, rail de tendencias |
| Notificaciones | ok | ok | tiles compactos con insignia por tipo, Todas / Sin leer, rail de gente y categorías |
| Mis cursos con datos / vacío | ok | ok | panel oscuro *Tu progreso*, ruta con nodos por categoría y tiles v3, desafíos con ícono por misión, banner oscuro con Titi `saludo` |
| Certificados / verificación válida e inválida / vacío | ok | ok | portada de la categoría, sello dorado, copiar con check SVG |
| Ranking con podio / vacío | ok | ok | podio 2·1·3, filas de superficie, temporada en panel oscuro |
| Tienda / vacía | ok | ok | ítems con ícono por código, "Te faltan N gotas", panel oscuro de cómo ganar gotas |
| Detalle de curso (estudiante, inscrito y visitante) | ok | ok | `CourseCover` sin gradiente ni emoji, temario numerado, panel pegajoso |
| Barra lateral expandida / barra móvil | ok | ok | mismos ítems |
| Enseñar, editor, contenido, notas, integraciones | ok | ok (Enseñar) | superficies v3, `BackLink`, tabla de notas con barra de avance |
| Admin: panel, usuarios, cursos, categorías, RAG | ok | ok (panel) | cifras en panel oscuro con conteo, accesos como tiles v3 |

Capturas: `scratchpad/plataforma/final/` (y `final/vacios/`) de la sesión.

## Arreglado en el camino

- **`/certificates` estaba roto:** `App.jsx` cargaba `m.Certificates` pero
  el archivo solo exportaba `default` (React #306). Se sumó el export nombrado.
- Texto con mojibake ("publicaciÃ³n") en el diálogo de publicación de Enseñar.
- El reintento del detalle de curso ya no recarga la página.

## Pendiente

- Chrome de `LearnCourse` (fase 6): no se tocó.
- Probar con la API real y en un celular (tira de logros, podio, ruta).
- Los datos que faltan para mejorar la UX están en `spec.md` → "Pendientes".
