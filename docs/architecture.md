# Arquitectura — Titi

Detalle técnico del sistema. Para el catálogo de endpoints ver [api.md](api.md);
para patrones de código y convenciones ver [conventions.md](conventions.md).

---

## Stack

```
Frontend   React 18 + Vite 5 + Tailwind 3 + React Router v6 + Axios
Backend    Node 20 + Express 5 + JWT + bcrypt + multer
Neo4j      Red social (Neo4j Aura) — usuarios, posts, follows, likes, hashtags…
PostgreSQL Capa educativa + gamificación (Prisma) — cursos, progreso, gotas…
Storage    Cloudinary (fallback a disco local en dev sin credenciales)
Deploy     Railway (backend) + Vercel (frontend)
Motion     GSAP (UI) + animaciones WebP de la mascota (subfase 6.4)
```

Versiones críticas: Node 20 LTS, Prisma 5+, React 18 (no 19), Tailwind 3 (no 4).

---

## Topología

```
Frontend (React/Vite)
  • AuthContext + JWT en localStorage
  • Axios client con interceptor
        │ REST + JWT en Authorization header
        ▼
Backend (Express 5)
  • requireAuth / optionalAuth   (middleware/auth.js — parsea JWT → req.user)
  • requireRole                   (rutas Postgres)
  • multer + Cloudinary           (upload.service.js)
        │                    │
        ▼                    ▼
  Neo4j (Aura)          PostgreSQL (Prisma)
  capa social           capa educativa + gamificación
```

Servicios externos (Neo4j, Cloudinary) van en `try/catch`: si fallan, loguean y
**nunca** rompen la respuesta principal.

---

## Qué vive en cada base

**Neo4j — grafo social:**
- Nodos: `Usuario`, `Post`, `Comentario`, `Hashtag`, `Notificacion`, `Sonido`,
  `Ubicacion`, `CursoRef` (referencia al curso de Postgres).
- Relaciones: `SIGUIO`, `PUBLICO`, `LE_GUSTO`, `GUARDO`, `ESCRIBIO`, `EN`,
  `RESPONDE_A`, `RECIBIO`, `SOBRE`, `TIENE_HASHTAG`, `USA_SONIDO`, `VIVE_EN`,
  `ETIQUETADO_EN`, `INSCRITO_EN` / `COMPLETO_CURSO` (→ `CursoRef`, para recomendaciones).

**PostgreSQL — todo lo educativo, estructurado y gamificación:**
- Educativo: `Curso`, `Modulo`, `Leccion`, `Material`, `Categoria`, `Inscripcion`,
  `Progreso`, `Evaluacion`, `Pregunta`, `Opcion`, `Intento`, `ComentarioLeccion`,
  `Logro`, `LogroUsuario`, `Certificado`, `NotaLeccion`.
- Gamificación (Etapa 6): `MovimientoGota` (ledger), `Mision`, `MisionUsuario`,
  `InsigniaSemanal`.
- Tienda (Etapa 7): `ItemTienda`, `CompraItem`, `InventarioItem`.
- `Usuario` (espejo con `neoId`, `rol`, `verificado`, `racha`, `ultimaActividad`,
  `gotasSaldo`, `gotasTotal`, `gotasMultiplicadorHasta`).

---

## El puente Neo4j ↔ PostgreSQL

- El JWT contiene el `id` de Neo4j (`req.user.id`).
- En PostgreSQL ese id vive en `Usuario.neoId`.
- Patrón estándar para cualquier ruta Postgres autenticada (`routes/courses.js`):

```js
async function loadCurrentUser(req, res) {
  if (req.dbUser) return req.dbUser;
  const usuario = await prisma.usuario.findUnique({ where: { neoId: req.user.id } });
  if (!usuario) {
    res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    return null;
  }
  req.dbUser = usuario;
  return usuario;
}
```

- Al registrar (`POST /api/auth/register`) se crea el `Usuario` en Neo4j y se
  replica el espejo en Postgres. Si el espejo falla, el registro **no** se rompe.
