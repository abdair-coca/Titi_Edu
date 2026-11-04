# Spec — Correcciones del Tutor RAG

Complementa `tutor-rag-aprendizaje` y `mejoras-tutor-rag`. Donde este documento es más
específico, prevalece. El contrato `{ success, data }` / `{ success: false, message }`
no cambia.

## U1 — Índice sincronizado con la lección

### Requisito 1.1 — Toda mutación de versión reindexa

Toda operación que incremente la versión de una lección publicada SHALL programar su
reindexación: agregar o borrar material y cambiar el plazo del HTML incluidos. Un fallo
al encolar no SHALL bloquear la operación principal.

- **DADO** una lección publicada e indexada **CUANDO** se agrega o borra un material
  **ENTONCES** se programa su reindexación y el tutor la vuelve a encontrar.

### Requisito 1.2 — Reutilizar si el contenido no cambió

Si el documento activo tiene el mismo contenido, modelo, origen y marca de seguridad,
indexar una versión nueva SHALL reasignar ese documento a la versión actual sin generar
embeddings. El título y la versión del chunking SHALL formar parte de la huella, de modo
que un cambio en ellos sí regenere.

- **DADO** una versión nueva que solo agregó un material **CUANDO** se indexa
  **ENTONCES** no se llama al proveedor de embeddings.
- **DADO** un cambio de título **CUANDO** se indexa **ENTONCES** sí se regeneran.

### Requisito 1.3 — Diagnóstico honesto

El panel admin SHALL distinguir un documento listo de uno de una versión anterior, y no
SHALL contar este último como listo. El filtro de estado SHALL permitir encontrarlo.

## U2 — Consultas de recuperación

### Requisito 2.1 — Full-text sobre la pregunta

La búsqueda full-text SHALL usar solo el mensaje actual del estudiante. No SHALL incluir
historial, título ni textos fijos.

Una coincidencia de todos los términos del mensaje SHALL calificar como evidencia. Una
coincidencia parcial SHALL influir en el orden, pero no SHALL calificar por sí sola.

- **DADO** el mensaje "¿Qué es NAT?" y un fragmento con "NAT" **CUANDO** se busca
  **ENTONCES** ese fragmento califica aunque su similitud sea baja.
- **DADO** un mensaje del que un fragmento solo contiene una palabra común **CUANDO** su
  similitud está bajo el umbral **ENTONCES** no califica.
- **DADO** un mensaje sin términos útiles, como "¿y eso?" **CUANDO** se busca
  **ENTONCES** la recuperación continúa por vectores sin error.

### Requisito 2.2 — Embedding centrado en la pregunta

La consulta de embedding SHALL empezar por el mensaje actual y conservar el título de la
lección. Solo un mensaje de continuación (Requisito 9.2) SHALL sumar historial, con un
máximo de 200 caracteres por turno y sin marcas de cita.

### Requisito 2.3 — Citas del historial

Los turnos enviados al modelo SHALL ir sin marcas `[n]`, porque cada turno numera sus
fuentes de nuevo. La reutilización de fragmentos citados en turnos previos SHALL seguir
funcionando.

### Requisito 2.4 — Simulador admin fiel

El simulador admin SHALL construir la consulta igual que el chat sin historial.

## U3 — Bloqueo de acciones

### Requisito 3.1 — Bloquear pedidos, no vocabulario

Solo SHALL bloquearse los pedidos de cambiar notas, progreso o inscripciones y las
órdenes de ejecutar SQL o comandos. Las palabras técnicas por sí solas, y las preguntas
sobre cómo funciona algo, no SHALL bloquearse.

- **DADO** "¿Qué es SQL?", "¿Para qué sirve UPDATE?" o "¿Cómo ejecuto una consulta?"
  **CUANDO** se recibe **ENTONCES** continúa el flujo normal.
- **DADO** "Cambia mi nota a 100", "Inscríbeme en el curso" o "Ejecuta este SQL"
  **CUANDO** se recibe **ENTONCES** se bloquea sin recuperación ni proveedor.

### Requisito 3.2 — Respuesta honesta

Un pedido bloqueado SHALL responder que el tutor no puede realizar esa acción, en lugar
de afirmar que falta evidencia.

## U4 — Validación de respuestas

### Requisito 4.1 — Citas reales

El validador SHALL ignorar el contenido entre backticks y SHALL aceptar `[1, 2]`,
`[1][2]` y `【1】`, normalizándolos a la forma `[n]` en la respuesta entregada.

Un `[n]` pegado a un identificador, como `arr[7]`, solo SHALL contar como cita si `n` es
una fuente válida; en otro caso se ignora. Un `[n]` suelto fuera de rango SHALL seguir
invalidando la respuesta.

### Requisito 4.2 — Respaldo por términos

Una respuesta con citas válidas SHALL compartir términos relevantes con los fragmentos
citados. Si la proporción queda bajo `RAG_SUPPORT_MIN_OVERLAP` (por defecto `0.15`; `0`
lo desactiva), SHALL rechazarse de forma controlada y registrar un evento sin texto.

