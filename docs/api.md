# API REST — Titi

Catálogo de endpoints. Montaje real en `backend/src/app.js`. Para modelos y reglas
ver [architecture.md](architecture.md).

---

## Convención de respuestas

```js
res.json({ success: true, data: { ... } });                      // éxito
res.status(4xx|5xx).json({ success: false, message: '...' });    // error (en español)
```

Códigos: `200/201/202` ok/aceptado · `400` validación · `401` no autenticado ·
`403` sin permiso · `404` no encontrado · `409` conflicto · `422` semántica ·
`429` cuota · `502/504` proveedor · `503` no disponible · `500` interno.

Readiness público para gates de despliegue:

```http
GET /api/ready
```

Responde `200` cuando todas las dependencias requeridas están listas:

```json
{"success":true,"data":{"status":"ready","checks":{"postgres":"ok","neo4j":"ok","pgvector":"ok","rag":"ok","keyring":"ok"}}}
```

Responde `503` con la misma forma y checks sanitizados cuando alguna dependencia no
está lista, por ejemplo:

```json
{"success":false,"data":{"status":"not_ready","checks":{"postgres":"ok","neo4j":"ok","pgvector":"ok","rag":"error","keyring":"ok"}}}
```

Nunca expone URLs, secretos ni errores internos.

Montaje (`app.js`): `/api/auth`, `/api/users`, `/api/posts`, `/api/search`,
`/api/comments`, `/api/notifications`, `/api/sounds`, `/api/locations`,
`/api/courses`, `/api` (modules+lessons+materials+evaluations), `/api/categories`,
`/api/progress`, `/api/admin`, `/api/gotas`, `/api/missions`, `/api/ranking`,
`/api` (RAG tutor y reindexado autorizado).

---

## Auth — `/api/auth`
```
POST /register   → { user, token }   Crea Usuario en Neo4j + espejo en Postgres
POST /login      → { user, token }   Verifica password, fusiona rol/racha/gotas
GET  /me         → { user }          Perfil completo del JWT actual
```

## Red social (Neo4j)
```
GET  /api/users/me                   Perfil propio con stats
GET  /api/users/:username            Perfil público (isFollowing/isSelf)
POST /api/users/:username/follow | /unfollow
PUT  /api/users/me/location

GET  /api/posts/feed                 Posts de gente que sigo (cursor por createdAt)
GET  /api/posts/feed/academic        Actividad de cursos de gente que sigo
GET  /api/posts/explore              Posts públicos recientes (cursor)
GET  /api/posts/me/saved | /me/liked
POST /api/posts                      Crear post (multipart, imagen opcional)
POST /api/posts/:id/like | /save     Toggle
PUT  /api/posts/:id                  Editar contenido
DELETE /api/posts/:id

POST /api/comments                   Crear comentario
DELETE /api/comments/:id

GET  /api/notifications
GET  /api/notifications/unread/count
GET  /api/search                     Usuarios, posts, hashtags
```

## Cursos — `/api/courses`
```
GET    /                   Catálogo público (?categoria= ?nivel= ?search=)
GET    /:id                Detalle (módulos + lecciones + categoría + creador)
POST   /                   Crear (PROFESOR verificado)
PUT    /:id                Editar (autor)
DELETE /:id                Borrar (autor; 409 si tiene inscripciones)
POST   /:id/publish | /unpublish
POST   /:id/enroll         Inscribirse (ESTUDIANTE) → propaga a Neo4j
GET    /:id/progress       Mi progreso en el curso
GET    /my/enrolled | /my/teaching
GET    /recommended        Cursos que tomaron mis amigos y yo no
```

## Módulos / Lecciones — `/api/courses/:id/modules`, `/api/modules`, `/api/lessons`
```
GET    /api/courses/:courseId/modules
POST   /api/courses/:courseId/modules       Crear módulo (autor)
PUT    /api/modules/:id                      DELETE /api/modules/:id (cascada)
GET    /api/modules/:id/lessons
POST   /api/modules/:moduleId/lessons        Crear lección (autor)
GET    /api/lessons/:id                       PUT / DELETE (autor)
POST   /api/lessons/:id/complete             Completar → racha + logros + gotas + misiones
GET    /api/lessons/:id/comments              POST (auth)
GET    /api/lessons/:id/note                  Nota personal privada (auth)
PUT    /api/lessons/:id/note                  Guardar/actualizar nota (máx 5000 chars)
```

