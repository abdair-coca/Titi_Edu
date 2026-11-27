# Verify report — Learn con el lenguaje v3

> **Change:** `rediseno-learn-v3` · **Fecha:** 2026-11-23
> **Estado:** implementado y verificado con datos simulados; falta probarlo
> contra la API real y en un celular.

## Automático

| Comando | Resultado |
|---|---|
| `cd frontend && npx vite build` | verde después de cada etapa |
| `test:learn-init`, `test:learn-active-lesson`, `test:learn-cache`, `test:learn-panels`, `test:learn-code-split` | OK |
| `test:tutor-key-banner`, `test:tutor-history`, `test:html-lesson`, `test:rag` | OK (también tras la segunda vuelta del tutor) |
| Backend | sin cambios (`git diff` vacío en `backend/`) |
| Emojis y glifos de UI (✓ ✕ ✗ ← → ☰ ⌄ ⛶ 🏁 🎓 🔁) en los archivos tocados | ninguno (queda una flecha dentro de un comentario de código) |
| `bg-gradient-*`, `blur-*`, `text-[10/11px]`, "XP" visibles en lo tocado | ninguno |

## Visual (Playwright + Chromium, API simulada con `page.route`)

Sesión falsa de estudiante en `localStorage`, respuestas de ejemplo para
curso, progreso, lección, nota, comentarios, estado del tutor, evaluación,
intentos e inventario; movimiento reducido. 1280 y 390 px. **Cero scroll
horizontal y cero errores de consola** (salvo los 403/500 que la propia
escena simula).

| Escena | 1280 | 390 | Notas |
|---|---|---|---|
| Lección sin completar / completada | ok | ok | ruta de nodos, avance en panel oscuro, "Siguiente" con el título que sigue; completada → pastilla verde y "Seguí con" en amarillo |
| Notas, materiales, comentarios | ok | ok | pestaña activa amarilla; materiales con insignia por tipo; con el panel abierto la barra de acción pasa a dos filas |
| Aviso de clave del tutor | ok | ok | superficie con insignia amarilla, botón oscuro, copy en voseo |
| Tutor abierto (vacío) | ok | ok | acciones rápidas como tiles con insignia, copy en voseo |
| Tutor: conversación con DIL, quiz, otra lección | ok | ok | burbujas con borde oscuro y avatar, pasos unidos, aviso con insignia, tabla con cabecera amarilla, quiz con letra, fuentes numeradas |
| Tutor sin clave / ajustes de la clave | ok | ok | bienvenida con Titi y llave; clave conectada en verde con Reemplazar / Eliminar |
| Actividad HTML evaluable | ok | ok | marco oscuro, cifras en grilla 2×2 con insignias |
| Curso completado | ok | ok | panel oscuro con Titi `celebra` y "Ver mi certificado" |
| Evaluación: intro, formulario, resultado, bloqueada | ok | ok | cifras con conteo, opciones con letra, avance de respuestas, correcciones con check/cruz, intento extra |
| Índice en celular (cajón) | — | ok | botón con `aria-expanded`, cerrar con ícono y Esc |
| No inscrito, error, sin lecciones | ok | ok | vacío con Titi; el error reintenta sin recargar |

Capturas: `scratchpad/learn/despues/` de la sesión (el "antes" en
`scratchpad/learn/antes/`).

## Arreglado en el camino

- Con una evaluación abierta, el índice seguía resaltando la última lección:
  ahora se resalta solo la evaluación.
- `esNueva` llegaba del progreso pero no se mostraba: las lecciones nuevas
  llevan la pastilla "Nueva".
- Tuteo en las acciones rápidas del tutor ("Explícame", "Hazme", "Crea" →
  "Explicame", "Haceme", "Creá"; también en los prompts que se ven como
  pregunta) y en la actividad HTML ("Puedes" → "Podés").
- Las cifras de la actividad HTML se apretaban en 4 columnas dentro de la
  columna central: ahora van en 2×2.
- Tildes que faltaban en el aviso del certificado ("está", "código",
  "verificación", "único") y tuteo en el aviso de la clave ("Conecta",
  "Reemplázala" → "Conectá", "Reemplazala").

## Pendiente

- Probar con la API real (curso con video, lección HTML evaluable, evaluación
  con plazo) y en un celular.
- Probar el tutor con Groq real (respuestas largas, diagramas Mermaid) y
  la actividad HTML con un puntaje enviado desde el iframe.
