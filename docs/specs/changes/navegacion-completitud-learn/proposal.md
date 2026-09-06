# Proposal — Navegación y completitud dinámica en Learn

## Intención

Corregir la navegación de lecciones, el contador de posición y la detección de
completitud en cursos cuyo contenido se publica progresivamente. También se
agregan regresiones para proteger la entrega de notas de presentaciones HTML.

## Alcance

### Incluye

- Persistir la lección activa en `?lessonId=` y restaurarla al recargar.
- Separar posición actual de progreso completado.
- Contar todas las lecciones actualmente publicadas de módulos publicados.
- Reabrir inscripciones que quedaron completadas con contenido pendiente.
- Conservar certificados históricos sin emitir nuevos hasta completar el curso.
- Cubrir configuración, entrega, límites e idempotencia de HTML evaluable.

### No incluye

- Rediseño visual general de Learn.
- Cambios al contrato de `TITI_SCORE`.
- Revocación o eliminación de certificados históricos.
- Cambios sobre contenido en borrador o lecciones archivadas.

## Criterios de éxito

- Recargar la lección 5 conserva la lección 5.
- La UI muestra `Lección X de Y` y el porcentaje sigue representando completadas.
- Una lección publicada después de la inscripción impide una completitud falsa.
- El mismo token HTML no duplica intentos ni cambia una nota ya registrada.
- Backend, contrato HTML y build frontend pasan.