## Materiales — `/api/materials`
```
POST   /api/lessons/:lessonId/materials   Subir (multipart, autor) — pdf|word|imagen|codigo|otro, 10 MB
DELETE /api/materials/:id                 Borrar (autor) — borra archivo del storage
```

## Tutor RAG — `/api/lessons/:id/chat`

Disponible para usuarios autenticados con acceso al curso, en lecciones publicadas y
cursos incluidos explícitamente en `RAG_COURSE_IDS`. En modo productivo
`user_required`, todos los roles usan su propia credencial Groq; no hay clave global.
El retrieval usa únicamente documentos activos y publicados del curso.

```
GET  /api/lessons/:id/chat/status          Estado de flag e indexado (auth)
POST /api/lessons/:id/chat                 { message, intent?, history? } → { answer, citations, relatedLesson, usage }
```

El `GET status` conserva `enabled`, `indexed` y `status`, y agrega metadata segura:

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "indexed": true,
    "status": "LISTO",
    "credential": {
      "required": true,
      "configured": true,
      "status": "VALID",
      "last4": "abcd"
    }
  }
}
```

`credential.status` es `VALID`, `INVALID` o `null`; `last4` es `null` si no existe.
El body de `POST chat` no cambia. Errores relevantes: `400` body/intención/historial
inválido, `401` sin sesión, `403` sin acceso/audiencia, `404` lección o feature no
habilitada, `409` credencial requerida ausente, `422` credencial inválida, `429`
cuota, `502/504` proveedor y `503` configuración o chat apagado.

### Credencial Groq BYOK — `/api/rag/credentials/groq`

Todas las operaciones requieren JWT y responden `Cache-Control: no-store`.

```http
GET /api/rag/credentials/groq
PUT /api/rag/credentials/groq
Content-Type: application/json

{"apiKey":"<clave-personal>"}

