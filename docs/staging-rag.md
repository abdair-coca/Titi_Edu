# Staging RAG — guía operativa

## Objetivo

Probar flujo RAG completo sin tocar producción:

```text
frontend staging -> backend staging -> PostgreSQL/Neo4j staging
                  -> EmbeddingGemma staging -> AI Gateway staging -> Groq
```

## Ruta recomendada: híbrida

Para primer piloto no desplegamos Render. Usamos DBs staging administradas y
servicios de aplicación locales:

```text
Neon branch + Neo4j Aura existente
              ↓
backend + frontend + gateway + EmbeddingGemma locales
```

`render.staging.yaml` queda preparado para una etapa posterior. No es necesario
para validar RAG E2E ahora.

Neo4j queda compartido temporalmente porque no se creará otra instancia. Esto
reduce setup, pero no aísla datos sociales. No ejecutar borrados, seed global ni
scripts destructivos contra ese grafo.

## Recursos necesarios

- PostgreSQL staging con `pgvector`.
- Credenciales de instancia Neo4j existente.
- Cuenta docente/admin para reindexar.
- Cuenta estudiante `student@gmail.com`.
- Curso, módulo y lección publicados.
- EmbeddingGemma local funcionando en `127.0.0.1:8001`.
- AI Gateway local funcionando en `127.0.0.1:8080`.
- Cuenta Groq y modelo habilitado.
- Cuenta Hugging Face con licencia Gemma aceptada.

## Configuración

Usar plantillas híbridas:

- `backend/.env.staging.example`
- `ai-gateway/.env.staging.example`
- `embedding-service/.env.staging.example`
- `render.staging.yaml`

Copiar cada plantilla como `.env.staging` solo para ejecución local. Nunca subir
secretos al repo. Render se configura después, si el piloto local sale verde.

Backend staging debe usar:

```env
RAG_ENABLED=true
RAG_COURSE_IDS=*
RAG_ALLOWED_USER_EMAIL=student@gmail.com
RAG_CHAT_MODE=gateway
```

`RAG_COURSE_IDS=*` vuelve indexables todos cursos publicados. No indexa borradores.
`student@gmail.com` debe existir en ambas DB y estar inscrito en curso.

## Orden de ejecución

1. Crear DB PostgreSQL staging y aplicar `npx prisma migrate deploy`.
2. Configurar credenciales de Neo4j existente y verificar conexión sin mutar datos.
3. Verificar usuario docente/admin y `student@gmail.com` en ambas DB.
4. Verificar curso, módulo, lección publicada e inscripción en Neon staging.
5. Levantar EmbeddingGemma y verificar `GET /health` con dimensión `768`.
6. Levantar AI Gateway y verificar `GET /health`.
7. Levantar backend con `.env.staging`.
8. Levantar frontend apuntando a backend local.
9. Reindexar curso con usuario docente/admin; esto escribe solo documentos RAG en Neon.
10. Confirmar documentos `LISTO` y fragmentos almacenados.
11. Abrir lección con `student@gmail.com` y probar Tutor.

## E2E backend

Desde `backend/`:

```powershell
$env:RAG_E2E_ALLOW_DB_WRITE='true'
$env:RAG_E2E_USE_MOCKS='false'
$env:RAG_E2E_COURSE_ID='<STAGING_COURSE_ID>'
$env:RAG_E2E_ADMIN_USERNAME='<STAGING_ADMIN_USERNAME>'
$env:RAG_E2E_STUDENT_EMAIL='student@gmail.com'
npm run test:e2e:rag
```

La prueba confirma reindexado, documentos listos, fragmentos, chat, citas y
permisos del estudiante piloto.

## Validación manual

- Usuario piloto ve Tutor.
- Usuario piloto recibe respuesta con fuentes.
- Pregunta fuera del material devuelve fallback sin evidencia.
- Otro estudiante recibe `403`.
- Estudiante sin inscripción recibe `403`.
- Admin/docente puede reindexar.
- Curso no publicado no se indexa.

## Rollback

En backend staging:

```env
RAG_ENABLED=false
```

O retirar curso de `RAG_COURSE_IDS`. Producción no debe usar `*` ni habilitar RAG
hasta contar con gateway Redis y embedding remoto estable.
