# Verify report — Navegación, completitud dinámica y notas HTML en Learn

## Resultado

Implementación verificada. La navegación persiste `lessonId`, el progreso usa
todo el contenido publicado actual y las inscripciones obsoletas se reabren sin
borrar certificados históricos.

## Evidencia

- `cd backend && npm test` — 30 archivos, 288 tests aprobados.
- `cd frontend && npm run test:html-lesson` — contrato de seguridad y navegación HTML aprobado.
- `cd frontend && npm run build` — build de producción aprobado.

## Cobertura de regresión

- Lecciones publicadas después de la inscripción cuentan en progreso y completitud.
- Inscripciones completadas con lecciones pendientes vuelven a `completado: false`.
- Score HTML inválido o token inválido no escribe datos.
- Score HTML válido persiste progreso y mejor nota.
- Repetición del token HTML es idempotente.
- Una nota HTML no completa el curso si quedan lecciones pendientes.

## Observaciones

El build mantiene la advertencia preexistente de chunks grandes de Vite; no
impide la compilación ni introduce errores nuevos.
