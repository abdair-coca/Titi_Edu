# Spec — Optimización incremental de carga en Learn

## Invariantes

El sistema SHALL conservar exactamente la UI existente, salvo skeletons, estados de
carga y mensajes técnicos necesarios para comunicar progreso. SHALL conservar rutas,
permisos, contratos `{ success, data }`, contenido, progreso y comportamiento del
Tutor. No SHALL usar `localStorage` ni `sessionStorage` para cachear contenido,
credenciales o conversaciones.

## Fase 1 — Shell progresivo y medición

El sistema SHALL mostrar la estructura de Learn y skeletons mientras llegan los datos,
en lugar de reemplazar toda la página con un spinner global. SHALL registrar marcas de
tiempo para shell, lección, Tutor y comentarios.

**Prueba manual:** abrir una lección con caché fría y conexión limitada; el sidebar,
encabezado y espacios de contenido deben aparecer antes de terminar las peticiones.
Registrar TTFB, shell visible y contenido visible. Continuar solo si la espera percibida
mejora sin regresiones visuales.

## Fase 2 — Primera lección sin descarga del módulo completo

La primera lección SHALL solicitar únicamente su detalle y materiales. El sistema no
SHALL descargar todas las lecciones completas del módulo para pintar una sola lección.
El sidebar SHALL seguir usando el resumen del curso.

**Prueba manual:** comparar Network y tamaño de respuesta con la misma lección antes y
después. Debe existir una petición de detalle para la lección activa, sin una descarga
equivalente del módulo completo. Continuar si baja el payload y el contenido aparece
igual o más rápido.

## Fase 3 — Caché, deduplicación y precarga

El sistema SHALL mantener una caché en memoria por curso, lección y usuario activo,
deduplicar peticiones concurrentes y cancelar peticiones obsoletas. SHALL precargar la
siguiente lección después de mostrar la actual, sin bloquearla. Mutaciones de progreso,
notas o publicación SHALL invalidar las entradas afectadas.

**Prueba manual:** abrir una lección, navegar a la siguiente y volver. La segunda
visita no debe repetir la descarga completa; Network debe mostrar hit de caché o una
petición de revalidación pequeña. Continuar si la navegación mejora y la información no
queda obsoleta.

## Fase 4 — Paneles secundarios sin bloquear Learn

Tutor y comentarios SHALL compartir estado de disponibilidad y usar carga diferida.
`chat/status` SHALL ser la fuente inicial de estado del Tutor; no se SHALL repetir una
consulta de credencial que ya venga en esa respuesta. Comentarios SHALL precargarse en
idle o al enfocar su pestaña y reutilizar la caché al abrir el panel.

**Prueba manual:** abrir la lección y usar el contenido antes de abrir Tutor o
Comentarios. Luego abrir cada panel: el panel debe aparecer inmediatamente con skeleton
y completar datos sin bloquear ni reiniciar la lección. Continuar si desaparecen las
peticiones duplicadas y mejora el primer contenido del panel.

## Fase 5 — Código y consulta de comentarios

El sistema SHOULD dividir en chunks Tutor, comentarios, evaluaciones y contenido HTML,
precargando el chunk al enfocar su pestaña. La consulta de comentarios SHALL tener un
índice por lección y fecha y podrá incorporar paginación estable, sin cambiar la UI.

**Prueba manual:** comparar tamaño de chunks iniciales, tiempo de carga de Learn y
tiempo hasta el primer comentario con una lección que tenga muchos comentarios. Continuar
solo si el bundle inicial y el panel mejoran; revertir cualquier chunking que retrase
contenido crítico.

## Criterio de decisión por fase

Cada fase se acepta únicamente si conserva las invariantes, pasa pruebas existentes,
mejora al menos una métrica acordada y no empeora otra de forma significativa. Si no
mejora, se conserva la fase anterior y se detiene la siguiente hasta revisar datos.