- Operaciones que deben aparecer en ambas DBs (inscripción, curso completado) usan
  **PostgreSQL como fuente de verdad** y propagan a Neo4j para queries sociales,
  vía `services/neo4j-sync.service.js`.

### Reglas de sincronización

| Operación | Fuente de verdad | Replicación |
|---|---|---|
| Registro de usuario | Neo4j | Espejo en `Usuario` Postgres con `neoId` |
| Cambio de rol / verificación | PostgreSQL | No replica (el rol no afecta queries sociales) |
| CRUD de curso | PostgreSQL | No replica |
| Inscripción a curso | PostgreSQL | `(:Usuario)-[:INSCRITO_EN]->(:CursoRef)` para recomendaciones |
| Curso completado | PostgreSQL | `(:Usuario)-[:COMPLETO_CURSO]->(:CursoRef)` + notif a seguidores |
| Lección completada, gotas | PostgreSQL | No replica |
| Post, like, comentario, follow | Neo4j | No replica |

---

## Variables de entorno

### `backend/.env`
```bash
NEO4J_URI=neo4j+s://XXXX.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=XXXXXXXXXX
DATABASE_URL=postgresql://user:password@host:5432/titi
JWT_SECRET=titi_secret_2026
PORT=3001
FRONTEND_URL=https://titiedu.vercel.app   # admite varias URLs separadas por coma (previews)
SEED_PASSWORD=titi1234
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### `frontend/.env`
```bash
VITE_API_URL=http://localhost:3001
```

---

## Modelos de datos

### Neo4j (canónico en `db.js` constraints)

```cypher
(:Usuario {id, username, email, password, bio, avatarUrl, createdAt})
(:Post {id, content, imageUrl, createdAt})
(:Comentario {id, text, createdAt})
(:Hashtag {name})
(:Notificacion {id, type, actorId, postId?, targetId?, read, createdAt})
(:Sonido {id, name, artist})
(:Ubicacion {id, city, country})
(:CursoRef {cursoId})

