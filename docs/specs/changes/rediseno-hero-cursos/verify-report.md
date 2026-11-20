# Verify — Rediseño del header y hero de cursos

Fecha: 2026-11-20 · entorno: `npm run dev` local (backend local + DBs de dev), Chrome desktop.

## Automático

| Comando | Resultado |
|---|---|
| `npm run build` | OK (SkyScene 9,2 KB gzip; Courses 14,0 KB gzip; HeroScene sin cambios) |
| `npm run test:hero-3d` | OK — `HeroTitle`, `letterSprings` y `heroBridge` agregados al chunk principal sin three |
| resto de `npm run test:*` (12) | OK |

No hay ESLint configurado en el frontend.

## Manual (Chrome, 1482×678 y 390 px en iframe)

| Spec | Qué se vio |
|---|---|
| R1 | Sin promo, chip ni cifras; al cargar no se ve "Aprendé habilidades esenciales". En 390 px sin scroll horizontal. |
| R2 | Título en tres renglones, entrada con saltito; "humanidades"/"matemáticas" entran achicadas. |
| R3 | Tocar la "n" de "nuevo": el dron chico vino, la miró y soltó una gota que rebotó en la "o". Choques del avión registrados contra las letras 0, 12 y 11 en ~10 s (al azar). Viento al paso de drones. |
| R4 | Hover sobre la guitarra → "música."; sobre la paleta → "diseño."; al salir vuelve "hoy.". |
| R5 | Dos globos sobre el título; se apartan del mouse. |
| Capas | El avión cruzó por delante de "nuevo," y de "diseño." y por detrás en otros cruces. |

## Pendiente / observaciones

- En una primera corrida el cielo se apagó por "rendimiento bajo" (monitor de la escena) con la pestaña
  manejada por automatización; en las siguientes no se repitió. Medir FPS en un celular real (tarea 4.3).
- El lienzo medio suma un contexto WebGL en desktop/tablet; en celular no se crea.
