# Spec — Rediseño del header y hero de cursos

Requisitos del hero de `/courses` tras el rediseño. Complementa a
`cielo-hero-cursos` (C1–C6 siguen valiendo salvo lo que cambia acá).

---

## R1 — Contenido

- El hero muestra solo: título, una línea de texto, buscador y el cuarto 3D.
- Sin barra de promo, sin chip, sin cifras.
- Desktop (≥ 1024 px): el bloque del hero mide al menos el alto de la
  pantalla menos lo que hay arriba (navbar y margen), con el contenido
  centrado en vertical. Al cargar no se ve la sección siguiente.

## R2 — Título

- Nunito 900, tamaño fluido (≈ 3,25 rem en celular, hasta ≈ 6 rem en
  desktop), interletrado apretado, tres renglones fijos:
  "Aprendé" / "algo nuevo," / palabra destacada en naranja (`hoy.`).
- Cada letra es un elemento propio que se puede mover sin cambiar el layout.
- Lectores de pantalla leen el título entero una sola vez (las letras sueltas
  están ocultas para ellos).
- Entrada: las letras aparecen con un saltito escalonado.
- La palabra destacada nunca desborda la columna: si es más larga, se achica.

## R3 — Letras ↔ 3D

| Disparador | Reacción de la letra |
|---|---|
| Dron o avión pasan cerca | se inclina en el sentido del vuelo y se estira, como empujada por el viento |
| Una gota cae encima | se aplasta y rebota; la gota rebota sobre la letra |
| El avión choca (al azar, a veces) | se tambalea con rebote tipo gelatina y vuelve a su lugar |
| Mouse encima (puntero fino) | saltito |
| Toque o click | saltito, y el dron más cercano vuela hasta la letra, la mira y le suelta una gota |

- El choque del avión no es fijo: en cada cruce se sortea si choca y contra
  qué letra. Tras el golpe el avión retrocede mareado, hace un tirabuzón y se
  va por donde vino.
- El repartidor suelta a veces una gota sobre una letra al azar mientras cruza.
- Ninguna reacción mueve el layout ni tapa el texto por más de un instante:
  todas vuelven a su lugar en menos de ~1,5 s.

## R4 — Puente con el cuarto

- Pasar el mouse por un objeto del cuarto cambia la palabra destacada por el
  nombre de su categoría en minúsculas (ej. `diseño.`); al salir vuelve `hoy.`
  tras una pausa breve. Las letras nuevas entran con saltito.

## R5 — Globos

- Reemplazan a las nubes (solo desktop/tablet, como las nubes): 2 globos que
  flotan despacio por la franja de arriba del título y se apartan del mouse.
- Al tocarlos revientan (pop + salpicadura) y sueltan gotas que caen sobre
  las letras. Vuelven a entrar por un costado a los pocos segundos.

## R5b — Detrás y delante (pedido del usuario, 2026-11-20)

- El avión y los globos pasan por detrás **y** por delante de las letras,
  como si fueran parte del escenario (lienzo medio que cambia de capa; solo
  desktop/tablet). Cada paseo del avión sortea el lado y en la cima del rizo
  pide cambiar; el choque va por delante. El cambio de capa solo ocurre
  cuando ni el avión ni los globos tocan letras, párrafo o buscador.
- Drones y gotas siguen siempre detrás del texto.

## R6 — Buscador

- Al enfocar el buscador los drones lo miran.

## R7 — Accesibilidad y respaldo

- Sin 3D (reduced-motion, sin WebGL, ahorro de datos, rendimiento bajo) el
  hero se ve igual pero quieto: con reduced-motion las letras no se mueven.
- Un toque sobre letras, buscador, botones o links no llega a los objetos 3D.
