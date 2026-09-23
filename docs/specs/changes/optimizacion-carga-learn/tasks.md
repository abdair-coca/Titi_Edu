# Tasks — Optimización incremental de carga en Learn

## Preparación

- [ ] Definir una lección de prueba pequeña y otra con muchos comentarios.
- [ ] Capturar baseline en desktop y móvil: TTFB, shell visible, lección visible,
      tamaño de respuestas, tamaño de chunks y tiempo de apertura de paneles.
- [ ] Confirmar que las pruebas no registren contenido, prompts ni credenciales.

## Fase 1 — Shell y medición

- [x] Añadir marcas de rendimiento y skeletons sin cambiar layout ni estilos funcionales.
- [ ] Ejecutar prueba fría y registrar resultado.
- [ ] Decidir continuar/revertir con evidencia.

## Fase 2 — Lección activa

- [x] Cambiar la carga inicial para pedir solo el detalle de la lección activa.
- [x] Conservar el resumen del curso para sidebar y navegación.
- [x] Verificar payload, contenido, materiales y permisos.
- [ ] Decidir continuar/revertir.

## Fase 3 — Datos reutilizables

- [x] Crear módulo de caché/deduplicación con invalidación explícita.
- [x] Precargar siguiente lección sin bloquear la actual.
- [ ] Verificar cambio de lección, atrás/adelante, logout y usuario distinto.
- [ ] Decidir continuar/revertir.

## Fase 4 — Tutor y comentarios

- [x] Compartir disponibilidad del Tutor entre aviso visible y panel.
- [x] Eliminar consulta duplicada de credencial cuando `chat/status` ya la incluye.
- [x] Precargar/cachear comentarios con skeleton no bloqueante.
- [ ] Verificar errores 401/403, lección no indexada y usuario fuera de canary.
- [ ] Decidir continuar/revertir.

## Fase 5 — Chunks y consultas

- [x] Dividir módulos secundarios y precargar por intención del usuario.
- [x] Añadir índice de comentarios y paginación estable para no traer toda la tabla en una sola lectura.
- [ ] Comparar bundle inicial y panel de comentarios con baseline.
- [ ] Decidir continuar/revertir.

## Verificación por fase

- [x] `npm run test:rag`
- [x] `npm run test:tutor-history`
- [x] `npm run test:learn-init`
- [x] `npm run test:learn-active-lesson`
- [x] `npm run test:learn-cache`
- [x] `npm run test:learn-panels`
- [x] `npm run test:learn-code-split`
- [x] `npm test -- --run test/routes/lessons.test.js`
- [x] `npm run build`
- [ ] Prueba manual desktop/móvil y registro de métricas.
