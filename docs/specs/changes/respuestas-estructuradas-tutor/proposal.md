# Propuesta — Respuestas estructuradas del Tutor IA (DIL)

## Intención

Hoy el tutor devuelve Markdown plano y el panel lo muestra en una sola burbuja de
texto. Las explicaciones largas cuestan de leer y las prácticas obligan a escribir
la respuesta a mano. Este change define **DIL (Declarative Interface Language)**:
un vocabulario cerrado de componentes con el que el modelo **declara** la interfaz
de su respuesta (pasos, avisos, tarjetas, tablas, diagramas, quiz) y el frontend la
arma con componentes propios de Titi. El objetivo son respuestas más claras, más
lindas e interactivas sin perder el respaldo en fuentes ni las protecciones de
evaluaciones.

## Alcance

### In Scope

| # | Qué | Unidad |
|---|---|---|
| 1 | Contrato DIL v1: componentes, props y límites, como JSON Schema estricto | U1 |
| 2 | Validador y serializador DIL → texto canónico con citas `[n]` | U1 |
| 3 | Generación con structured outputs de Groq en modo estricto, detrás de un flag | U2 |
| 4 | Respaldo en fuentes y bloqueo de evaluaciones aplicados sobre el texto canónico | U2 |
| 5 | API: `data.dil` junto a `data.answer`, que no cambia | U3 |
| 6 | Renderer DIL en el panel: Text, Steps, Callout, Concepts, Table, Code | U4 |
| 7 | Diagrama Mermaid seguro y con respaldo si falla | U5 |
| 8 | Quiz tocable que envía la opción elegida como respuesta de práctica | U6 |
| 9 | Medición con Groq real: rechazos, tokens y latencia, DIL contra Markdown | U7 |

### Out of Scope

- Corrección instantánea en el navegador: la respuesta correcta nunca llega al cliente.
- Streaming (structured outputs de Groq no lo admite).
- Usar DIL fuera del Tutor IA (lecciones, posts, autoría de cursos).
- Imágenes, videos o enlaces externos dentro de una respuesta.
- Cambiar el modelo, el retrieval o los umbrales de evidencia.

## Decisiones

- **Formato:** árbol JSON `{ version, nodes[] }` forzado por el modo estricto de
  Groq (`response_format: json_schema`, `strict: true`). `openai/gpt-oss-20b` lo
  admite y la salida nunca rompe el schema. En modo estricto todos los campos son
  obligatorios, así que lo opcional se declara como `null` o lista vacía.
- **Catálogo cerrado:** solo los componentes de DIL v1. Un nodo desconocido o
  inválido se descarta; si no queda ninguno, la respuesta se trata como vacía, igual
  que hoy cuando el modelo no devuelve nada.
- **Una sola verdad para validar:** el árbol se serializa a texto canónico (Markdown
  con `[n]`). El respaldo en fuentes, el bloqueo de evaluaciones y el historial usan
  ese texto, así que las protecciones actuales no se reescriben.
- **Quiz sin respuesta:** el modelo solo declara pregunta y opciones. El estudiante
  elige y la opción viaja como mensaje `RETROALIMENTAR`; el feedback llega en el
  turno siguiente, igual que la práctica escrita de hoy.
- **Flag `RAG_DIL_ENABLED`:** apagado, el tutor responde exactamente como hoy.
  Permite activar y revertir sin redeploy de código.
- **Sin dependencias ni migraciones nuevas.** Mermaid ya está en el frontend.

## Riesgos

- **Tokens:** el JSON agrega salida y el razonamiento de `gpt-oss-20b` comparte el
  límite de `MAX_COMPLETION_TOKENS`. Por eso el límite pasa de 1600 a 3200 (decisión
  del 2026-11-07). Un corte deja JSON incompleto; se mide en U7.
- **Calidad del modelo:** un modelo de 20B con un schema grande puede elegir mal
  los componentes o fragmentar el texto, y el respaldo por términos rechazaría más.
  La medición de U7 decide si el flag queda encendido.
- **Mermaid generado por el modelo:** se renderiza con `securityLevel: 'strict'`,
  sin etiquetas HTML y con un tamaño máximo; si falla, se muestra el texto del nodo.

**Reversión:** apagar `RAG_DIL_ENABLED`. Los mensajes con `dil` ya guardados en el
navegador siguen mostrándose con su `answer`.

## Criterios de éxito

- [ ] Con el flag encendido, una explicación llega como pasos y avisos con citas visibles.
- [ ] "Hazme una pregunta" muestra un quiz tocable y el navegador nunca recibe la opción correcta.
- [ ] Una respuesta DIL sin citas o con citas inventadas se rechaza igual que hoy.
- [ ] Una pregunta copiada de una evaluación no aprobada no recibe la opción correcta, tampoco como opción del quiz.
- [ ] Con 20 preguntas reales, la tasa de rechazo con DIL no supera a la de Markdown en más de 5 puntos.
- [ ] Con el flag apagado, los tests actuales del tutor pasan sin cambios.
- [ ] Tests backend, `test:rag` y build frontend pasan.