(:Usuario)-[:SIGUIO {createdAt}]->(:Usuario)
(:Usuario)-[:PUBLICO]->(:Post)
(:Usuario)-[:ESCRIBIO]->(:Comentario)-[:EN]->(:Post)
(:Comentario)-[:RESPONDE_A]->(:Comentario)
(:Usuario)-[:LE_GUSTO {likedAt}]->(:Post)
(:Usuario)-[:GUARDO {savedAt}]->(:Post)
(:Post)-[:TIENE_HASHTAG]->(:Hashtag)
(:Post)-[:USA_SONIDO]->(:Sonido)
(:Post)-[:ETIQUETADO_EN]->(:Ubicacion)
(:Usuario)-[:VIVE_EN]->(:Ubicacion)
(:Usuario)-[:RECIBIO]->(:Notificacion)-[:SOBRE]->(:Post|:Usuario)
(:Usuario)-[:INSCRITO_EN {fechaInscripcion}]->(:CursoRef)
(:Usuario)-[:COMPLETO_CURSO {fechaCompletado}]->(:CursoRef)
```

Constraints únicos: `Usuario.id`, `Usuario.username`, `Usuario.email`, `Post.id`,
`Hashtag.name`, `Comentario.id`, `Notificacion.id`, `Sonido.id`, `Ubicacion.id`,
`CursoRef.cursoId`.

### PostgreSQL (canónico en `backend/prisma/schema.prisma`)

Modelos: `Usuario`, `Categoria`, `Curso`, `CursoProfesor`, `Modulo`, `Leccion`,
`Material`, `Evaluacion`, `Pregunta`, `Opcion`, `Inscripcion`, `Progreso`,
`Intento`, `ComentarioLeccion`, `NotaLeccion`, `Logro`, `LogroUsuario`,
`Certificado`, `MovimientoGota`, `Mision`, `MisionUsuario`, `InsigniaSemanal`,
`ItemTienda`, `CompraItem`, `InventarioItem`.

Enums: `Rol` = `ESTUDIANTE|PROFESOR|ADMIN`; `TipoPregunta` =
`OPCION_MULTIPLE|VERDADERO_FALSO|RESPUESTA_CORTA`.

**Invariantes:**
- `Usuario.neoId` único — espejo del `Usuario.id` de Neo4j.
- `Inscripcion` único por `(usuarioId, cursoId)`.
- `Progreso` único por `(usuarioId, leccionId)`.
- `Curso.publicado=false` = borrador (no aparece en catálogo público).
- `Usuario.verificado` solo aplica a `PROFESOR`; requerido para crear cursos.
- `MisionUsuario` único por `(usuarioId, misionId, fecha)`.
- `InsigniaSemanal` único por `(usuarioId, semana)` (idempotencia del premio).
- `MovimientoGota` idempotente por `(usuarioId, motivo, refId)` en aprendizaje.

---

## Lógica de negocio

### Racha (`services/progress.service.js`)

Días consecutivos completando ≥1 lección o evaluación. `actualizarRacha(usuarioId)`:
hoy ya estudiado → no cambia; ayer → `racha+1`; gap → reinicia a 1. TZ del
servidor con `startOfDay`. La dispara: completar lección y aprobar evaluación.

### Logros (`services/achievement.service.js`)

Catálogo de 7 logros idempotente (`ensureLogrosCatalog`): Primera lección, Primer
curso, Racha 7 / 30 días, Primera evaluación, Perfecto (100%), Social (seguir 10).
`@@id([usuarioId, logroId])` previene duplicados. Se muestran en el perfil de
cualquier usuario.

### Gotas — economía (Etapa 6, `services/gotas.service.js`)

Las **gotas** son la XP de Titi. `gotasSaldo` (gastable en la tienda) +
`gotasTotal` (lifetime, nunca baja) + ledger `MovimientoGota` (positivo =
ganancia, negativo = gasto en la tienda).

| Acción | Motivo | Gotas | Tope diario |
|---|---|---|---|
| Completar lección | `leccion` | 10 | idempotente por lección |
| Aprobar evaluación | `evaluacion` | 20 | idempotente por evaluación |
| Completar curso | `curso` | 50 | idempotente por curso |
| Completar misión | `mision` | 10–20 | 3 misiones/día |
| Publicar post | `social_post` | 5 | 2/día |
| Recibir like | `social_like` | 1 | 10/día |
| Comentar | `social_comment` | 2 | 5/día |
| Seguir | `social_follow` | 3 | 3/día |
| Top ranking semanal | `ranking_semanal` | 50 | 1/semana |

- **Idempotencia (aprendizaje):** `(usuarioId, motivo, refId)` paga una sola vez.
- **Anti-farmeo (social):** al llegar al tope la acción sigue, pero no paga más ese día.
- Otorgar gotas incrementa `gotasSaldo` + `gotasTotal` y escribe `MovimientoGota`.
- Si `Usuario.gotasMultiplicadorHasta` está en el futuro, `otorgarGotas` duplica
  el monto (no aplica a `ranking_semanal`).
- `gastarGotas(usuarioId, cantidad, { motivo, refId })` (Etapa 7): valida saldo,
  **decrementa `gotasSaldo`** (nunca `gotasTotal`) y escribe un `MovimientoGota`
  negativo. Todo en transacción. Lo usa `tienda.service.js`.

### Tienda de gotas (Etapa 7, `services/tienda.service.js`, `routes/shop.js`)

Sumidero de la economía: consumibles que se compran con gotas y se acumulan en
un inventario por usuario. Modelos: `ItemTienda` (catálogo), `CompraItem`
(ledger de compras, auditoría), `InventarioItem` (saldo por ítem,
`@@unique([usuarioId, itemId])`).

- `comprarItem(usuarioId, codigo)`: transacción que valida ítem activo, saldo y
  `limiteStack`, debita gotas (`MovimientoGota` negativo + `gotasSaldo`),
  escribe `CompraItem` y suma 1 a `InventarioItem`. No usa `gastarGotas` para no
  partir la transacción.
- `consumirItem(usuarioId, codigo)`: decrementa 1 unidad si hay stock; la usan
  los efectos y `/api/shop/use`.

Catálogo inicial (`prisma/seed.js`) y sus efectos:

| Ítem | Precio | Efecto | Dónde se aplica |
|---|---|---|---|
| `congelar_racha` | 50 | Protege la racha 1 día sin actividad | `progress.service.js` → `actualizarRacha`, consumo **lazy** al detectar el gap |
| `intento_extra` | 80 | Un intento más en una evaluación bloqueada | `routes/evaluations.js` → `attempt`, si `usarIntentoExtra: true` en el body |
| `multiplicador_gotas` | 100 | x2 gotas por 1 hora | `POST /api/shop/use` → `activarMultiplicador` abre `gotasMultiplicadorHasta` |

Endpoints: `GET /api/shop/items` (catálogo + saldo + cantidad por ítem),
`GET /api/shop/inventory`, `POST /api/shop/buy`, `POST /api/shop/use` (solo
`multiplicador_gotas` — los otros dos se auto-consumen en su trigger).

### Misiones diarias (`services/mision.service.js`)

3 misiones/día desde un pool de templates, asignadas por usuario, reset a medianoche
(TZ server), idempotente por `(usuarioId, misionId, fecha)`. Cada una otorga gotas
al completarse. Avanzan con eventos reales (lección, evaluación, post, comentario, follow).

### Ranking de amigos semanal (`services/ranking.service.js`)

Leaderboard de gotas-de-la-semana entre la gente que sigo: cruce del follow-graph
de Neo4j ↔ gotas de Postgres (mismo patrón que el feed académico). Solo amigos.
`cerrarSemanaYPremiar` es **lazy** (sin scheduler): al primer acceso en una semana
nueva, si fui #1 de mi grupo la semana pasada → `InsigniaSemanal` + 50 gotas,
idempotente por semana.

### Mensajes de Titi

```js
const MENSAJES_TITI = {
  leccionCompletada:  ['¡Excelente trabajo! 🎉', '¡Sigue así, campeón! 💪'],
  evaluacionAprobada: ['¡Lo lograste! 🏆', '¡Sabía que podías! ⭐'],
  evaluacionFallida:  ['No te rindas, tienes más intentos 💙'],
  rachaActiva:        (dias) => `¡${dias} días seguidos! ¡Imparable! 🔥`,
  cursoCompletado:    ['¡Curso completado! Tu certificado está listo 🎓'],
};
```
**Regla:** la mascota se renderiza vía `<TitiMascot>` (WebP animado, fallback a
`/Titi.png`). Nunca el emoji 🐒.

### Reglas de borrado

| Acción | Comportamiento |
|---|---|
| Borrar `Post` | Cascada: comentarios, notificaciones, imagen del storage |
| Borrar `Curso` | **Bloquea (409)** si tiene inscripciones (despublicar primero). ADMIN puede forzar con cascada. Certificados se preservan (`cursoId` nullable + `cursoTitulo` snapshot) |
| Borrar `Modulo` | Cascada: lecciones, materiales, progresos, evaluación |
| Borrar `Leccion` | Cascada: materiales, progresos, comentarios, notas |
| Borrar `Material` | Borra el archivo del storage antes del row |

Cascadas manuales con transacción Prisma (no `onDelete: Cascade` en el schema).

### Permisos por rol

| Rol | Permisos |
|---|---|
| `ESTUDIANTE` | Inscribirse, completar lecciones, comentar, like/save, seguir, postear |
| `PROFESOR` verificado | + crear/editar/borrar cursos propios + subir materiales |
| `PROFESOR` no verificado | Como ESTUDIANTE. Crear curso → 403 |
| `ADMIN` | Todo + verificar profesores, cambiar roles, borrar cualquier recurso |
