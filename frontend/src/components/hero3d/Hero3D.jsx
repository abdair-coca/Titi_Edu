// Hero3D — columna visual del hero de /courses (spec hero-3d-cursos).
//
// Vive en el chunk principal y NO importa three: decide si conviene mostrar la
// escena 3D y, solo entonces, descarga `HeroScene` (chunk diferido). Mientras
// tanto, y siempre que el 3D no convenga o falle, se ve la imagen estática.
//
// Respaldo a imagen (spec H5): reduced-motion, sin WebGL, ahorro de datos, sin
// categorías con modelo, error de carga, pérdida de contexto o rendimiento bajo.
import { Suspense, lazy, useCallback, useRef, useState } from 'react';
import { HandIcon } from '../icons.jsx';
import { SceneBoundary, canShow3D, useIdleLoad, useInViewActive, useIsMobile } from './support.js';

const HeroScene = lazy(() => import('./HeroScene.jsx'));

/**
 * @param {Array}    items     Categorías con modelo: { id, nombre, slug }, ordenadas por cantidad de cursos.
 * @param {Function} onSelect  Recibe el id de la categoría tocada.
 * @param {Function} onHover   Recibe la categoría bajo el mouse (o null al salir).
 * @param {string}   poster    Imagen estática (respaldo y candidata a LCP).
 * @param {string}   alt       Texto alternativo de la imagen.
 */
export default function Hero3D({ items, onSelect, onHover, poster, alt, width, height }) {
  const boxRef = useRef(null);
  const [allowed] = useState(canShow3D);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dragged, setDragged] = useState(false);
  const mobile = useIsMobile();
  const onFirstDrag = useCallback(() => setDragged(true), []);

  const wants3D = allowed && !failed && items.length > 0;
  const load = useIdleLoad(wants3D);
  const active = useInViewActive(boxRef, load);

  const fail = (reason) => {
    if (import.meta.env.DEV) console.info('[hero3d] vuelve a la imagen:', reason);
    setFailed(true);
    setReady(false);
  };

  const showScene = wants3D && load;
  const sceneOn = showScene && ready;

  return (
    <div ref={boxRef} className="relative rounded-2xl overflow-hidden bg-titi-cream">
      <img
        src={poster}
        alt={alt}
        width={width}
        height={height}
        loading="eager"
        fetchpriority="high"
        aria-hidden={sceneOn || undefined}
        className={[
          'w-full h-auto object-cover select-none transition-opacity duration-300 ease-out',
          sceneOn ? 'opacity-0' : 'opacity-100',
        ].join(' ')}
        draggable={false}
      />

      {showScene && (
        <div
          aria-hidden="true"
          className={[
            'absolute inset-0 transition-opacity duration-300 ease-out',
            sceneOn ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          <SceneBoundary onFail={fail}>
            <Suspense fallback={null}>
              <HeroScene
                items={items}
                mobile={mobile}
                active={active}
                onSelect={onSelect}
                onHover={onHover}
                onReady={() => setReady(true)}
                onFail={fail}
                onFirstDrag={onFirstDrag}
              />
            </Suspense>
          </SceneBoundary>

          {/* Pista de arrastre: se va con el primer giro. */}
          <span
            className={[
              'absolute left-3 bottom-3 inline-flex items-center gap-1.5 pointer-events-none',
              'px-3 py-1.5 bg-white border-2 border-titi-dark rounded-full shadow-[0_3px_0px_#1A1A2E]',
              'text-xs font-extrabold text-titi-dark transition-opacity duration-300 ease-out',
              sceneOn && !dragged ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
          >
            <HandIcon className="w-4 h-4" />
            Arrastrá para girar
          </span>
        </div>
      )}
    </div>
  );
}
