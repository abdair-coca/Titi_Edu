# animationTiti.md — Sistema de animación de la mascota Titi

> Subfase **6.4** de la Etapa 6. Define cómo Titi pasa de un PNG estático a una
> mascota **animada y fiel al arte**, con un flujo de trabajo simple: vos creás
> las animaciones (GIFs hechos con IA), las dejás en una carpeta, y la app las
> usa sola.

---

## 1. Objetivos

1. **Mascota viva y fiel al arte.** Titi se anima (idle, celebra, triste, racha…)
   manteniendo su identidad: mono **amarillo**, **bigote blanco**, ojos grandes,
   cola enroscada.
2. **Reactiva a eventos.** La animación cambia según lo que pasa: ganar gotas →
   celebra, racha rota → triste, racha activa → racha.
3. **Flujo de trabajo sin fricción.** Agregar/cambiar una animación = dejar un
   archivo en una carpeta. Cero código por animación nueva.
4. **A prueba de faltantes.** Si una animación todavía no existe, la app cae al
   `Titi.png` estático (nunca se rompe ni se ve vacía).
5. **Accesible y liviana.** Respeta `prefers-reduced-motion` (muestra estático) y
   cada animación pesa poco (el feed sigue cargando < 2 s).

---

## 2. Jerarquía de carpetas

```
frontend/
├── animationTiti.md                  ← este documento
├── public/
│   ├── Titi.png                       ← PNG original (poster + fallback universal)
│   └── titi/                          ← AQUÍ van las animaciones
│       ├── README.md                  ← spec técnica para crear los archivos
│       ├── titi-idle.gif              ← animación de reposo
│       ├── titi-celebra.gif
│       ├── titi-triste.gif
│       ├── titi-racha.gif
│       ├── titi-saludo.gif            (opcional)
│       └── titi-pensando.gif          (opcional)
└── src/
    └── components/
        ├── TitiMascot.jsx             ← componente que reproduce la animación del estado
        └── titi/
            └── titiAssets.js          ← config: mapea estado → archivo (único lugar a tocar)
```

**Regla de oro:** los archivos de animación viven en `public/titi/` con el
nombre exacto `titi-<estado>.<ext>`. El componente los toma por ese nombre.

---

## 3. Cómo funciona (flujo de trabajo)

```
1. Creás la animación (GIF/WebP/APNG con IA)  →  fiel al Titi.png
2. La nombrás titi-<estado>.gif               →  ej. titi-celebra.gif
3. La dejás en frontend/public/titi/
4. (Listo) TitiMascot la usa automáticamente cuando el estado = <estado>
```

- El componente resuelve el **estado** desde la prop `mood` (lo que ya usa la
  app) o `state` directo. Mapeo en `titiAssets.js` (`MOOD_TO_STATE`).
- Si el archivo **no existe** → `onError` cae a `/Titi.png` (estático).
- Con **reduced-motion** → muestra `/Titi.png` (sin animación).

**Spec técnica de los archivos** (formato, tamaño, peso, estilo): ver
`public/titi/README.md`. Resumen: 512×512, fondo transparente, < 400 KB,
ideal WebP animado/APNG (GIF también sirve).

---

## 4. Animaciones necesarias

| Estado | Archivo | Loop | Cuándo | Prioridad |
|---|---|---|---|---|
| idle | `titi-idle.gif` | sí | reposo (respira/parpadea) | 🔴 core |
| celebra | `titi-celebra.gif` | no | gota, misión, logro, nivel, curso/eval aprobada | 🔴 core |
| triste | `titi-triste.gif` | no | racha rota, error, estado vacío | 🔴 core |
| racha | `titi-racha.gif` | sí | racha activa / motivado | 🔴 core |
| saludo | `titi-saludo.gif` | no | bienvenida (login/register) | 🟡 plus |
| pensando | `titi-pensando.gif` | sí | esperas/carga larga | 🟡 plus |

---

## 5. Subfase 6.4.1 — Prueba de pipeline (una sola animación)

**Objetivo:** validar el flujo completo con **una** animación antes de producir
las demás. Si la prueba pasa, se crean el resto.

**Pasos:**
1. Existe una animación de prueba en `public/titi/` integrada al estado `idle`.
2. `TitiMascot` la reproduce donde Titi está en reposo (empty states, etc.).
3. Los estados sin archivo (`celebra`, `triste`…) caen al `Titi.png` estático.

**✅ Verificación (criterios para pasar):**
- [ ] En una pantalla con Titi en reposo, la mascota **se anima** (no es el PNG quieto).
- [ ] En una pantalla con otro estado aún sin archivo, se ve el **Titi.png** (fallback, sin error visible).
- [ ] Con `prefers-reduced-motion` activado, Titi queda **estático**.
- [ ] `npm run build` del frontend pasa.
- [ ] Reemplazar el archivo de prueba por el GIF real (mismo nombre) **no requiere tocar código**.

**Cuando pase:** se reemplaza el placeholder por el `titi-idle.gif` real y se
crean `celebra`, `triste`, `racha` (core), luego los plus.

---

## 6. Estado actual

- ✅ `titiAssets.js` (config estado→archivo) y `TitiMascot.jsx` (reproductor con
  fallback + reduced-motion) listos.
- 🔄 **6.4.1 en curso:** prueba con una animación (placeholder) integrada a `idle`.
- ⏳ Pendiente: animaciones reales `idle`/`celebra`/`triste`/`racha` y wiring
  reactivo a eventos de gamificación (gota→celebra, etc.) en la subfase 6.5 (UI).