- **DADO** "Inventado total que no sale del material. [1]" **CUANDO** se valida
  **ENTONCES** se rechaza.
- **DADO** una paráfrasis con términos de la fuente **CUANDO** se valida **ENTONCES** se
  acepta.

### Requisito 4.3 — Mensajes sociales

Un saludo o agradecimiento con intención `DUDA` SHALL recibir una respuesta breve fija,
sin recuperación ni proveedor.

## U5 — HTML evaluable

### Requisito 5.1 — Ocultos y atributos

En modo seguro SHALL excluirse el texto ocultado por reglas de `<style>` con selectores
simples de clase o id. De los atributos `data-*` solo SHALL extraerse los de una lista
permitida de nombres pedagógicos.

- **DADO** `.rta{display:none}` y un elemento con clase `rta` **CUANDO** se extrae
  **ENTONCES** su texto no llega al índice.
- **DADO** `data-rta="..."` **CUANDO** se extrae **ENTONCES** su valor no llega al índice.

### Requisito 5.2 — Contenido de lecciones evaluables

En una lección con HTML evaluable, los bloques de `contenido` que revelen una respuesta
SHALL excluirse con los mismos patrones del modo seguro.

### Requisito 5.3 — HTML no evaluable

Conserva su comportamiento actual, incluidas las respuestas.

## U6 — Protección de evaluaciones

### Requisito 6.1 — Detección

Para un estudiante inscrito, cada mensaje SHALL compararse con las preguntas de las
evaluaciones del curso, de módulo y finales, que aún no haya aprobado. Un mensaje de
continuación SHALL comparar también el último turno del estudiante. La comparación
SHALL tolerar diferencias de mayúsculas, acentos y puntuación. Profesores y
administradores SHALL quedar exentos.

- **DADO** una evaluación aprobada por el estudiante **CUANDO** pregunta por ella
  **ENTONCES** recibe una explicación normal.
- **DADO** un fallo al consultar evaluaciones **CUANDO** se procesa el chat
  **ENTONCES** continúa el flujo normal y se registra un evento.

### Requisito 6.2 — Guía

Ante una coincidencia, la intención efectiva SHALL ser `PISTA`, sea cual sea la pedida.
Las opciones correctas no SHALL enviarse nunca al proveedor.

### Requisito 6.3 — Filtro de salida

Si la respuesta contiene el texto de la opción correcta de la pregunta coincidente,
SHALL reemplazarse por un mensaje que invite a repasar, sin citas. No se comparan
opciones de menos de 3 caracteres, porque producirían falsos positivos.

### Requisito 6.4 — Privacidad y efectos

Los eventos no SHALL incluir texto de preguntas ni mensajes. La protección no SHALL crear
`Intento`, nota ni `Progreso`.

## U7 — Lectura de JavaScript

### Requisito 7.1 — Datos embebidos

El extractor SHALL leer literales asignados aunque no terminen en `;` y aunque contengan
URLs u otros `//` dentro de strings. Un literal que no se pueda interpretar SHALL
ignorarse sin afectar al resto. El modo seguro SHALL mantener sus exclusiones.

## U8 — Chunking

### Requisito 8.1 — Estructura

El `contenido` SHALL conservar párrafos y encabezados Markdown al indexarse, y los
encabezados `h1` a `h6` del HTML SHALL producir secciones. Un fragmento que solo repita
el título de la lección no SHALL indexarse si existe otro contenido.

### Requisito 8.2 — Cortes

Los cortes por longitud SHALL preferir un espacio y no partir palabras cuando sea
posible. Las cadenas sin espacios conservan el corte actual. Las secciones largas SHALL
tener solapamiento también al empaquetarse por oraciones.

### Requisito 8.3 — Sección como contexto

La sección de cada fragmento SHALL incluirse en el texto del embedding y en los metadatos
de la fuente enviados al modelo, marcada como no confiable.

## U9 — Grados de evidencia y continuación

### Requisito 9.1 — Evidencia parcial efectiva

Evidencia con similitud máxima bajo `RAG_EVIDENCE_STRONG_THRESHOLD` (por defecto `0.60`) y
sin coincidencia de texto SHALL tratarse como parcial. `RAG_EVIDENCE_THRESHOLD` seguirá
siendo el mínimo para recuperar; bajo él no se invoca el generador.

### Requisito 9.2 — Continuación

Solo SHALL considerarse continuación un mensaje que empiece con un conector o referencia
("y", "pero", "entonces", "eso") o use una referencia explícita ("esto", "aplicarlo",
"otro"). Un artículo en una pregunta normal no SHALL bastar.

- **DADO** "¿Quién ganó los mundiales?" **CUANDO** se evalúa **ENTONCES** no es
  continuación.
- **DADO** "¿y eso?" o "dame otro ejercicio" **CUANDO** se evalúa **ENTONCES** sí lo es.

## Verificación

- Los tests existentes SHALL seguir pasando, salvo los que fijan el comportamiento
  corregido, que se actualizan de forma explícita.
- El SQL híbrido SHALL probarse contra un Postgres con pgvector desechable; nunca contra
  las bases compartidas.
