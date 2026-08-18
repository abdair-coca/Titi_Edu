---
name: titi-authoring
description: Workflow óptimo de autoría de cursos con el MCP titi-authoring (ahorro de tokens + evitar errores 412/500/409). Úsalo antes de crear o editar cursos, módulos, lecciones, quizzes o materiales, y para publicar/despublicar contenido. Disparadores - "crear curso", "agregar lección", "agregar módulo", "quiz", "crear quiz", "publicar curso", "publicar módulo", "editar contenido curso", "MCP titi-authoring", "authoring API", "fingerprint", "subir material", "despublicar".
---

# Autoría de cursos — MCP `titi-authoring`

Workflow ÓPTIMO para crear/editar cursos vía MCP `titi-authoring`. Cada regla
de oro evita errores concretos del backend. Si se sigue la secuencia tal cual,
se ahorra tokens (no se re-lee contenido completo) y no se pisan fingerprints.

## Tools del MCP disponibles

### Lectura
- `list_courses` — cursos del autor (identificar curso por id).
- `list_categories` — categorías disponibles (para `categoriaId`).
- `get_course` — snapshot COMPLETO del curso + fingerprints de todos los recursos.
  Pesado. SOLO cuando hace falta el contenido (no entre writes).
- `get_quiz_analytics` — analytics agregados de un quiz.

### Lectura barata (fingerprints-only)
- `get_course_fingerprints` — devuelve SOLO `{ fingerprint, publicationFingerprint, resources }` del curso.
- `get_module_fingerprints` — SOLO `{ fingerprint, publicationFingerprint, resources }` del módulo.

**USAR estos entre writes en vez de `get_course` completo** → menos tokens, menos payload.

### Writes
- `create_course_draft`, `update_course_draft`
- `create_module_draft`, `update_module_draft`
- `create_lesson_draft`, `update_lesson_draft` — aceptan `formatoContenido: MARKDOWN|HTML`
  (por defecto MARKDOWN si no se pasa).
- `upsert_lesson_html` — sube/reemplaza el HTML de una lección HTML (`POST /lessons/:id/html`).
  Acepta `html` (autocontenido, <1MB), `evaluable`, `intentosMax` (1-10, requerido si evaluable).
  El HTML evaluable envía score a Titi (`TITI_SCORE` postMessage). Ver skill `titi-html-authoring`.
- `upsert_quiz_draft`
- `attach_material`
- `delete_draft_resource`

### Publicación
- `preview_course_publication`, `preview_module_publication`
- `publish_course`, `publish_module`
- `preview_module_unpublish`, `unpublish_module`

## Reglas de oro (evitan ~90% de errores)

### 1. Fingerprint fresco ANTES de cada write
Cada write incrementa la versión del módulo y del curso padre → **TODOS los
fingerprints cambian**. Usar un fingerprint viejo → `412 "El recurso cambió desde
la última lectura"`.

- Regla: `get_course_fingerprints` (o `get_module_fingerprints`) INMEDIATAMENTE
  antes de cada write, para sacar el `fingerprint` actual.
- Tras un upsert exitoso, el fingerprint del módulo cambió → re-leer siempre.

### 2. Estructura de recursos: el fingerprint correcto por write
Para un write a un recurso del curso (módulo/lección/quiz/material), el
`expectedFingerprint` correcto es el del **RECURSO**, no del curso.

| Write | `expectedFingerprint` de |
|---|---|
| Módulo | fingerprint del módulo (`resources[moduleId]` en respuesta de curso, o `get_module_fingerprints`) |
| Quiz de módulo | fingerprint del módulo |
| Lección | fingerprint de la lección individual |
| HTML de lección (`upsert_lesson_html`) | fingerprint de la lección individual |
| Material | fingerprint del material individual |
| `delete_draft_resource` | fingerprint del recurso individual |
| Curso | fingerprint del curso |

Si el fingerprint de un recurso no está expuesto por separado, `get_course`
(snapshot completo) es el fallback para leerlo.

### 3. Idempotency
- Cada write acepta `idempotencyKey` (UUID).
- Si no se pasa, el MCP la genera automáticamente.
- Tras timeout o resultado desconocido: REUSAR la misma key → no duplicar.

### 4. Publish requiere preview reciente
- `preview_*_publication` devuelve `phrase` + `confirmationToken` + `fingerprint`.
- `publish_*` SOLO con esos 3 datos de UN preview previo.
- NUNCA encadenar preview + publish en una sola llamada.
- NUNCA publicar sin verificación humana previa de la phrase/fingerprint.

### 5. Quiz limit — máx 4 preguntas por upsert
- Backend falla con `500` si el quiz trae **5+ preguntas** en una sola llamada
  (límite Neon/PgBouncer en transacciones).
- Máximo **4 preguntas** por `upsert_quiz_draft`.
- Quizzes grandes → múltiples upserts secuenciales, re-leyendo fingerprint entre
  cada uno, o partir en varios quizzes.
- Nota: el 500 no deja registrada la operación (el fingerprint queda intacto).

### 6. Evaluación bloqueada
- No se puede modificar una evaluación que ya tiene intentos → `409`.

### 7. Solo borradores
- No se edita contenido de cursos/módulos publicados → `409`.
- Despublicar módulo (`preview_module_unpublish` + `unpublish_module`) antes de editar.

## Secuencia típica óptima (ahorro de tokens)

```
1. list_courses → list_categories          # identificar curso y categoría
2. get_course_fingerprints                  # fingerprint actual (barato)
3. WRITE 1   (idempotencyKey + expectedFingerprint del recurso)
4. get_course_fingerprints / get_module_fingerprints   # refrescar tras el write
5. WRITE 2   ... repetir
6. Solo si necesitás contenido completo: get_course
7. Al terminar: preview_*_publication → verificar phrase/token/fingerprint con humano → publish
```

## Respuesta API

- Éxito: `{ success, data }`.
- Error: `{ success: false, message }` (en español).
- El MCP envuelve esto en `structuredContent`.

## Errores y qué significan

| Código | Causa | Fix |
|---|---|---|
| `412` | Fingerprint viejo | Re-leer fingerprints antes del write |
| `409` | Evaluación con intentos, o recurso publicado | Despublicar primero / no editar |
| `500` | Quiz con 5+ preguntas | Máx 4 preguntas por `upsert_quiz_draft` |

## Skills hermanas

- `titi-dual-db` — dónde vive cada dato (Neo4j vs Postgres).
- `titi-backend-patterns` — código backend de cursos si hay que tocarlo.
- `titi-orientation` — mapa general del repo.
