# Evaluación de la búsqueda del Tutor RAG

Mide si la búsqueda del tutor encuentra el fragmento que responde cada pregunta del
golden set. No llama al modelo de respuestas (Groq) y no corre en CI. Para medir las
respuestas, ver "Medir respuestas con Groq" al final.

## Preparar

1. Postgres local con pgvector (cualquier puerto local):

   ```bash
   docker run -d --name titi-rag-eval -e POSTGRES_PASSWORD=test -p 127.0.0.1:55434:5432 pgvector/pgvector:pg16
   ```

2. Copia del curso piloto en `eval/rag/data/course.json` (fuera de git). Se exporta en
   solo lectura desde la base real; contiene lecciones y contexto autoral, sin usuarios
   ni notas.
3. `backend/.env` con `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_API_TOKEN` y
   `EMBEDDING_MODEL`. El script no usa el `DATABASE_URL` de ese archivo.

## Correr

```bash
npm run eval:rag -- --variants produccion,actual --split dev
```

- `--variants`: nombres de `variants.mjs`. `produccion` usa el código del tutor tal cual
  (`prepareLessonFragments` y `retrieveLessonContext`); `actual` es la indexación anterior,
  como referencia.
- `--split`: `dev` (para ajustar), `holdout`, `holdout2` y `holdout3` (solo para confirmar al final) o `all`.
- `--db`: base local; rechaza cualquier host que no sea `localhost` o `127.0.0.1`.
- Los embeddings quedan en `eval/rag/.cache/` y los resultados por pregunta en
  `eval/rag/results/`.

## Golden set

`golden-set.json`: cada pregunta tiene la lección abierta, su categoría y grupos de
evidencia. Cada grupo lista frases literales del material (`"L22: frase"`); un fragmento
es útil si contiene alguna. Una pregunta sin `evidence` no tiene respuesta en el curso.
Antes de medir, el script comprueba que cada frase exista en su lección.

No ajustes nada mirando las preguntas `holdout`, `holdout2` ni `holdout3`: se usan una sola vez para confirmar.
`holdout` y `holdout2` ya se usaron para elegir `op12-k5`, y `holdout3` para confirmar el número de fuentes variable;
la próxima mejora necesita preguntas de confirmación nuevas.

Si agregas o cambias preguntas, sube `version` en `golden-set.json`: las mediciones con
otro golden set no son comparables una a una.

## Guardar y comparar mediciones

`results/` se sobrescribe en cada corrida y no está en git. Para conservar una medición:

```bash
npm run eval:rag -- --variants produccion --split all --save --note "qué cambió"
```

- Escribe `baselines/AAAA-MM-DD-variante-split.json`: métricas, aciertos por categoría,
  el resultado de cada pregunta (fuentes, puntajes, utilidad), el commit y el golden set.
- Agrega una fila a [HISTORIAL.md](HISTORIAL.md). Guarda desde un commit limpio: con
  cambios sin commit en `src/` o `eval/rag/`, el commit queda marcado `+cambios`.

Para medir un cambio contra una medición guardada:

```bash
npm run eval:rag -- --variants produccion --split all --compare 2026-11-07-produccion-all
```

Muestra antes, ahora y la diferencia de cada métrica, y las preguntas que mejoraron o
empeoraron. Si el golden set cambió, compara solo las preguntas en común y lo avisa.
Hay variación de ±1 pregunta entre corridas por empates de orden.

## Medir respuestas con Groq

`generation.mjs` compara las respuestas en Markdown y en DIL sobre las mismas preguntas:
rechazos por motivo, nodos descartados, componentes usados, tokens de salida y latencia.
**Cada pregunta gasta una llamada a Groq por modo** con la `GROQ_API_KEY` de `backend/.env`.

```bash
npm run eval:rag -- --variants produccion --split dev   # deja la base local indexada
npm run eval:rag:generation -- --limit 20 --modes markdown,dil
npm run eval:rag:generation -- --modes dil --ids l21-col-1   # repetir preguntas sueltas
```

El detalle queda en `results/generation-<split>-<modos>.json`, con el cuerpo de los errores
de Groq. Los resultados se registran a mano en [HISTORIAL.md](HISTORIAL.md).
