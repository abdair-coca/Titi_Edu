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
- Proporciones medidas sobre la imagen: el blanco del ojo se ve alrededor de
  toda la pupila (pupila un poco abajo y hacia adentro, brillo arriba a la
  izquierda); la "w" de la boca queda justo bajo la nariz y **encima** del
  bigote; cada mitad del bigote nace en una comisura, baja abriéndose (~1,5
  veces el ancho de la cabeza) y la punta sube; la chivita termina en punta.
- Hecho con figuras en código (esferas, cápsulas, barridos y una cola continua
  con esqueleto). Sin archivos nuevos.

## T1b — Estilo y acabado

- Sombreado toon estilizado: en la luz, los colores de T1 salen **exactos**
  (sin tone mapping); en la sombra, un tono diseñado por material (cálido en el
  pelaje, gris lavanda en lo blanco), nunca marrón sucio. Terminador suave en
  dos escalones, brillo suave y luz de contorno.
- Usa las mismas luces y sombras del cuarto: si pasa bajo un mueble, se
  oscurece. El factor de luz se normaliza con la suma de las luces (si cambian
  sus intensidades, Titi no se quema ni se apaga).
- Sin granulado del mapa de sombras sobre Titi (desvío normal propio, solo para
  él; el del cuarto no cambia).
- Contorno de dibujo animado en un tono oscuro de cada color (no negro), de
  grosor fijo en pantalla: ~1 px en el cuarto, hasta ~2,6 px de cerca.
- Pupilas y nariz con brillo real (reflejan el ambiente del cuarto).

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
- Micro-vida: parpadeo con ease (a veces doble) en el que las cejas bajan un
  poco; la mirada salta de reojo cada 1–3 s; el bigote "olfatea" cada 3–8 s;
  una oreja se sacude cada 4–10 s; la cabeza deriva despacio en reposo; la
  respiración mueve pecho, cabeza y hombros; la cola ondula de la base a la
  punta y se queda atrás un instante al girar. Agitado (cargado, cayendo,
  mareado) no mira de reojo ni olfatea.
- Expresión por modo: cejas arriba y puntas del bigote arriba al saludar y
  celebrar; cejas de sorpresa y bigote caído colgando; ceño al aterrizar; una
  ceja levantada al pensar; cejas y bigote temblando al marearse.

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
- Sentado quieto, la micro-vida no fuerza a redibujar el mapa de sombras
  (movimiento por frame por debajo del umbral de `RoomRig.poke`).
- El acabado (contornos y cola continua) no suma más de ~10 llamadas de dibujo
  por frame a la página.
