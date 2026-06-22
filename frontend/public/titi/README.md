# Animaciones de Titi (mascota)

Acá van las animaciones del personaje. El componente `TitiMascot` las toma por
su nombre de archivo. **Mientras un archivo no exista, la app cae al
`/Titi.png` estático** (no se rompe nada).

## Cómo se usan

`TitiMascot` mapea cada estado a un archivo de esta carpeta:

| Estado | Archivo | Loop | Cuándo aparece |
|---|---|---|---|
| **idle** | `titi-idle.gif` | sí (infinito) | Estado base / en reposo. Titi vivo aunque no pase nada (respira, parpadea). Es el default y el que más se ve. |
| **celebra** | `titi-celebra.gif` | no (1–2 veces y queda) | Ganar gotas, completar misión, desbloquear logro, subir de nivel, completar curso, aprobar evaluación, bienvenida alegre. |
| **triste** | `titi-triste.gif` | no | Racha rota, error, estados vacíos ("no encontré nada", feed vacío). Desánimo suave, nada dramático. |
| **racha** | `titi-racha.gif` | sí (infinito) | Racha activa / motivado. Energía, llamita, ojos decididos. |
| **saludo** | `titi-saludo.gif` | no | Bienvenida en Login/Register/onboarding. Saluda con la mano y queda en idle. |
| **pensando** | `titi-pensando.gif` | sí (infinito) | (Opcional) esperas/carga larga. Mira, se rasca la cabeza. |

> **Prioridad para arrancar:** `idle`, `celebra`, `triste`, `racha` (las 4 que
> usa la gamificación). `saludo` y `pensando` son un plus.

## Especificación técnica

- **Formato:** ideal **WebP animado** o **APNG** (transparencia suave, mejor
  calidad). GIF también sirve, pero su transparencia es dura (borde dentado):
  si usás GIF, exportalo con **fondo transparente** o sobre el crema `#FFFBF0`.
  Si usás WebP/APNG, igual nombralos `.gif`… **no** — usá la extensión real y
  avisame para ajustar `titiAssets.js` (hoy apunta a `.gif`).
- **Lienzo:** cuadrado, **512×512 px** (se escala hacia abajo). Titi centrado,
  con aire alrededor (no pegado a los bordes).
- **Fondo:** transparente (sin caja ni sombra "quemada"; la sombra la pone la app).
- **Peso:** **< 400 KB** por animación (la carga del feed debe seguir < 2 s).
- **Duración:** 1.5–3 s por ciclo. Las de loop tienen que enlazar suave (el
  último frame conecta con el primero).
- **Estilo:** fiel al `Titi.png` — mono **amarillo**, **bigote blanco**, ojos
  grandes con brillo, cola enroscada. Plano, cálido, tipo Duolingo.

## Nombres de archivo (exactos)

```
public/titi/titi-idle.gif
public/titi/titi-celebra.gif
public/titi/titi-triste.gif
public/titi/titi-racha.gif
public/titi/titi-saludo.gif      (opcional)
public/titi/titi-pensando.gif    (opcional)
```

Dejá los archivos con **ese nombre exacto** en esta carpeta y listo: el
componente los usa solo. Si cambiás formato (`.webp`/`.png` animado), avisá
para actualizar `src/components/titi/titiAssets.js`.
