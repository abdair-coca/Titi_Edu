# Spec — Tutor RAG orientado al aprendizaje

## Plan de entrega

Los requisitos se implementan en orden y con pausa obligatoria después de cada etapa:

| Etapa | Requisitos | Resultado esperado |
|---|---|---|
| 1. Seguridad y evidencia | U3, U4 y U5.1 | Corpus seguro, evidencia calificada e historial continuo |
| 2. Tutoría formativa | U1, U2.1, U2.2 y U5.2 | Tutor adaptado a intención y estado de aprendizaje |
| 3. Experiencia y cierre | U2.3 y U6 | Flujo de práctica usable, documentación y verificación integral |

El cierre de cada etapa requiere ejecutar sus pruebas, reportar resultados y pedir
feedback explícito del usuario. Sin ese feedback no se comienza etapa siguiente.

## U1 — Contexto de aprendizaje seguro

### Requisito 1.1 — Contexto mínimo por estudiante

Cuando un estudiante autorizado consulta una lección, el tutor puede usar un
resumen efímero del aprendizaje actual, limitado al curso y a la lección abierta.
El resumen puede distinguir:

- estado de la lección: `NO_INICIADA`, `EN_CURSO` o `COMPLETADA`;
- avance agregado del curso/módulo, sin listar actividad de otros estudiantes;
- desempeño del módulo: `SIN_INTENTO`, `NECESITA_REFUERZO` o `LOGRADO`.

El resumen no debe incluir nombre, email, `neoId`, texto de notas personales,
comentarios, respuestas del estudiante, claves de evaluación ni datos de otro
curso. No se persiste ni se indexa.

- **DADO** un estudiante inscrito con progreso disponible **CUANDO** consulta el
  tutor **ENTONCES** el modelo recibe únicamente el resumen de su aprendizaje actual.
- **DADO** un docente o administrador **CUANDO** consulta como usuario con acceso
  administrativo **ENTONCES** el tutor no recibe datos privados de un estudiante y
  usa contexto neutral.
- **DADO** un fallo al cargar el resumen **CUANDO** el corpus RAG está disponible
  **ENTONCES** el chat continúa con contexto neutral y registra solo un evento técnico.

### Requisito 1.2 — Adaptación sin decisiones de alto impacto

El tutor debe usar el resumen para ajustar claridad, cantidad de pasos, ejemplos y
dificultad. No debe convertirlo en una nota, diagnóstico clínico, sanción ni criterio
para bloquear contenido. Nunca debe afirmar que cambió el progreso o la evaluación.

- **DADO** desempeño `NECESITA_REFUERZO` **CUANDO** se solicita una explicación
  **ENTONCES** prioriza pasos pequeños, vocabulario claro y comprobación de
  comprensión.
- **DADO** desempeño `LOGRADO` **CUANDO** se solicita práctica **ENTONCES** puede
  aumentar dificultad sin salir de la evidencia recuperada.

## U2 — Interacción pedagógica

### Requisito 2.1 — Intención explícita

`POST /api/lessons/:id/chat` acepta campo opcional `intent` con uno de estos valores:

`DUDA`, `EXPLICAR`, `EJEMPLO`, `RESUMEN`, `PRACTICA`, `PISTA`,
`RETROALIMENTAR`.

Si se omite, se usa `DUDA` para conservar compatibilidad. Un valor desconocido se
rechaza con `400` y respuesta `{ success: false, message }`. El campo no permite
ejecutar acciones ni cambiar permisos.

### Requisito 2.2 — Conducta por intención

- `DUDA`: responde la pregunta concreta con alcance y evidencia explícitos.
- `EXPLICAR`: descompone una idea en pasos breves y comprueba comprensión sin
  saturar la respuesta.
- `EJEMPLO`: presenta un ejemplo trabajado y separa concepto, aplicación y límite.
- `RESUMEN`: entrega puntos clave breves, sin agregar conclusiones no respaldadas.
- `PRACTICA`: propone una sola consigna relacionada con la evidencia y solicita que
  el estudiante responda; no muestra solución ni respuesta esperada en el mismo turno.
- `PISTA`: entrega una ayuda progresiva, sin saltar directamente a la solución.
- `RETROALIMENTAR`: analiza la respuesta del estudiante, reconoce aciertos, señala
  un error conceptual respaldado, explica cómo corregirlo y propone un siguiente paso.

La retroalimentación es formativa y no crea nota oficial ni registro de intento. Si
no existe evidencia para evaluar la respuesta, debe decirlo y pedir una reformulación
o remitir al material, sin inventar una corrección.

- **DADO** `PRACTICA` **CUANDO** el estudiante aún no respondió **ENTONCES** recibe
  una sola pregunta sin solución.
- **DADO** un turno de práctica seguido de una respuesta del estudiante **CUANDO**
  se solicita `RETROALIMENTAR` **ENTONCES** recibe feedback sobre esa respuesta y
  no una calificación oficial.
- **DADO** `PISTA` **CUANDO** el estudiante la solicita **ENTONCES** recibe una
  pista parcial y no la respuesta completa.

### Requisito 2.3 — Continuidad de práctica