DELETE /api/rag/credentials/groq
```

`GET` y `PUT` responden solo metadata:

```json
{
  "success": true,
  "data": {
    "provider": "groq",
    "configured": true,
    "status": "VALID",
    "last4": "abcd",
    "validatedAt": "2026-09-20T12:00:00.000Z",
    "updatedAt": "2026-09-20T12:00:00.000Z"
  }
}
```

`status` es `VALID`, `INVALID` o `null`; `last4`, `validatedAt` y `updatedAt` pueden ser
`null`. `DELETE` responde `{"success":true,"data":{"deleted":true}}`, exista o no
un registro previo. La API nunca devuelve la clave completa ni ciphertext.

Errores: `400` `apiKey` ausente/malformada, `401` sin sesión, `422` clave inválida o
sin acceso al modelo, `429` límite de validación, `502/504` fallo/timeout de Groq y
`503` keyring no disponible.

### Operación y reindexado RAG

```http
GET  /api/admin/rag/operations                         ADMIN
POST /api/admin/rag/lessons/:lessonId/reindex          ADMIN
POST /api/admin/rag/courses/:courseId/reindex          autor/profesor/ADMIN
```

`GET operations` devuelve conteos agregados `jobs`, `credentials`,
`usageToday: { chatRequests }` y `readiness`; no incluye claves, prompts o respuestas.

Los dos endpoints de reindexado encolan trabajo durable y responden `202`. Una lección
devuelve metadata de job `id`, `leccionId`, `status`, `requestedAt`, `nextAttemptAt` y
`attempts`. Un curso devuelve `courseId`, `total`, `status: "QUEUED"` y `results` con
esa metadata por lección publicada. Repetir una solicitud coalesce por lección; el
worker usa lease, reintentos y estado durable en PostgreSQL.

Errores de reindexado: `400` lección no publicada, `401` sin sesión, `403` sin permiso,
`404` recurso inexistente, `409` curso fuera de la allowlist y `500` error interno
sanitizado.

`intent` es opcional y acepta `DUDA`, `EXPLICAR`, `EJEMPLO`, `RESUMEN`, `PRACTICA`,
`PISTA` o `RETROALIMENTAR`; si se omite usa `DUDA`. Un valor desconocido responde
`400`. Las intenciones formativas no modifican notas, progreso ni inscripciones.
`PRACTICA` entrega una sola consigna sin solución; el siguiente turno puede enviar
`RETROALIMENTAR` con la respuesta del estudiante para recibir feedback cualitativo y
un próximo paso, sin crear un `Intento` oficial.

El chat acepta `history` opcional: últimos N turnos `user`/`assistant` de la
conversación de la lección. El backend es stateless — no persiste la conversación;
el historial se envía al modelo como contexto no confiable y los dos turnos más
recientes también ayudan a desambiguar el retrieval. `history` debe ser una lista;
turnos inválidos se descartan y se recorta a los más recientes
(`RAG_CHAT_HISTORY_LIMIT`, default 8). Una pregunta actual duplicada al final se
elimina antes de construir el prompt.

La recuperación es híbrida: combina similitud vectorial (pgvector) con full-text
(`tsvector`) de PostgreSQL para atrapar nombres y términos exactos. Si el full-text
falla, se cae a recuperación vectorial pura. Cuando la evidencia de la lección
activa es débil, también puede recuperar material de otra lección publicada del
mismo curso usando el mismo embedding de consulta; nunca cruza de curso.

El chat devuelve `No encontré evidencia suficiente...` cuando no hay fragmentos
recuperables. Con evidencia parcial responde lo respaldado y aclara qué parte no
cubre el material. `citations` identifica `number`, `chunkId`, `lessonId`, `title`,
`moduleTitle`, `excerpt`, `similarity` y `reusedFromHistory`. `relatedLesson` es
`null` salvo que la respuesta cite realmente una fuente de otra lección del mismo
curso; cuando existe contiene `lessonId`, `title` y `moduleTitle` de la sugerencia
principal. Una fuente recuperada pero no citada no genera esta sugerencia. Cuando el retrieval
nuevo no encuentra evidencia y la pregunta es una continuación, el backend puede
reusar citas de los dos turnos recientes solo después de validar el `chunkId` contra
la lección publicada, documento activo y curso actual. La interfaz muestra la fuente
publicada y no presenta el score técnico como porcentaje de relevancia. El contexto de aprendizaje enviado al
modelo es efímero y agregado: estado de lección, avance de curso/módulo y banda de
desempeño, sin PII, notas, respuestas ni datos de otros estudiantes. El tutor no
tiene endpoints para modificar notas, progreso o inscripciones.

## Categorías — `/api/categories`
```
GET    /     Lista pública    ·    POST  / (ADMIN)
```

## Evaluaciones — `/api/evaluations`
```
POST   /api/modules/:id/evaluation          Crear evaluación de módulo (autor)
POST   /api/courses/:id/final-evaluation    Crear evaluación final (autor)
GET    /api/evaluations/:id                 Detalle (sin respuestas correctas para estudiantes)
POST   /api/evaluations/:id/attempt         Intento — calificación server-side; aprobar → gotas
GET    /api/evaluations/:id/my-attempts
```

## Progreso / racha / logros / certificados — `/api/progress`
```
GET    /api/progress/streak                        Mi racha
GET    /api/progress/achievements                  Mis logros
GET    /api/progress/:username/achievements | /streak   Públicos
GET    /api/progress/certificates                  Mis certificados
GET    /api/progress/certificate/:courseId
GET    /api/progress/certificates/verify/:codigo   Público (sin auth)
```

## Gamificación (Etapa 6)
```
GET  /api/gotas              → { saldo, total, semana }
GET  /api/gotas/history      → movimientos paginados (cursor por createdAt)
GET  /api/missions/today     → 3 misiones de hoy con progreso (asigna si faltan)
GET  /api/ranking/friends    → leaderboard semanal de amigos + mi posición (dispara premio lazy)
```

## Admin — `/api/admin` (requireRole ADMIN)
```
GET /users · PUT /users/:id/verify · PUT /users/:id/role
GET /courses (incl. borradores) · PUT /courses/:id/approve · DELETE /courses/:id (cascada forzada)
GET /stats · POST /categories
```

## Lecciones HTML � `/api/authoring/lessons/:id/html`

```http
POST /api/authoring/lessons/:id/html
Idempotency-Key: <key>

