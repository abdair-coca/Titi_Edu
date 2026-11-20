# Proposal — Rediseño del header y hero de cursos

> **Estado:** en curso.
> Cambia el texto del hero y el elenco de `cielo-hero-cursos`; el cuarto de
> `habitacion-3d-cursos` no cambia (solo avisa qué objeto tiene el mouse encima).

## Intención

Los objetos 3D de `/courses` (cuarto, drones, avión) son lo mejor del hero,
pero el texto que los rodea quedó plano y recargado: barra amarilla, chip,
párrafo de tres líneas y cifras. Queremos un hero **premium, minimalista y
cartoon** donde la tipografía sea protagonista y **juegue con el 3D**: las
letras reaccionan a los objetos que vuelan, a las gotas que caen y al mouse.

## Alcance

### Dentro

- Quitar barra amarilla de promo, chip "Comunidad de aprendizaje" y cifras.
  El párrafo queda en una sola línea corta.
- Título en Nunito 900 extra grande, una palabra/línea por renglón
  ("Aprendé / algo nuevo, / hoy."), cada letra animable por separado.
- El hero ocupa toda la primera pantalla en desktop: al entrar no se ve
  "Aprendé habilidades esenciales".
- Interacción letras ↔ 3D: viento al paso de drones y avión, gotas que rebotan
  sobre las letras, saltito al pasar el mouse, tocar una letra llama al dron
  más cercano, y el avión choca a veces contra una letra **al azar**.
- Puente con el cuarto: al pasar el mouse por un objeto, "hoy" cambia por el
  nombre de su categoría.
- Las nubes se reemplazan por globos que se revientan y sueltan gotas.
- Las gotas que suben desde las cifras se van (ya no hay cifras).

### Fuera

- El cuarto 3D y su layout (texto izquierda, cuarto derecha) no cambian.
- La `Navbar` y el resto de la página.
- Fuentes o dependencias nuevas.

## Decisiones tomadas (del usuario, 2026-11-20)

1. Quitar promo, chip y cifras; acortar el párrafo; que al entrar no se vea la
   sección de habilidades esenciales.
2. Tipografía: Nunito XXL letra a letra (sin fuente nueva).
3. Interacciones: reaccionan al paso, gotas que rebotan, mouse en las letras,
   puente con el cuarto.
4. Layout del hero igual (texto izquierda, cuarto derecha, cielo detrás del texto).
5. Sin nubes: globos que se revientan.
6. Choque del avión: la letra se tambalea y vuelve; el avión hace un tirabuzón
   y sigue. La letra se elige al azar en cada choque.
