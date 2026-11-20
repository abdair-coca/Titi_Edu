# Proposal — Habitación 3D en el hero de cursos

> **Estado:** implementado y verificado en headless; falta medir en un celular real.
> Reemplaza la escena del change `hero-3d-cursos` (objetos flotando alrededor de Titi).

## Intención

La primera escena 3D de `/courses` (8 objetos en anillo alrededor de Titi)
funcionaba, pero se veía como íconos sueltos. La reemplazamos por un diorama
isométrico: **la sala de estudio de Titi**, un cuarto cortado (piso y dos
paredes con el espesor a la vista) lleno de muebles y adornos, al estilo de la
portada de threejs-journey.com. Los 8 objetos de categoría quedan en su lugar
natural dentro del cuarto (laptop en el escritorio, libros en la repisa,
guitarra contra la pared…) y siguen siendo la forma de filtrar el catálogo.

El cuarto se puede girar arrastrando, sigue un poco al mouse y esconde
sorpresas en los adornos, para que el catálogo transmita "acá se aprende
jugando".

## Alcance

### Dentro

- Escena nueva en `components/hero3d/` (mismo contrato de `Hero3D`: chunk
  diferido, respaldo a imagen, pausa fuera de pantalla).
- Luz suave tipo "horneada" (sombras con penumbra, oclusión en los rincones,
  luz de ambiente generada en el navegador). La UI de la página sigue plana.
- Interacción: arrastrar para girar, paralaje con el mouse, hover/click en las
  categorías y sorpresas en adornos.
- Pista "Arrastrá para girar" en el hero.
- Poster nuevo (`/hero/hero-3d-poster.webp`) tomado de la escena final.
- Docs: `design.md` §10/§12/§14, `motion.md` §4, `CREDITS.md`, `AGENTS.md`.

### Fuera

- Varias habitaciones con flechas para cambiar (la referencia lo tiene; no hace falta).
- Titi dentro del cuarto (decisión del usuario: no aparece).
- Modelos 3D nuevos de terceros: todo lo que no es categoría se arma con
  figuras básicas en código.
- Postprocesado, HDR externos o dependencias nuevas.

## Decisiones tomadas (del usuario)

1. Estilo como la referencia: luz y sombras suaves, no toon. Paleta Titi más
   maderas cálidas. Solo el render WebGL tiene luz suave; el HTML/CSS sigue plano.
2. Sin Titi en la escena (se quita el `<TitiMascot>` superpuesto).
3. Interacciones: arrastrar para girar (±35°, el gesto vertical en celular
   sigue scrolleando), hover + click en las 8 categorías, paralaje con el
   mouse y al menos 3 sorpresas en adornos (nunca en las categorías).

## Riesgos

- **Rendimiento:** más geometría y sombras suaves. Mitigación: sombras que se
  redibujan solo cuando algo se mueve, calidad alta solo en desktop, monitor de
  rendimiento que baja la calidad y, si hace falta, vuelve a la imagen.
- **Peso:** el chunk 3D crece ~9 KB gzip (sombras suaves, cajas redondeadas);
  no hay modelos nuevos.
- **Descubrimiento:** que se entienda qué objetos se tocan. Mitigación: saltito
  periódico de un objeto de categoría y etiqueta al hover.

## Criterios de éxito

- [x] La habitación se ve en desktop y mobile, con respaldo a imagen cuando corresponde.
- [x] Arrastrar gira el cuarto; en celular el deslizamiento vertical scrollea la página.
- [x] Hover muestra el nombre de la categoría; click filtra y baja a Tendencias.
- [x] Al menos 3 sorpresas en adornos (hay 7).
- [x] `Courses` sigue sin three (~10,5 KB gzip) y el LCP no empeora de forma relevante.
- [ ] FPS medidos en un celular de gama media real.
