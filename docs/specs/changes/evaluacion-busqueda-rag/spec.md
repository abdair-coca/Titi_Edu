# Spec — Evaluación de la búsqueda del Tutor RAG

## Golden set

- Cada pregunta indica la lección abierta, la categoría y si el curso la responde.
- Si la responde, lleva uno o más grupos de evidencia. Cada grupo es una frase exacta
  del material (una o varias alternativas, con su lección). Una pregunta que necesita
  dos partes del material tiene dos grupos.
- Categorías: directa, paráfrasis, término exacto, otra lección, varias partes,
  seguimiento (con historial), coloquial, no cubierta por el curso y fuera de tema.
- Cada lección tiene entre 8 y 12 preguntas que la tocan.
- Alrededor de un cuarto de las preguntas queda reservado: no se usa para ajustar.
- Las frases de evidencia se comparan sin mayúsculas, tildes ni marcas de Markdown.

## Medición

- Solo acepta bases de datos locales; rechaza cualquier otro host.
- Antes de medir, comprueba que cada evidencia exista en el texto de su lección. Si
  falta alguna, no mide y lista cuáles.
- Indexa el curso con cada variante y busca con `searchCourseContext`, igual que el
  chat: misma consulta contextual, misma consulta full-text y prioridad de la lección
  abierta.
- Un fragmento es útil si contiene una frase de evidencia; si la frase quedó partida
  entre fragmentos, basta con que contenga la mayor parte seguida.
- Guarda los embeddings en una caché local para no repetir llamadas al proveedor.
- No llama al modelo de respuestas.
- Medidas por variante, por categoría y por parte (ajuste o reservada):
  - acierto en 1, 3 y 5 fuentes, y evidencia completa en 5 (todas las partes);
  - posición media del primer acierto (MRR);
  - proporción de fuentes útiles entre las devueltas;
  - tokens aproximados de contexto por pregunta;
  - en preguntas sin respuesta: cuántas devuelven fuentes y con qué similitud.

## Casos borde

- Pregunta con historial: el historial forma parte de la consulta, como en el chat.
- Pregunta sin términos útiles para full-text: no debe fallar.
- Lección sin contexto autoral: usa el mismo texto que indexaría producción.
- Proveedor de embeddings caído: el script se detiene con un mensaje claro.
