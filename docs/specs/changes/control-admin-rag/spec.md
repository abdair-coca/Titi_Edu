# Spec — Panel de Control y Monitoreo RAG para Administradores

## U1 — Backend: Endpoints Administrativos RAG

### Requisitos Funcionales

1. **Listado general y métricas:**
   - Endpoint: `GET /api/admin/rag/lessons`
   - Seguridad: `requireAuth` + `requireRole('ADMIN')`.
   - Filtra exclusivamente por lecciones publicadas (`PUBLICADA` en módulos y cursos publicados).
   - Parámetros de consulta (`query`):
     - `page`: Número de página (default: 1).
     - `pageSize`: Elementos por página (default: 20, máx: 100).
     - `courseId` (opcional): Filtro por UUID de curso.
     - `status` (opcional): `LISTO`, `FALLIDO`, `PENDIENTE`, `SIN_INDEXAR`.
     - `search` (opcional): Búsqueda por título de lección o curso.
   - Formato de respuesta:
     ```json
     {
       "success": true,
       "data": {
         "lessons": [
           {
             "id": "uuid",
             "titulo": "string",
             "orden": 1,
             "estado": "PUBLICADA",
             "modulo": { "id": "uuid", "titulo": "string", "curso": { "id": "uuid", "titulo": "string", "publicado": true } },
             "recursoHtml": { "id": "uuid", "evaluable": false },
             "documentoRag": {
               "id": "uuid",
               "version": 1,
               "estado": "LISTO",
               "activo": true,
               "modelo": "google/embeddinggemma-300M",
               "error": null,
               "indexadoAt": "2026-09-05T12:00:00.000Z",
               "fragmentosCount": 4
             }
           }
         ],
         "total": 50,
         "page": 1,
         "pageSize": 20,
         "summary": {
           "totalLessons": 50,
           "ready": 45,
           "failed": 2,
           "pending": 1,
           "unindexed": 2
         }
       }
     }
     ```

2. **Auditoría de fragmentos y simulador semántico:**
   - Endpoint: `GET /api/admin/rag/lessons/:lessonId/fragments`
   - Seguridad: `requireAuth` + `requireRole('ADMIN')`.
   - Recupera el documento activo de la lección y todos sus fragmentos textuales ordenados por `orden` ascendente (excluyendo el array pesado de float `embedding`).
   - Endpoint: `POST /api/admin/rag/lessons/:lessonId/test-query`
     - Permite al admin enviar un mensaje o pregunta de prueba (`{ query: string }`) y obtener los top chunks recuperados con sus respectivos puntajes de similitud de coseno, sin consumir tokens del LLM ni invocar al modelo generador.

3. **Reindexación sincrónica individual y hooks automáticos:**
   - Endpoint: `POST /api/admin/rag/lessons/:lessonId/reindex`
   - Seguridad: `requireAuth` + `requireRole('ADMIN')`.
   - Ejecuta `indexLesson(lessonId)` de forma **sincrónica** e inmediata, retornando el resultado al instante para que la fila en la UI actualice su estado con feedback inmediato.
   - **Garantía de indexación automática:**
     - Indexación automática de lecciones al publicar, actualizar o subir HTML (`scheduleLessonIndex`).
     - Hook de indexación automática al publicar un curso completo (`PUT /courses/:id/publish` en `admin.js`, `courses.js` y `authoring.js`), asegurando que ningún curso publicado quede sin procesar.
     - Operación por defecto sobre todos los cursos publicados (`RAG_COURSE_IDS=*` o automático).

### Escenarios de Prueba Backend
- **DADO** un usuario con rol `ADMIN` **CUANDO** solicita `GET /api/admin/rag/lessons` **ENTONCES** recibe el listado paginado y el resumen de métricas globales.
- **DADO** un usuario con rol `ESTUDIANTE` o `PROFESOR` **CUANDO** solicita cualquier endpoint bajo `/api/admin/rag/*` **ENTONCES** recibe `403 Forbidden`.
- **DADO** una lección con estado `FALLIDO` **CUANDO** el administrador ejecuta `POST /api/admin/rag/lessons/:id/reindex` **ENTONCES** se regeneran los embeddings y el estado pasa a `LISTO`.

---

## U2 — Frontend: Panel de Control RAG (`AdminRag.jsx`)

### Requisitos de Interfaz

1. **Métricas clave (KPIs):**
   - Tarjetas planas superiores: Total de lecciones, Indexadas (`LISTO`), Fallidas (`FALLIDO`), Pendientes/Sin indexar.
2. **Barra de control y filtros:**
   - Selector desplegable de Cursos (para aislar un curso en particular).
   - Selector de Estados (`Todos`, `Listos`, `Con error`, `Sin indexar`).
   - Campo de búsqueda por texto.
   - Botón de refresco manual de la vista.
3. **Tabla de lecciones:**
   - Columnas: Curso / Módulo, Lección, Estado, Última indexación, Modelo, Fragmentos, Acciones.
   - Badges de estado:
     - `LISTO`: Verde suave (`bg-green-100 text-green-800`).
     - `FALLIDO`: Rojo suave (`bg-red-100 text-red-800`) con visualización del mensaje de error.
     - `PENDIENTE`: Amarillo (`bg-yellow-100 text-yellow-800`).
     - `SIN INDEXAR`: Gris (`bg-gray-100 text-gray-700`).
   - Acciones por fila:
     - **Reindexar:** Dispara la reindexación individual con indicador de carga.
     - **Ver fragmentos:** Abre el modal de inspección de contenido.
4. **Modal de Inspección de Fragmentos (`RagFragmentsModal`):**
   - Título de la lección y metadata (modelo usado, fecha de indexación, hash).
   - Lista numerada de los fragmentos con su contenido textual exacto tal como está indexado en la base de datos.
5. **Navegación:**
   - Ruta `/admin/rag` registrada en `App.jsx` bajo el layout protegido `AdminOnly`.
   - Tarjeta en `AdminDashboard.jsx`: `PANELS` con enlace a `/admin/rag`.
