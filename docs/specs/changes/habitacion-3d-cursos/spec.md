# Spec — Habitación 3D en el hero de cursos

Requisitos de la escena 3D del hero de `/courses`. Describen el qué; el cómo
queda en `tasks.md`. Lo que no se nombra acá sigue igual que en la spec de
`hero-3d-cursos` (ubicación H1, respaldo H5, accesibilidad H7, licencias H8).

---

## R1 — La habitación

- Vista isométrica de un cuarto cortado: piso de tablas y dos paredes (fondo e
  izquierda) con el espesor a la vista en otro tono (núcleo amarillo Titi, cara
  interior amarillo claro; piso con canto de madera oscura).
- Contenido mínimo: ventana, repisas, escritorio con cajonera, silla, lámpara,
  planta, reloj, diploma, notas, atril con pintura, banquito, alfombra, puf,
  pelota, pila de libros y guirnalda de luces.
- Titi **no** aparece en la escena (ni modelo ni `<TitiMascot>` encima). El
  nombre "Titi" va pintado en la pared.
- Paleta: amarillo `#FFD93D`, amarillo claro `#FFF3B0`, amarillo oscuro
  `#E6B800`, crema `#FFFBF0`, oscuros `#1A1A2E`/`#16213E`, racha `#FF6B35`,
  logro `#A855F7`, certificado `#F59E0B` y maderas cálidas.
- El cuarto entra completo en la caja del hero (relación 4:3) en desktop
  (~706 px, columna del cuarto al 60 %) y mobile (~347 px, sin margen de aire
  alrededor del cuarto).

## R2 — Luz suave ("horneada")

- Materiales mate estándar (no toon), con los colores de cada modelo.
- Una luz principal con sombras de penumbra suave (PCSS en desktop, PCF en
  mobile), luz hemisférica y luz de ambiente generada en el navegador con
  paneles emisivos. **Sin HDR externo ni descargas extra.**
- Oclusión ambiental pintada (rincones y unión pared/piso) y manchas de
  contacto bajo los muebles.
- Tono neutro (`NeutralToneMapping`) para respetar los colores de la marca.
- Sin postprocesado. El HTML/CSS de la página sigue plano (sin
  `bg-gradient-*` ni `blur-*`).

## R3 — Objetos de categoría

- Los 8 modelos existentes (`public/models/hero/`) van dentro del cuarto:
  laptop y calculadora en el escritorio, libros en la repisa de arriba, globo y
  matraz en la de abajo, guitarra contra la pared, paleta sobre el banquito y
  maletín en el piso.
- Se muestran todas las categorías que existen en la API y tienen modelo, en
  desktop **y en mobile** (antes mobile mostraba 4).
- **Hover:** el objeto sube y crece con rebote (≤ 400 ms), aparece una pill con
  el nombre de la categoría y el cursor pasa a puntero.
- **Click / tap:** filtra el catálogo por esa categoría y baja a "Cursos en
  tendencia" (igual que antes).
- Cada objeto tiene un área de toque del tamaño del modelo (mínimo 0,3
  unidades por lado) para que los chatos se toquen fácil sin tapar vecinos.
- **Pista:** al aparecer saludan con un saltito escalonado (≤ 3 a la vez) y
  cada 4,5 s uno da otro saltito.

## R4 — Interacción con el cuarto

- **Arrastrar** (mouse o dedo, horizontal): gira el cuarto, tope ±35°. Al
  soltar queda donde quedó y, tras 4 s sin tocarlo, vuelve solo al frente.
- En touch el lienzo usa `touch-action: pan-y`: un deslizamiento vertical
  scrollea la página y no gira el cuarto. La rueda nunca se captura.
- Soltar después de arrastrar no cuenta como click (ni en categorías ni en
  sorpresas) y durante el arrastre no aparecen etiquetas.
- **Paralaje** (solo mouse): el cuarto sigue levemente al puntero (±3,4° de
  giro, ±2° de inclinación).
- **Pista HTML:** chip "Arrastrá para girar" con ícono de mano, abajo a la
  izquierda del hero (estilo Titi: `rounded-full`, `border-2`, sombra dura).
  Se va con el primer arrastre. No aparece en la imagen de respaldo.

## R5 — Sorpresas en adornos

Al tocar un adorno pasa algo corto (≤ 400 ms) y divertido; los adornos tienen
cursor de puntero y un pop leve al hover. Nunca navegan.

| Adorno | Sorpresa |
|---|---|
| Lámpara del escritorio | se apaga / prende (luz real) |
| Planta | se sacude |
| Reloj (hora real) | las agujas dan una vuelta |
| Gota de juguete | rebota con estirón y aplastón |
| Pelota | rueda al otro lado de la alfombra |
| Silla | gira una vuelta |
| Puf | se aplasta y vuelve |

## R6 — Rendimiento y peso

- three/R3F/drei siguen solo en el chunk diferido; `Courses` no crece de forma
  relevante (~10,5 KB gzip).
- Sin modelos nuevos: presupuesto total de modelos ≤ 600 KB (hoy 87 KB).
- Calidad alta solo en desktop (DPR 1,5, antialias, PCSS); mobile DPR 1, sin
  antialias, sombras PCF de 1024.
- El mapa de sombras se redibuja solo mientras algo se mueve.
- Monitor de rendimiento tras 3 s: la primera caída baja a calidad baja; a la
  tercera vuelve a la imagen. Sin tope superior de FPS (en pantallas de
  120/144 Hz el monitor anterior podía volver a la imagen sin motivo).
- Objetivo ≥ 50 FPS en laptop y ≥ 30 FPS en celular de gama media.
- LCP en Fast 3G sin empeorar de forma relevante respecto de la escena anterior.

## Casos borde

- **Reduced motion, sin WebGL o ahorro de datos:** imagen estática, sin chunk.
- **Categoría sin lugar en el cuarto:** no aparece (hoy las 8 tienen lugar).
- **Resize:** la cámara reencuadra el cuarto sin recargar nada.
- **Navegar fuera:** se liberan texturas, materiales y el entorno de luz.
