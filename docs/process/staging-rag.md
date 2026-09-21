# Staging RAG — referencia heredada

El rollout BYOK vigente va directo a producción. No usa base PostgreSQL staging,
branch Neon separada, Neo4j staging, backend staging, gateway propio ni servicio local
de embeddings. La fuente operativa es
[produccion-rag-byok.md](produccion-rag-byok.md).

`render.staging.yaml` y `backend/.env.staging.example` se conservan solo como ejemplos
apagados para un futuro entorno aislado. No representan infraestructura activa ni
deben apuntar a Neon main, Neo4j productivo o secretos productivos.

Si en el futuro se reactiva staging, debe cumplir antes:

- DB y Neo4j aislados, con datos sintéticos o autorizados;
- `autoDeploy: false`, `RAG_ENABLED=false` y `RAG_CHAT_ENABLED=false` al crear recursos;
- `RAG_COURSE_IDS` explícito; nunca `*`;
- allowlist sin correos dentro del repositorio;
- BYOK por usuario, keyring propio y secretos distintos de producción;
- Cloudflare Workers AI y AI Gateway administrados; no servicios legacy en memoria;
- plan de borrado de datos y credenciales al cerrar el entorno.

No ejecutar scripts de reindexado contra datos compartidos sin confirmar destino,
alcance y autorización de escritura.
