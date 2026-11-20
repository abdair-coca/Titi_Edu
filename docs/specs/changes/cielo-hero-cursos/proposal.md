# Proposal — Cielo 3D en el header de cursos

> **Estado:** implementado y verificado en headless; falta medir en un celular real.
> Complementa a `habitacion-3d-cursos` (el cuarto no cambia).

## Intención

El catálogo `/courses` ya tiene la habitación 3D de Titi a la derecha del hero,
pero el resto del header (barra amarilla, título, buscador y cifras) es
estático. Queremos que se sienta **vivo**: objetos 3D con el mismo estilo del
cuarto que vuelan por detrás del texto (drones, un avión de papel, gotas y
nubes) y responden al mouse y al toque, sin tapar nunca lo que hay que leer o
usar.

## Alcance

### Dentro

- Lienzo 3D nuevo (`components/heroSky/`) detrás de la barra amarilla y la
  columna de texto del hero, en un chunk diferido propio.
- Elenco en desktop/tablet: dron repartidor con un librito, dron chico, avión
  de papel con estela, gotas que suben y nubes. En celular: repartidor + avión.
- Interacción: el repartidor esquiva el mouse y el dron chico lo mira; al
  tocar, los drones hacen un rizo/voltereta y sueltan una gota que cae sobre
  el buscador, el avión hace un tirabuzón, las gotas salpican y las nubes se
  aplastan. Todo visual (no da gotas reales ni navega).
- Piezas compartidas con la habitación (luz de ambiente, soporte 3D, forma de
  la gota) movidas a módulos comunes, sin cambiar el cuarto.
- Docs: `design.md` §10/§12/§14, `motion.md` §4 y excepciones, `AGENTS.md`.

### Fuera

- La `Navbar` (no se toca).
- Objetos dentro del cuarto o alrededor de él (el cielo termina antes).
- Modelos de terceros: todo se arma con figuras básicas en código.
- Imagen de respaldo para el cielo: si el 3D no conviene, el header queda como hoy.

## Decisiones tomadas (del usuario)

1. Zona: toda la parte del header de la captura (barra amarilla, badge,
   título, párrafo, buscador y cifras); la `Navbar` no cambia.
2. three.js, con el mismo estilo de luz suave que el cuarto.
3. Elenco propuesto (repartidor, dron chico, avión, gotas, nubes) con estilo Titi.
4. Interactivos (esquivar/mirar al mouse, rizo + gota al tocar).
5. Intensidad "vivo".
6. Dos objetos en celular (repartidor + avión).
7. En desktop el cielo cubre la barra amarilla y la columna izquierda; los
   objetos no se acercan al cuarto.
8. Los objetos pasan **por detrás** del texto, la barra y el buscador.
9. Sin 3D → sin objetos (no hay imagen de respaldo).

## Riesgos

- **Rendimiento con dos lienzos** (cielo + cuarto). Mitigación: el cielo es
  liviano (~6,7 KB gzip, sin sombras), comparte three con el cuarto, se pausa
  fuera de pantalla y se apaga a la **primera** caída de FPS para dejarle los
  recursos al cuarto.
- **Legibilidad:** objetos detrás del texto. Mitigación: el texto siempre va
  encima, el avión es celeste claro y las trayectorias salen de medir el texto
  real para no pasar por el buscador.
- **Toques accidentales:** un toque en el buscador, botones o links nunca
  llega al 3D.

## Criterios de éxito

- [x] El cielo se ve en desktop y celular detrás del texto, con el elenco acordado.
- [x] Esquivar/mirar con el mouse; rizo/voltereta + gota al tocar (mouse y dedo).
- [x] Nunca tapa ni intercepta el buscador; el scroll en celular sigue libre.
- [x] Reduced-motion, sin WebGL o ahorro de datos: sin lienzo ni descarga.
- [x] `Courses` sin three (11,8 KB gzip) y el cuarto sin cambios de peso.
- [ ] FPS medidos en un celular de gama media real con cielo + cuarto.
