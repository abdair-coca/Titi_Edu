---
name: titi-html-authoring
description: "Trigger: crear HTML para Titi, actividad HTML, juego HTML, evaluación HTML, TITI_SCORE. Genera HTML autocontenido compatible con el executor aislado de Titi."
license: Apache-2.0
metadata:
  author: "abdair-coca"
  version: "1.0"
---

# HTML para Titi

## Activation Contract

Usá esta skill al crear documentación, juegos o actividades HTML para lecciones Titi.

## Hard Rules

- HTML autocontenido: CSS, JavaScript e imágenes inline o `data:`.
- No uses recursos externos, `iframe`, `object`, `embed`, `form`, `link` ni `src` remoto.
- El executor usa `sandbox="allow-scripts"`; no dependas de cookies, DOM padre ni `event.origin`.
- Actividad evaluable debe enviar score `0..100` con el contrato Titi.
- Documentación o juego sin score usa completado manual.

## Decision Gates

| Caso | Acción |
|---|---|
| Juego, quiz o actividad | Enviar score al terminar cada intento. |
| Documentación o tutorial | No enviar score; dejar completar manualmente. |
| Librería o imagen externa | Inlinear/reemplazar antes de entregar. |

## Execution Steps

1. Partí de `assets/titi-html-template.html`.
2. Reemplazá contenido sin eliminar el contrato `TITI_SCORE` si es evaluable.
3. Enviá el mejor score del intento usando `window.__TITI_ATTEMPT_TOKEN`.
4. Probá recarga, score inválido y límite de intentos desde Titi.

## Output Contract

Entregá archivo `.html`, modo (`evaluable` o `manual`) y cómo se dispara el score.

## References

- `assets/titi-html-template.html` — plantilla autocontenida.
- `docs/api.md` — contrato de lecciones HTML.
