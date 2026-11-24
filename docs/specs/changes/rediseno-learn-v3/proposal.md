# Proposal — Learn con el lenguaje v3

> **Change:** `rediseno-learn-v3`
> **Estado:** implementado (2026-11-23), falta probar con la API real. Pedido: "seguí con el rediseño de la
> plataforma, ahora la parte de los cursos". Es la fase 6 que
> `rediseno-plataforma-v3` dejó afuera a propósito.

## Intención

Toda la app ya habla v3 (borde oscuro de 2 px, sombra dura en lo que se toca,
superficies con borde oscuro, títulos con palabra de acento, íconos SVG).
Learn (`/courses/:id/learn`), que es donde el estudiante pasa más tiempo,
sigue en v2: índice con bordes finos, emojis en el chrome (🏁, ✓, ☰, ⌄, ✕,
🎓, 🔁), botones con la sombra amarilla vieja, la evaluación con opciones
planas y estados de error/vacío sin la forma común. Pasar de *Mis cursos* a
una lección se siente como cambiar de app.

## Alcance

**Entra**

1. `LearnCourse.jsx`: índice del curso (cabecera con categoría, avance en
   panel oscuro, módulos como ruta con nodos, lecciones nuevas marcadas),
   botón del índice en celular, cabecera de la lección, contenido sobre una
   superficie, barra de acción (completar / siguiente con el título que
   sigue), riel de recursos, paneles (notas, materiales, comentarios),
   avisos (clave del tutor, curso completado) y estados (carga, error con
   Reintentar, sin inscripción, sin lecciones).
2. `EvaluationQuiz.jsx`: carcasa, intro con cifras, preguntas con opciones
   v3 (letra + press), avance de respuestas, resultado con conteo y
   correcciones con íconos, intento extra sin emoji.
3. `LessonComments.jsx`: avatar v3, formulario, hilos, vacío y error.
4. `TutorPanel.jsx` y `HtmlLessonPlayer.jsx`: primero solo los emojis/glifos
   del chrome (✕, ⛶) y el texto de 11 px; en una segunda vuelta, el tutor
   completo (conversación, fuentes, acciones, configuración de la clave), las
   respuestas estructuradas (`tutor/*`) y las cifras de la actividad HTML.

**No entra**

- Lógica de carga, caché, prefetch, navegación por `?lessonId=`, tutor y
  actividades HTML: la vigilan `test:learn-*`, `test:tutor-*`,
  `test:html-lesson` y `test:rag`, y todos sus contratos se conservan.
- Backend y API (se usa `esNueva` del progreso y `categoria` del curso, que
  ya llegan).
- El contenido Markdown de la lección (`MarkdownContent`).

## Criterios de éxito

- Cero emojis y glifos de UI (✓ ✕ ← → ☰ ⌄ ⛶) en el chrome de Learn.
- Tiles v3 para lo que navega, superficies v3 para lo que informa, botones
  con press, barra de avance que se llena desde 0, porcentaje y nota con
  conteo.
- Todo estado tiene forma: skeleton con la silueta, vacío con Titi, error con
  Reintentar.
- `npx vite build` y los 9 chequeos de Learn/tutor en verde; 1280 y 390 px
  sin scroll horizontal; `prefers-reduced-motion` respetado.

## Riesgos

- `LearnCourse.jsx` tiene contratos de texto vigilados (por ejemplo
  `Lección {currentPosition} de {totalLessons}`): se corre la batería
  después de cada etapa.
- El layout de Learn es de alto fijo en desktop (`lg:h-[calc(100vh-1.5rem)]`)
  con columnas que scrollean solas: el borde de 2 px no puede romper el alto.
