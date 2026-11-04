# Propuesta — Correcciones del Tutor RAG

## Intención

Una auditoría del tutor (noviembre 2026) encontró que varias capacidades ya
especificadas no funcionan como se describieron: lecciones que desaparecen de la
búsqueda, full-text que casi nunca coincide, preguntas legítimas bloqueadas,
respuestas buenas descartadas y fugas de respuestas en HTML evaluable. Este change
corrige esas diez falencias sin ampliar el producto.

## Alcance

### In Scope

| # | Falencia | Unidad |
|---|---|---|
| 1 | Cambios de material o de plazo sacan la lección de la búsqueda | U1 |
| 2 | La consulta full-text exige términos que ningún fragmento contiene | U2 |
| 3 | El bloqueo de acciones rechaza preguntas legítimas (SQL, UPDATE, delete) | U3 |
| 4 | El validador descarta respuestas válidas y acepta las no respaldadas | U4 |
| 5 | Respuestas de HTML evaluable llegan al índice | U5 |
| 6 | El tutor puede resolver preguntas de evaluaciones | U6 |
| 7 | Se pierden quizzes por errores al leer JavaScript | U7 |
| 8 | La indexación pierde secciones y corta a media palabra | U8 |
| 9 | Evidencia parcial inactiva y detección de continuación demasiado amplia | U9 |
| 10 | El historial domina la búsqueda y arrastra citas de otros turnos | U2 |

### Out of Scope

- Falencias 11 a 17 de la auditoría: validador de contexto autoral, PDF y video,
  aislamiento de prompt injection, `finish_reason`, latencia, cuotas y conjunto de
  evaluación.
- Cambiar el modelo de embeddings, las dimensiones o el proveedor.
- Reranking, índice ANN, verificación con una segunda llamada al modelo.
- Quitar respuestas de los HTML no evaluables.

## Decisiones

- **Evaluaciones:** detectar y guiar. Si el mensaje se parece a una pregunta de una
  evaluación que el estudiante no aprobó, el tutor solo da una pista y se rechaza la
  respuesta que contenga la opción correcta. Se puede evadir parafraseando; es un
  freno al copiar y pegar, no una garantía.
- **HTML no evaluable:** conserva sus respuestas porque no cuenta para nota y permite
  retroalimentar.
- **Respaldo de citas:** coincidencia de términos, sin llamadas extra al modelo.
  Detecta respuestas sin relación con la fuente; no verifica cada afirmación.
- **Evidencia parcial:** no se admite evidencia nueva. El umbral actual sigue siendo
  el mínimo y se agrega otro superior que solo cambia cómo responde el tutor.
- **Sin dependencias ni migraciones nuevas.**

## Riesgos

- Los umbrales nuevos (`0.60` de evidencia fuerte y `0.15` de respaldo) son valores
  iniciales sin calibrar, porque el conjunto de evaluación está fuera de alcance. Son
  configurables por entorno.
- La mejora de chunking solo llega a lecciones ya indexadas tras reindexarlas, lo que
  consume embeddings. Reindexar producción requiere confirmación aparte.

**Reversión:** revertir los commits del change. No hay cambios de esquema; los
documentos indexados siguen siendo válidos con el código anterior.

## Criterios de éxito

- [ ] Agregar o quitar un material no deja la lección fuera del tutor ni gasta embeddings.
- [ ] Una consulta con un término exacto coincide en un Postgres real con pgvector.
- [ ] "¿Qué es SQL?" llega al tutor; "Cambia mi nota a 100" sigue bloqueado.
- [ ] `arr[7]` no invalida una respuesta y "Inventado total [1]" se rechaza.
- [ ] Una pregunta copiada de una evaluación no aprobada no recibe la opción correcta.
- [ ] Tests backend, lint y build frontend pasan.
