# Spec — Navegación, completitud dinámica y notas HTML en Learn

## U1 — Navegación persistente de lecciones

El reproductor SHALL usar `lessonId` como fuente de verdad de la lección activa.
Seleccionar una lección SHALL actualizar la URL sin perder `comments`; una URL
válida SHALL restaurar esa lección al recargar y la navegación atrás/adelante
SHALL cambiar la lección visible. Una URL ausente o inválida SHALL usar la
primera lección disponible.

El contador SHALL mostrar la posición actual (`Lección X de Y`). El porcentaje
de progreso SHALL continuar calculándose únicamente con lecciones completadas.

### Escenarios

- **DADO** un curso con cinco lecciones **CUANDO** se selecciona la quinta
  **ENTONCES** la URL contiene su `lessonId` y el contador muestra `Lección 5 de 5`.
- **DADO** una URL con `lessonId` válido **CUANDO** se recarga Learn
  **ENTONCES** se carga esa lección y no la primera.
- **DADO** un `lessonId` inexistente **CUANDO** se abre Learn
  **ENTONCES** se usa la primera lección sin dejar una selección inválida.

## U2 — Completitud contra contenido publicado actual

El sistema SHALL recalcular la completitud usando todas las lecciones publicadas
de módulos publicados, sin excluir lecciones por su fecha posterior a la
inscripción. Borradores y archivadas SHALL quedar fuera. Una lección pendiente
o evaluación requerida no SHALL permitir completar el curso.

Una inscripción marcada completada que ya tenga contenido publicado pendiente
SHALL reabrirse automáticamente. Los certificados existentes SHALL conservarse
como histórico y seguir verificables, pero no SHALL emitirse uno nuevo hasta una
nueva completitud válida.

### Escenarios

- **DADO** una lección publicada después de la inscripción y pendiente
  **CUANDO** se recalcula el curso **ENTONCES** `completado` es falso.
- **DADO** una inscripción completada con una nueva lección pendiente
  **CUANDO** se consulta o recalcula el progreso **ENTONCES** se reabre la
  inscripción y no se crea otro certificado.
- **DADO** borradores o lecciones archivadas **CUANDO** se calcula el total
  **ENTONCES** no se incluyen en el denominador.

## U3 — Regresión de HTML evaluable con nota

El flujo SHALL aceptar una presentación HTML evaluable válida con intentos y
fecha límite, registrar un `TITI_SCORE` válido con su token, persistir el intento
y mejor nota, completar la lección y permanecer idempotente al repetir el token.
Scores inválidos, tokens ajenos o inválidos, mensajes no confiables, intentos
agotados y entregas vencidas SHALL rechazarse sin escrituras parciales.

### Escenarios

- **DADO** HTML evaluable válido **CUANDO** llega un score entre 0 y 100 con
  token vigente **ENTONCES** se guarda el intento y la mejor nota.
- **DADO** un token ya procesado **CUANDO** se repite con otra nota
  **ENTONCES** se devuelve el resultado original sin duplicar ni sobrescribir.
- **DADO** score fuera de rango, token inválido, plazo vencido o intentos agotados
  **CUANDO** se envía la nota **ENTONCES** responde error y no modifica progreso.
