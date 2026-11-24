# Tasks — Rediseño v3 del resto de la plataforma

> **Change:** `rediseno-plataforma-v3`
> **Estado:** implementado (fases 0-5 y 7); Learn (fase 6) queda pendiente.
> Verificación por etapa: `cd frontend && npx vite build`, `npm run test:catalog`,
> `npm run test:hero-3d`; capturas a 1280 y 390 px con la API simulada.

## Fase 0 — Base

- [x] 0.1 `proposal.md`, `spec.md`, `tasks.md`.
- [x] 0.2 `components/ui/v3.jsx`: cabecera de página, volver, superficie, botón secundario v3, insignia de rol, vacío con Titi, barra animada.

## Fase 1 — Social

- [x] 1.1 Perfil (R1): cabecera, stats, `FollowButton`, pestañas, estados.
- [x] 1.2 `StreakBadge` hero/inline sin emojis; `AchievementsSection` con íconos por tipo.
- [x] 1.3 `EditProfileModal` v3.
- [x] 1.4 Hashtag (R2).
- [x] 1.5 Notificaciones (R3).

## Fase 2 — Aprendizaje y gamificación

- [x] 2.1 Mis cursos (R4) + `DailyMissions`.
- [x] 2.2 Certificados y verificación (R5).
- [x] 2.3 Ranking (R6).
- [x] 2.4 Tienda + `ItemCard` (R7).

## Fase 3 — Detalle de curso

- [x] 3.1 `CourseDetail` (R8).

## Fase 4 — Chrome

- [x] 4.1 `Navbar` y `GuestShell` (R9).

## Fase 5 — Teacher y Admin

- [x] 5.1 `pages/teacher/*` (R10).
- [x] 5.2 `pages/admin/*` (R10).

## Fase 6 — Learn (opcional)

- [ ] 6.1 Chrome de `LearnCourse` (R11). **No se hizo:** se priorizó no tocar Learn (lógica vigilada por 9 chequeos); queda para un change propio. Se hizo en `rediseno-learn-v3`.

## Fase 7 — Cierre

- [x] 7.1 `design.md` (§14 inventario, §15 átomos nuevos).
- [x] 7.2 `verify-report.md` y fila en el índice de `AGENTS.md`.
