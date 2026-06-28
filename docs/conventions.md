# Convenciones — Titi

Patrones obligatorios de código, naming, versionado y glosario. Las skills locales
`titi-backend-patterns` / `titi-frontend-patterns` / `titi-dual-db` tienen el detalle
accionable; este doc es la referencia rápida.

---

## Patrones backend

**`prisma.js` — singleton:**
```js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export default prisma;
```

**`db.js` — runQuery Neo4j:**
```js
export async function runQuery(cypher, params = {}) {
  const session = driver.session();
  try { return (await session.run(cypher, params)).records; }
  finally { await session.close(); }
}
```

**`requireRole` (rutas Postgres):**
```js
function requireRole(...roles) {
  return async (req, res, next) => {
    const usuario = await loadCurrentUser(req, res);
    if (!usuario) return;
    if (!roles.includes(usuario.rol))
      return res.status(403).json({ success: false, message: 'No tienes permiso para esta acción' });
    next();
  };
}
```

**Toda ruta nueva debe:**
1. Validar input al inicio con respuestas `400`.
2. Usar `requireAuth` / `optionalAuth` según corresponda.
3. Loguear errores con `console.error('NOMBRE_RUTA error', err)` antes del `500`.
4. Devolver siempre `{ success, data }` o `{ success: false, message }`.
5. **Gamificación / sync externo van después de la operación principal y nunca la
   bloquean** (try/catch que loguea): gotas, misiones, neo4j-sync, Cloudinary.

## Patrones frontend

**Cliente API:**
```js
import client from '../api/client.js';
const { data } = await client.get('/api/...');
if (data?.success) { /* ... */ }
```

- Todo componente pasa la checklist de `frontend/design.md` §12.
- Si lleva animación GSAP, además la checklist de `frontend/motion.md` §6.
- **Mascota Titi:** siempre `<TitiMascot>` (WebP animado, fallback `/Titi.png`). Nunca 🐒.

---

## Convenciones generales

| Aspecto | Regla |
|---|---|
| IDs | `crypto.randomUUID()` en Neo4j, `@default(uuid())` en Prisma |
| Fechas | ISO 8601. Render con `toLocaleDateString('es-ES')` |
| Idioma UI | Español, voseo opcional ("Inscribite gratis") |
| Idioma código | Inglés (variables, funciones, archivos) |
| Nombres en DB | Español (modelos Prisma, nodos/relaciones Neo4j, campos visibles) |
| Mensajes de error | Español legible ("Curso no encontrado") |
| Commits | Conventional commits en español: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:` |
| Identidad git | `abdair-coca <cocaabdair@gmail.com>`, **sin** `Co-Authored-By` |
| Branches | `main` = producción. Trabajo en feature branches, PR con review |
| Tailwind | Solo `titi-*` y `gray-*`. No hardcodear hex. Cards solo `rounded-xl`/`2xl` |
| Tipografía | `font-sans` (Nunito). `font-black` solo para números de racha |
| Motion | GSAP para UI; WebP para la mascota. Ambos respetan `prefers-reduced-motion` |
| UI plana | Sin `bg-gradient-*` ni `blur-*` en componentes nuevos |

---

## Versionado y releases

SemVer alineado a etapas. Tag anotado sobre `main`, árbol limpio, smoke test pasado.

| Etapa | Tag | Estado |
|---|---|---|
| 1 Titi Social | `v0.1.0` | ✅ |
| 2 Módulo Educativo | `v0.2.0` | ✅ |
| 3 Evaluaciones y Progreso | `v0.3.0` | ✅ |
| 4 Integración Social + Admin | `v0.4.0` | ✅ |
| 5 Pulido y Deploy | `v1.0.0` | ✅ |
| 6 Gamificación + Titi Vivo | `v2.0.0` | 🔄 en curso |

Desde la Etapa 6 se taggea por subfase (un MINOR cada una; el cierre corta el MAJOR):

| Subfase | Tag | Estado |
|---|---|---|
| 6.1 Gotas | `v1.1.0` | ✅ |
| 6.2 Misiones | `v1.2.0` | ✅ |
| 6.3 Ranking | `v1.3.0` | ✅ |
| 6.4 Titi vivo | `v1.4.0` | 🔄 |
| 6.5 UI gamificación | `v1.5.0` | 📋 |
| 6.6 Cierre | `v2.0.0` | 📋 |

Bugfix dentro de una subversión ya taggeada → patch (`v1.1.1`…).

```bash
git tag -a vX.Y.0 -m "Etapa 6.N — <título>"
git push origin main --follow-tags
```

---

## Glosario

| Término | Significado |
|---|---|
| **neoId** | `Usuario.id` de Neo4j replicado en `Usuario.neoId` de Postgres. El JWT lo lleva |
| **Espejo** | Fila `Usuario` en Postgres que corresponde a un `(:Usuario)` en Neo4j |
| **Inscripción** | Relación `Usuario`↔`Curso` en Postgres; se propaga a Neo4j como `:INSCRITO_EN` |
| **Racha** | Días consecutivos completando lección/evaluación. Vive en `Usuario.racha` |
| **Gotas** | XP de Titi. `gotasSaldo` (gastable) + `gotasTotal` (lifetime) + ledger `MovimientoGota` |
| **Verificado** | Booleano en `Usuario`. Solo `PROFESOR`. Requerido para crear cursos |
| **Borrador** | `Curso.publicado = false`. No aparece en catálogo público |
| **Save vs Like** | Like = público, notifica al autor. Save = privado |
| **CursoRef** | Nodo Neo4j con `cursoId` que referencia el curso de Postgres (sin duplicarlo) |
| **Etapa** | Iteración mayor del proyecto. Estado vivo en [roadmap.md](roadmap.md) |