{
  "expectedFingerprint": "<fingerprint de la lecci�n>",
  "html": "<!doctype html><html>...</html>",
  "evaluable": true,
  "intentosMax": 2,
  "fechaLimite": "2030-01-01T00:00:00.000Z"
}
```

Requiere `content:write`, creador/ADMIN. Una leccion tiene un
solo recurso HTML; este endpoint lo crea o reemplaza y conserva CAS + idempotencia.
`intentosMax` es obligatorio entre `1` y `10` solo si `evaluable` es `true`.
`fechaLimite` es opcional: acepta ISO UTC o `null` para quitar el plazo. Solo aplica
a recursos HTML evaluables.


Para cambiar solo la fecha limite de una presentacion HTML existente, sin volver a
subir el archivo:

```http
PUT /api/authoring/lessons/:id/html-deadline
Idempotency-Key: <key>

{
  "expectedFingerprint": "<fingerprint de la leccion>",
  "fechaLimite": "2030-01-01T00:00:00.000Z"
}
```

Este endpoint permite actualizar o quitar (`null`) el plazo de una presentacion
publicada que ya tenga estudiantes y conserva revisiones, entregas e idempotencia.
La leccion archivada debe restaurarse antes de editarla. Solo aplica a recursos HTML
evaluables.

`GET /api/lessons/:id/html` devuelve el HTML �nicamente a usuarios autorizados; no
existe URL p�blica. El servidor exige documento autocontenido, recursos inline o
`data:`, sin red externa, formularios, frames, `srcset` ni `meta http-equiv`, e
inyecta CSP restrictiva. El frontend usa `iframe srcDoc sandbox="allow-scripts"`.

Para HTML evaluable, `GET /api/lessons/:id/html` devuelve un token temporal junto
con `remainingAttempts` y `attemptsExhausted`; cargar o recargar la página no crea
un intento. `POST /api/lessons/:id/html-attempts` sigue disponible por compatibilidad
y también devuelve un token temporal sin consumir cupo. La actividad env�a:

```js
window.parent.postMessage({
  source: 'titi-html',
  type: 'TITI_SCORE',
  score: 0, // 0..100
  attemptToken: window.__TITI_ATTEMPT_TOKEN,
}, '*');
```

El player valida `event.source === iframe.contentWindow`, tipo, rango y token; no
conf�a en `event.origin`. Luego env�a `{ score, attemptToken }` a
`POST /api/lessons/:id/html-results`. Este endpoint persiste intento, puntaje y
progreso en una sola transacción; reintentar mismo token es idempotente. Solo
intentos con `puntaje` registrado consumen cupo. El puntaje es pr�ctica/autodeclarado,
no nota oficial ni credencial.
Cuando `fechaLimite` existe, respuestas incluyen `fechaLimite` y
`fechaLimiteExpirada`; contenido y resultados previos siguen disponibles después
del vencimiento, pero nuevas entregas son rechazadas por hora del servidor.
Evaluaciones aceptan mismo campo `fechaLimite` en operaciones de autoría.


## Cursos vivos

Las lecciones usan estados `BORRADOR`, `PUBLICADA` y `ARCHIVADA`. La autor?a vive en `/api/authoring`: `POST /lessons/:id/publish`, `POST /lessons/:id/archive`, `POST /lessons/:id/restore`, `GET /lessons/:id/revisions` y `POST /lessons/:id/revisions/:revisionId/restore`. Todas las mutaciones requieren `Idempotency-Key` y `expectedFingerprint`. Publicar una primera lecci?n activa su m?dulo. Estudiantes solo reciben lecciones publicadas; `GET /api/courses/:id/progress` conserva `total/completadas/porcentaje` como progreso base e informa `nuevasPendientes`. Certificados ya emitidos no se recalculan.
