# Spec — Learn con el lenguaje v3

> **Change:** `rediseno-learn-v3` · Reglas visuales: `frontend/design.md`
> (§5, §8, §10, §14-16). Piezas: `components/ui/v3.jsx`.

## R1 — Índice del curso (columna izquierda y cajón en celular)

- Superficie v3 (borde oscuro de 2 px) en desktop; en celular, el mismo
  contenido en un cajón con botón de cerrar (ícono) además del fondo.
- Cabecera: volver (pastilla `BackLink`), categoría con su ícono y acento,
  título del curso.
- Avance en panel oscuro: porcentaje con conteo, barra que se llena desde 0,
  "Lección X de Y" y cuántas completadas. Mientras carga el progreso,
  skeleton en el panel.
- Módulos numerados con el acento de la categoría y "N/M" completadas.
- Lecciones como ruta de nodos unidos por una línea: completada = círculo
  verde con check, actual = círculo amarillo con borde oscuro, pendiente =
  círculo blanco con número. La actual va resaltada (fondo amarillo claro y
  borde oscuro). Las lecciones nuevas (`esNueva` del progreso) llevan la
  pastilla "Nueva".
- Evaluaciones de módulo con nodo púrpura y `AwardIcon`; la final, al pie,
  como tile con `TrophyIcon` (sin 🏁).

## R2 — Botón del índice (celular)

- Tile v3 con ícono de lista, "Lección X de Y", el título del módulo actual,
  una barra fina de avance y chevron SVG. Lleva `aria-expanded` y
  `aria-controls` del índice.

## R3 — Lección

- Cabecera: eyebrow "Módulo N · título", título en `font-black`, pastilla
  "Completada" si corresponde y botón "Guardar nota" (secundario chico).
- El video y el contenido van sobre una superficie v3 (lectura sobre blanco).
- Barra de acción en superficie: sin completar → "Marcar como completada"
  (primario) + "Siguiente" (secundario); completada → pastilla verde con
  check + "Siguiente" pasa a primario. "Siguiente" muestra el título de lo
  que sigue (lección o evaluación final). Actividad HTML evaluable: el texto
  de estado en lugar del botón de completar.
- Error al completar: `ErrorBox` con Reintentar.

## R4 — Riel y paneles de recursos

- Riel en superficie v3; pestaña activa en amarillo con borde y sombra dura;
  el punto de "falta la clave" del tutor se mantiene.
- Cabecera de panel: insignia girada del recurso + título (+ conteo en
  comentarios) + cerrar con `CloseIcon`.
- Notas: campo v3, "Guardado" con check SVG, botón primario.
- Materiales: filas tile con insignia de color por tipo y acción de
  descarga; sin materiales → vacío con Titi compacto.
- Íconos solo de `icons.jsx` (se borran las copias locales).

## R5 — Avisos

- Clave del tutor: superficie con insignia amarilla y botón oscuro
  "Configurar ahora"; copy en voseo.
- Curso completado: panel oscuro con Titi `celebra`, título con acento,
  botón "Ver mi certificado" y cerrar con ícono; tildes corregidas.

## R6 — Estados de la página

- Carga: skeleton con la silueta de las tres columnas en superficies v3.
- Error: vacío con Titi `triste`, el motivo, "Reintentar" (vuelve a pedir el
  curso sin recargar la página) y "Volver al detalle del curso".
- Sin inscripción: vacío con Titi `triste` y CTA al detalle.
- Sin lecciones: vacío con Titi `pensando` y CTA al detalle.

## R7 — Evaluación (`EvaluationQuiz`)

- Carcasa: superficie v3 con insignia púrpura (trofeo si es final), eyebrow,
  título `font-black` y plazo como pastilla con ícono.
- Intro: Titi, tres cifras (preguntas, nota mínima, intentos) en tiles con
  ícono, botón primario.
