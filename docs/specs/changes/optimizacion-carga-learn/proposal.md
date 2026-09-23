# Propuesta — Optimización incremental de carga en Learn

## Intención

Reducir el tiempo percibido y real de carga de Learn sin rediseñar la interfaz ni
cambiar el flujo pedagógico. La optimización se entregará en cinco fases aisladas;
después de cada fase se medirá la mejora y se decidirá si continúa el trabajo.

## Alcance

- Eliminar waterfalls y descargas redundantes de curso, módulo y lección.
- Renderizar el shell de Learn progresivamente con skeletons.
- Cachear y precargar lecciones, comentarios y disponibilidad del Tutor.
- Cargar paneles secundarios bajo demanda sin bloquear el contenido principal.
- Mejorar consulta e índices de comentarios y dividir código no crítico.

## Fuera de alcance

- Cambios de colores, layout, navegación, textos funcionales o interacción visual.
- Persistencia de API keys o conversaciones en el navegador.
- Cambios en la lógica pedagógica, permisos, contrato de autenticación o RAG.
- Despliegue automático o cambios de infraestructura no medidos.

## Criterio de éxito

Cada fase debe poder desplegarse y revertirse de forma independiente. La decisión de
continuar se tomará comparando las mismas métricas antes y después, con una prueba
manual reproducible en desktop y móvil.
