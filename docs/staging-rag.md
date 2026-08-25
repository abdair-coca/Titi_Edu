# Staging RAG — guía operativa

## Objetivo

Probar flujo RAG completo sin tocar producción:

```text
frontend staging -> backend staging -> PostgreSQL/Neo4j staging
                  -> EmbeddingGemma staging -> AI Gateway staging -> Groq
```

## Recursos necesarios

- PostgreSQL staging con `pgvector`.
- Neo4j staging aislado.
- Cuenta docente/admin para reindexar.
- Cuenta estudiante `student@gmail.com`.
- Curso, módulo y lección publicados.
- Servicio EmbeddingGemma con URL HTTPS y API key interna.
- Servicio AI Gateway con token interno.
- Cuenta Groq y modelo habilitado.
- Cuenta Hugging Face con licencia Gemma aceptada.

## Configuración

Usar plantillas:

- `backend/.env.staging.example`
- `ai-gateway/.env.staging.example`
- `embedding-service/.env.staging.example`
- `render.staging.yaml`

Copiar cada plantilla como `.env.staging` solo para ejecución local. En Render,
cargar valores en variables privadas del servicio. Nunca subir secretos al repo.

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
2. Crear Neo4j staging y configurar sus credenciales.
3. Crear usuario docente/admin y `student@gmail.com`.
4. Publicar curso, módulo y lección.
5. Desplegar EmbeddingGemma y verificar `GET /health` con dimensión `768`.
6. Desplegar AI Gateway y verificar `GET /health`.
7. Desplegar backend y configurar URL/token de ambos servicios.
8. Reindexar curso con usuario docente/admin.
9. Confirmar documentos `LISTO` y fragmentos almacenados.
10. Abrir lección con `student@gmail.com` y probar Tutor.

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
