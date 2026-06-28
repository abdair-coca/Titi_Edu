# Animaciones de Titi (mascota)

Animaciones WebP del personaje. `TitiMascot` mapea cada **estado** a un archivo de
esta carpeta vía `src/components/titi/titiAssets.js`. **Si un archivo no existe, la
app cae al `/Titi.png` estático** (no se rompe nada). Con `prefers-reduced-motion`
activado también se muestra el PNG estático.

## Estados → archivos (los 6 presentes)

| Estado | Archivo | Loop | Cuándo aparece |
|---|---|---|---|
| **idle** | `idleTiti.webp` | sí | Estado base / reposo. Default, el que más se ve. |
| **celebra** | `celebrationTiti.webp` | no | Ganar gotas, completar misión/curso, aprobar evaluación, logro. |
| **triste** | `sadTiti.webp` | no | Racha rota, error, estados vacíos ("no encontré nada"). |
| **racha** | `streakTiti.webp` | sí | Racha activa / motivado. |
| **saludo** | `grettingTiti.webp` | no | Bienvenida en Login/Register/onboarding. |
| **pensando** | `curiousTiti.webp` | sí | Esperas / carga larga (opcional). |

Los "moods" antiguos (`happy`, `sad`, `fire`…) se mapean a estos estados en
`titiAssets.js` (`MOOD_TO_STATE`), así la API del componente sigue siendo
retrocompatible.

## Notas

- **Formato:** WebP animado. Los `.gif` fuente viven en `frontend/public/GifTiti/`
  (**gitignored** — no van al build de Vite).
- **Cambiar una animación:** poné el WebP en esta carpeta (cualquier nombre) y
  apuntá el `src` del estado en `titiAssets.js`. No hace falta renombrar el archivo.
- **Peso:** los WebP actuales pesan ~2–5 MB c/u. Si en el futuro hay que aligerar la
  carga, se pueden reexportar a menor fps/escala — pero **no se tocan** salvo pedido
  explícito.
