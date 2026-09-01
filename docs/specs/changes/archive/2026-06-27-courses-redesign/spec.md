# Archivo — Rediseño del catálogo de Cursos (v2 + v2.1)

> **Histórico. IMPLEMENTADO.** Resumen condensado de dos rediseños ya cerrados de
> `frontend/pages/Courses.jsx`. Se guarda para contexto; no es trabajo pendiente.
> El detalle paso a paso original vivía en `frontend/agent.md`.

---

## Rediseño v2 — Catálogo como landing de comunidad (pasos 1–5) ✅

`Courses.jsx` pasó de "header + filtros + grid" a una landing apilada dentro del
shell de la app (sidebar intacto). Secciones: promo bar amarilla, hero (search +
stats reales), featured categories, trending (tabs de categoría + `CourseCard` v2),
dark promo panel, stat strip, testimonios, panel de logros, learning paths, popular
categories, footer.

Decisiones: UI plana (sin gradiente/blur, memoria `no-gradients-no-blur`); rating y
nº de students **omitidos** (no inventar datos); testimonios y learning paths como
**placeholder estático**; sin filtro de nivel (solo search + tabs); featured/popular/
tabs derivados de `GET /api/categories` reales; stats del hero derivados de data real.

## Rediseño v2.1 — Pulido visual (pasos 1–6) ✅

Foco: que el catálogo se vea profesional y terminado, con Titi protagonista.

1. **Hero "comunidad aprendiendo":** imagen IA hosted → `public/hero/community.webp`
   (1448×1086, 122 KB), visible en móvil, `loading="eager"` + `fetchpriority="high"`
   (es el LCP). La ilustración ya contiene a Titi → no se superpone `TitiMascot`.
2. **Categorías destacadas con imágenes IA:** 8 WebP on-brand en
   `public/categories/<slug>.webp` (~9–18 KB); helper `categoriaImg(nombre)` mapea
   nombre→slug; fallback a `categoria.icono` si falta. Las 3 destacadas se curan con
   `FEATURED_PREF`.
3. **Dificultad = etiqueta de texto color** (sin píldora): `PRINCIPIANTE` verde ·
   `INTERMEDIO` ámbar · `AVANZADO` naranja · `SIN NIVEL` gris. Mapeo extraído a
   `lib/nivel.js`, reusado en `CourseCard` y `RecommendedCourseCard`.
4. **Learning paths curadas:** `PATHS` a mano (`{ title, objetivo, cursos: [títulos] }`)
   resueltos contra el catálogo real; lista ordenada de cursos reales. Diferenciadas
   de las Áreas (Áreas = explorar un tema; Rutas = secuencia hacia un objetivo).
5. **Dark-promo + empty/error con Titi:** `<TitiMascot>` animado en el dark-promo;
   empty states con Titi (idle / triste); error con SVG en vez de emoji.
6. **Iconografía SVG + microinteracciones:** `components/icons.jsx` (GotaIcon,
   BookIcon); search con botón limpiar; tabs sticky; botón "volver arriba".

**Fuente de imágenes:** IA generativa hosted (los PNG fuente van a `frontend/.hero-src/`
y `.cat-src/`, gitignorados; solo se shippean los WebP optimizados).

**Pendiente opcional (no bloqueante):** repaso fino de ritmo/responsive 375px +
checklist `design.md` §12.