El frontend debe enviar la intención correspondiente a acciones rápidas y conservar
estado de práctica por `lessonId` mientras la lección esté abierta. Un cambio de
lección o "Nueva conversación" debe limpiar ese estado. El backend sigue stateless:
la continuidad depende de historial request-scoped validado.

## U3 — Evidencia útil y citas honestas

### Requisito 3.1 — Umbral efectivo

La recuperación debe excluir del contexto final fragmentos que no alcancen el umbral
configurado de evidencia, salvo que tengan coincidencia full-text positiva. La regla
debe aplicarse tanto en búsqueda híbrida como en fallback vectorial. Si no queda
ningún fragmento calificado, el chat responde `NO_EVIDENCE_ANSWER` sin invocar al
generador.

Se conserva la prioridad de la lección abierta y el relleno desde el curso, pero la
prioridad no puede forzar fragmentos irrelevantes por debajo del umbral.

- **DADO** resultados vectoriales bajo el umbral y sin coincidencia textual
  **CUANDO** se solicita contexto **ENTONCES** el resultado queda vacío.
- **DADO** un término exacto con similitud vectorial baja pero coincidencia full-text
  positiva **CUANDO** se busca **ENTONCES** el fragmento puede calificarse y citarse.
- **DADO** una consulta sin fragmentos calificados **CUANDO** se procesa **ENTONCES**
  se devuelve `NO_EVIDENCE_ANSWER` y `citations: []`.

### Requisito 3.2 — No duplicación ni falsa relevancia

El contexto final no debe repetir el mismo contenido normalizado en varios
fragmentos. Las citas deben conservar lección, módulo y extracto exacto. La UI no
debe presentar similitud coseno como porcentaje de relevancia o probabilidad; debe
mostrar la fuente y su extracto, y si muestra score debe identificarlo como score
técnico no calibrado.

### Requisito 3.3 — Controles existentes

La mejora debe conservar filtros de publicación, documento activo `LISTO`, prioridad
de lección, fallback híbrido-vectorial, validación de números de cita, límites,
permisos, bloqueo de solicitudes mutantes y tratamiento de fuentes/historial como
datos no confiables.

## U4 — Integridad de actividades evaluables

### Requisito 4.1 — Corpus seguro para estudiantes

El texto indexado para el chat estudiantil debe excluir claves y campos ocultos de
respuestas en HTML evaluable, incluyendo variantes de `correcta`, `correct`, `answer`,
`correctAnswer`, `respuestaCorrecta`, `solution`, `data-answer`, `data-correct` y
equivalentes reconocidos por el extractor.

Debe conservarse el contenido educativo visible que no sea clave de respuesta,
incluidas consignas, conceptos y opciones visibles cuando sean parte de la actividad.
El comportamiento debe ser explícito para HTML evaluable y no depender de que el
proveedor LLM ignore el dato después de recibirlo.

- **DADO** HTML evaluable con `correcta` o `data-answer` **CUANDO** se indexa para
  estudiantes **ENTONCES** esos valores no aparecen en `FragmentoRag.contenido`.
- **DADO** una consigna y sus opciones visibles **CUANDO** se indexa **ENTONCES** la
  consigna permanece disponible para explicar el concepto sin incluir la clave.
- **DADO** una solicitud de la respuesta exacta de una actividad **CUANDO** se genera
  tutoría **ENTONCES** se ofrece pista o explicación conceptual, nunca una clave
  oculta del material.

### Requisito 4.2 — Sin filtración por citas

Las citas devueltas al estudiante solo pueden apuntar a fragmentos del corpus seguro.
El endpoint no debe exponer el HTML original ni campos de administración con la clave.

## U5 — Historial y contrato

### Requisito 5.1 — Historial correcto

Cada request debe incluir todos los turnos previos válidos hasta el límite configurado
sin eliminar arbitrariamente el último turno del tutor. El mensaje actual se excluye
del historial por construcción, no mediante un `slice(0, -1)` incondicional.

- **DADO** conversación `user → tutor` **CUANDO** se envía seguimiento **ENTONCES**
  ambos turnos llegan al proveedor antes de la pregunta nueva.
- **DADO** reintento de una pregunta fallida **CUANDO** se reenvía **ENTONCES** no se
  pierde el historial previo ni se duplica la pregunta.
- **DADO** cambio de lección **CUANDO** se abre el tutor **ENTONCES** no se envían
  turnos de otra lección.

### Requisito 5.2 — Compatibilidad y fallos

El endpoint conserva `{ success, data }` y `{ success: false, message }`. `intent` es
opcional para clientes anteriores. Timeout, caída o respuesta inválida del proveedor
produce error controlado sin persistir conversación ni alterar progreso.

## U6 — Verificación centrada en aprendizaje

Debe existir una matriz de regresión con, como mínimo:

- duda semántica, término exacto, pregunta fuera de evidencia y evidencia parcial;
- explicación con perfil `NECESITA_REFUERZO` y práctica con perfil `LOGRADO`;
- práctica sin solución, pista sin solución completa y feedback de una respuesta;
- HTML evaluable con claves en JSON, JavaScript y atributos `data-*`;
- historial de seguimiento, reintento, cambio de lección e intención inválida;
- prompt injection, solicitud de cambiar nota/progreso/inscripción y proveedor caído.

La matriz debe comprobar contenido y decisiones del flujo, no solo que una respuesta
HTTP tenga estado `200`.
