# Spec — Cielo 3D en el header de cursos

Requisitos del cielo 3D detrás del header de `/courses`. Describen el qué; el
cómo queda en `tasks.md`. La habitación (`habitacion-3d-cursos`) no cambia.

---

## C1 — Zona

- El lienzo va detrás de la barra amarilla y de la columna de texto del hero
  (badge, título, párrafo, buscador y cifras). La `Navbar` no cambia.
- **Desktop (≥ 1024 px, dos columnas):** desde el borde izquierdo de la
  pantalla hasta la mitad del espacio entre columnas; el borde derecho se
  funde (máscara de 64 px) para que nada se corte en seco junto al cuarto.
- **Una columna (< 1024 px):** de borde a borde de la pantalla, desde la
  barra amarilla hasta las cifras. El cuarto (más abajo) queda fuera.
- El texto, la barra y el buscador quedan **encima**: los objetos pasan por
  detrás. El lienzo es `aria-hidden` y no recibe foco.

## C2 — Estilo

- Mismo lenguaje que la habitación: materiales mate estándar, luz hemisférica
  cálida, luz principal, relleno frío y luz de ambiente con paneles emisivos
  (la misma de la habitación). `NeutralToneMapping`. Sin sombras ni postprocesado.
- Paleta de la habitación (`roomLayout.js` → `COLORS`). Figuras básicas en
  código, sin modelos de terceros.
- Cámara en perspectiva de frente; los objetos se inclinan un poco para que
  se vea su parte de arriba.

## C3 — Elenco y movimiento ("vivo")

| Objeto | Dónde | Movimiento | Celular |
|---|---|---|---|
| Dron repartidor (amarillo, visor con ojos, librito violeta colgando) | fila del badge, entre la barra y el título | cruza de lado a lado cada 5–7 s alternando sentido; balanceo, hélices girando, librito que acompaña | ✅ |
| Dron chico (naranja, antena) | hueco a la derecha del párrafo (si entra, ≥ 84 px) | ronda en ocho, parpadea | — |
| Avión de papel (celeste, franja amarilla) | por debajo del párrafo | cruza en 7–8,5 s; a mitad hace un rizo que sube sobre el texto; estela punteada amarilla que se borra | ✅ |
| Gotas (forma y ojitos de la gota del cuarto) | de las cifras hacia el buscador | 3 suben escalonadas y se esfuman antes del buscador | — |
| Nubes crema | todo el alto, al fondo | cruzan en ~20–30 s | — |

- Las trayectorias salen de **medir el texto real** (atributos `data-sky`) y
  se recalculan con cada cambio de tamaño, fuente o datos. Ningún carril pasa
  por el buscador.

## C4 — Interacción

- **Mouse (puntero fino):** el repartidor esquiva el cursor (radio 110 px) y
  el dron chico lo mira y crece un poco al pasarle por encima. En touch no
  hay esquive ni mirada.
- **Click / toque** (mouse o dedo), aunque el objeto esté detrás del texto:

| Objeto | Respuesta |
|---|---|
| Dron repartidor | rizo hacia abajo (0,8 s) y suelta una gota |
| Dron chico | voltereta en el lugar con saltito (0,8 s) y suelta una gota |
| Gota que cae | cae, rebota hasta 2 veces sobre el borde del buscador (o el piso del lienzo) y se va |
| Avión | tirabuzón (0,65 s) |
| Gota que sube | salpica en 6 gotitas y vuelve a empezar |
| Nube | se aplasta y rebota (0,45 s) |

- Cursor de puntero sobre un objeto, salvo sobre la UI.
- Un toque sobre el **buscador, botones, links o labels nunca** llega al 3D.
- Todo es visual: no da gotas reales, no navega, no filtra.
- El scroll vertical en celular sigue libre (no se captura ningún gesto).

## C5 — Rendimiento y peso

- three/R3F/drei solo en chunks diferidos; `Courses` y `HeroSky` no los
  importan (lo vigila `npm run test:hero-3d`).
- three se comparte con la habitación (un solo chunk); el cielo suma
  ~7 KB gzip.
- Carga diferida cuando el navegador queda libre tras la carga (como el cuarto).
- DPR 1,5 con antialias en desktop; DPR 1 sin antialias en celular.
- Se pausa fuera de pantalla o con la pestaña oculta.
- Monitor de rendimiento tras 3 s: a la **primera** caída sostenida se apaga
  el cielo (prioridad a la habitación). Pérdida de contexto → se apaga.

## C6 — Respaldo

- Reduced-motion, sin WebGL, ahorro de datos, error, pérdida de contexto o
  rendimiento bajo: **no se monta** (ni se descarga el chunk); el header queda
  como siempre. No hay imagen de respaldo.

## Casos borde

- **Resize / cambio de layout:** se vuelve a medir y los objetos se reubican
  sin recargar.
- **Sin hueco a la derecha del párrafo:** el dron chico no aparece.
- **Usuario logueado con menú lateral fijo:** el lienzo arranca en el borde de
  la pantalla por debajo del menú (que queda encima).
- **Navegar fuera:** se libera el lienzo y el cursor del contenedor vuelve a normal.
