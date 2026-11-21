# Spec — Titi 3D en el cuarto de cursos

Requisitos del personaje. Lo que no se nombra acá sigue igual que en la spec de
`habitacion-3d-cursos` (respaldo a imagen, chunk diferido, giro del cuarto,
categorías y sorpresas), salvo R1 de esa spec: ahora Titi **sí** está en la
escena.

---

## T1 — Fiel a las fotos

- Fuente de verdad: `frontend/public/Titi.png` y las animaciones de
  `frontend/public/titi/`. Colores tomados de la imagen: pelaje `#FBCA2F`,
  antifaz `#FCDC55`, panza `#FDDF6E`, interior de orejas `#DB9A0A`, manos y pies
  `#CA855B`, blancos `#FDFDF1`, ojos y nariz `#171C32`, boca `#C47F3C`.
- Rasgos obligatorios: cabeza grande y redonda; antifaz claro alrededor de los
  ojos y el hocico; ojos grandes con pupila oscura y brillo; nariz oscura con
  brillo; sonrisa en "w"; bigote blanco más ancho que la cabeza, que baja y
  enrosca las puntas hacia arriba; cejas blancas; chivita blanca en el mentón;
  mechón de pelo en la coronilla; orejas redondas a los costados; brazos largos;
  ancas anchas al sentarse; manos y pies marrón claro con dedos; cola larga que
  sale al costado y termina en espiral visible de frente.
- Sentado mide ~1,1 de alto en el cuarto (escala 1,1): más bajo que el
  escritorio (1,42), bien visible en la alfombra.
- Hecho con figuras en código (esferas, cápsulas, tubos). Sin archivos nuevos.

## T2 — Vida propia

- Empieza sentado en la alfombra, de frente a la cámara.
- Siempre: respira, parpadea cada 2–5 s, mueve la cola y gira la cabeza hacia
  la cámara, desviada hacia donde está el mouse (solo con puntero fino; en
  touch mira a la cámara). Si lo que mira queda detrás, no tuerce el cuello.
- Cada tanto se levanta, camina a otro punto y ahí se sienta, mira alrededor,
  saluda a la cámara o piensa con la mano en el mentón.
- Camina solo dentro de una zona libre de muebles alrededor de la alfombra
  (rectángulo x −1,35…0,9, z −1,3…1,0): nunca atraviesa muebles.
- Los cambios de pose son suaves (amortiguación), sin saltos.

## T3 — Tocar y arrastrar

- **Tocar** (sin mover el puntero más de 6 px): celebra con los brazos arriba,
  dos saltitos y la boca abierta; luego vuelve a sentarse. Si está cargado o
  cayendo, tocar no hace nada.
- **Arrastrar:** queda colgando del puntero a 0,5 de altura, con los brazos
  arriba, las piernas y la cola balanceándose según la velocidad. Nunca sale de
  la zona libre (se queda en el borde).
- **Soltar:** cae con gravedad, se aplasta al tocar el piso, se marea (sacude la
  cabeza) y se sienta.
- Mientras lo cargan, el cuarto **no gira** y las categorías no muestran su
  etiqueta al pasar por encima; soltarlo no cuenta como click.
- Sobre Titi el cursor es de puntero. Su área de toque es algo más grande que el
  cuerpo para tocarlo fácil en mobile.
- En touch el lienzo sigue con `touch-action: pan-y`: arrastrarlo en vertical
  scrollea la página (Titi cae donde quedó).

## T4 — Rendimiento

- Mancha de contacto bajo Titi que se achica y aclara cuando está en el aire.
- Desktop: proyecta sombra real; el mapa de sombras se redibuja solo en los
  cuadros en que Titi se movió de verdad.
- Mobile: sin sombra real (solo la mancha), para no redibujar sombras por él.
- Pausa junto con la escena fuera de pantalla; tras volver, sin saltos (paso
  máximo de 1/20 s).
- Sin dependencias nuevas; el código de Titi viaja en el chunk diferido de la
  escena (nunca en el principal).
