# Propuesta — Evaluación de la búsqueda del Tutor RAG

## Intención

La verificación de `correcciones-tutor-rag` dio 48 de 48 aciertos de búsqueda, pero
ese número no sirve para decidir: el criterio cuenta como acierto cualquier fragmento
que contenga una palabra esperada (a veces genérica, como `0` u `objeto`), el set está
desbalanceado entre lecciones y casi no tiene preguntas sin respuesta en el curso.
Además, el tamaño de fragmento configurado (900 caracteres) casi no influye: el texto
se corta antes por sus encabezados y cada sección queda como un fragmento.

Este change crea un conjunto de preguntas de referencia (golden set) y una herramienta
que mide la búsqueda sin llamar al modelo de respuestas. Con esa medición se comparan
formas de fragmentar las lecciones y se elige la que encuentra mejor la evidencia con
menos tokens de contexto.

## Alcance

### In Scope

- Golden set de unas 90 preguntas sobre el curso piloto, con la frase exacta del
  material que responde cada una. Separado en preguntas para ajustar y preguntas
  reservadas para la comprobación final.
- Script de medición manual (`npm run eval:rag`) que carga el curso en un Postgres local,
  indexa con cada variante de fragmentación y busca con la función real del tutor.
- Variantes de fragmentación a comparar: actual, sin secciones de poco valor, secciones
  cortas unidas, secciones largas partidas y distinto número de fuentes.
- Aplicar en el código la variante ganadora, solo si mejora con evidencia.

### Out of Scope

- Medir las respuestas del modelo (Groq): queda para una fase posterior.
- Cambiar el modelo de embeddings, el proveedor o los umbrales de similitud sin datos.
- Correr la medición en CI o en la suite de tests.
- Reindexar producción: se hace una sola vez, con confirmación, al cerrar el trabajo.

## Criterios de éxito

- Cada pregunta del golden set tiene evidencia que existe literalmente en su lección;
  el script lo comprueba antes de medir.
- El informe da, por variante y categoría: aciertos en 1, 3 y 5 fuentes, posición media
  del primer acierto, proporción de fuentes útiles, tokens de contexto y falsas
  evidencias en preguntas sin respuesta.
- La variante elegida no empeora en las preguntas reservadas respecto de la actual.