- Formulario: avance "N de M respondidas" con barra; preguntas en tarjetas
  con número; opciones con letra (A, B, C…), borde de 2 px, press y estado
  elegido en amarillo con borde y sombra oscuros; respuesta corta con el
  input v3.
- Resultado: nota con conteo, correcciones con círculo verde/rojo y check o
  cruz SVG, "Reintentar" con ícono.
- Intento extra con `RefreshIcon` (sin 🔁). Mascota con la API `state` (sin
  emoji en la burbuja).

## R8 — Comentarios de la lección

- `Avatar` v3, campo v3, "Publicar" primario con ícono, cancelar respuesta
  con `CloseIcon`, tarjetas con borde de 2 px, hilo con borde amarillo,
  vacío con Titi compacto y error con `ErrorBox`.

## R9 — Tutor IA (`TutorPanel`)

Segunda vuelta (pedido: "también el tutor de IA, comentarios y toda esa
sección"):

- Cabecera: insignia amarilla girada (engranaje en ajustes), estado de
  conexión como pastilla con borde, botones redondos con borde (nueva
  conversación, ajustes —amarillo cuando está abierto—, cerrar con ícono).
- Contexto de la lección en tarjeta amarilla con borde oscuro: lección,
  módulo y curso. Práctica en curso en verde con ícono.
- Conversación: pregunta del estudiante en amarillo con borde y sombra dura;
  respuesta del tutor en superficie con borde oscuro y un avatar con chispas.
  "Otra lección" con botón secundario; fuentes con número en cuadrito
  amarillo, pastilla verde "Fuente publicada del curso" y "Ver material".
  Acciones rápidas posteriores como pastillas con press.
- Carga en curso como burbuja con barra de 4 etapas; error con `ErrorBox` +
  Reintentar.
- Entrada con el input v3 y botón de enviar amarillo con borde (gris si no
  se puede enviar).
- Vacío: Titi `saludo`, título con acento y cuatro acciones rápidas como
  tiles con insignia de color. Copy en voseo ("Explicame", "Haceme",
  "Creá").
- Clave de Groq: bienvenida con Titi y botones v3; ajustes con superficies,
  estado verde/rojo con ícono, "Reemplazar" (secundario) y "Eliminar"
  (peligro), input v3 con ojo de `icons.jsx`.
- Contratos de `test:rag` intactos (textos, atributos del input de la clave,
  `ConfirmModal`, scroll de mensajes, DIL, quiz).

## R10 — Respuestas estructuradas (DIL)

- Pasos con nodos amarillos de borde oscuro unidos por una línea.
- Avisos (definición, tip, atención, nota) con borde de 2 px e insignia
  girada con ícono (atención usa `AlertIcon`, sin "!").
- Conceptos desplegables con borde oscuro al abrirse; tablas con cabecera
  amarilla y filas alternadas; comprobación en tarjeta amarilla con
  "Responder" secundario.
- Quiz de práctica: opciones con letra, elegida en amarillo con borde y
  sombra oscuros, "Responder" primario. Sigue sin saber la respuesta
  correcta (`role="radiogroup"`, `type="radio"`).
- Marca de cita con borde oscuro.

## R11 — Presentación HTML (`HtmlLessonPlayer`)

- Marco con borde oscuro y pantalla completa con `ExpandIcon`.
- Cifras de la actividad evaluable (intentos, entrega, estado, nota) en
  superficies con insignia de color, en grilla de 2 columnas (ya no 4
  apretadas); "Podés reintentar" en voseo.
- Carga con marco v3; error con `ErrorBox`.

## Contratos que no cambian

Todos los tokens de `scripts/check-learn-*.mjs`, `check-tutor-key-banner`,
`check-html-lesson-player` y `check-rag-contract`: carga diferida de los
cinco paneles, `onMouseEnter`/`onFocus` en el riel, `aria-live="polite"` en el
aviso de clave, `Lección {currentPosition} de {totalLessons}`, props de
`HtmlLessonPlayer`, `materiales={activeLesson.materiales || []}`, etc.
