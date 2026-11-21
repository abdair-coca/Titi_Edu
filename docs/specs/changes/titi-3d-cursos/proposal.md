# Proposal — Titi 3D en el cuarto de cursos

> **Estado:** implementado; falta probar el arrastre y medir FPS en un navegador
> a velocidad real y en un celular.
> Cambia una decisión de `habitacion-3d-cursos` ("Titi no aparece en la escena").

## Intención

El cuarto 3D de `/courses` es "la sala de estudio de Titi", pero Titi no está.
Lo sumamos como un personaje 3D hecho con three.js, **fiel a las fotos que ya
tenemos** (`public/Titi.png` y las animaciones de `public/titi/`), que vive en
el cuarto: tiene vida propia, se puede tocar y se puede agarrar y soltar.

## Decisiones del usuario (2026-11-20)

- Movimiento: todo junto. Vivo en su lugar (respira, parpadea, mira al mouse),
  camina solo por el cuarto, el usuario lo arrastra y es articulado (brazos,
  piernas y cola por partes).
- Modelo: geometría three.js en código (sin archivo GLB).
- Ubicación: en el piso, sentado en la alfombra, de frente a la cámara.

## Alcance

### Dentro

- Modelo articulado en `components/hero3d/titi/` con los rasgos de las fotos:
  pelaje `#FBCA2F`, antifaz claro, ojos grandes con brillo, nariz oscura,
  sonrisa en "w", bigote blanco enorme con las puntas para arriba, cejas y
  chivita blancas, mechón, orejas con interior dorado, manos y pies marrón
  claro y cola larga que termina en espiral.
- Comportamiento: se sienta, mira alrededor, camina a otro punto libre, saluda,
  piensa (mano en el mentón); al tocarlo celebra; al arrastrarlo cuelga del
  puntero y al soltarlo cae, se aplasta y se marea.
- `RoomRig` cede el gesto a Titi: mientras lo cargan, el cuarto no gira.
- Test de contrato en Node (`npm run test:titi-3d`).

### Fuera

- Archivos de modelo externos, texturas o dependencias nuevas.
- Que Titi interactúe con los muebles (empujar la pelota, subirse al puf).
- Sonidos.
- Cambiar el poster estático (sigue siendo el cuarto sin Titi).
