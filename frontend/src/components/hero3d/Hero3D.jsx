// Hero3D — columna visual del hero de /courses (spec hero-3d-cursos).
//
// Vive en el chunk principal y NO importa three: decide si conviene mostrar la
// escena 3D y, solo entonces, descarga `HeroScene` (chunk diferido). Mientras
// tanto, y siempre que el 3D no convenga o falle, se ve la imagen estática.
//
// Respaldo a imagen (spec H5): reduced-motion, sin WebGL, ahorro de datos, sin
// categorías con modelo, error de carga, pérdida de contexto o rendimiento bajo.
import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { HandIcon } from '../icons.jsx';

const HeroScene = lazy(() => import('./HeroScene.jsx'));

const MOBILE_QUERY = '(max-width: 639px)';

function canShow3D() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  if (navigator.connection?.saveData) return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

// Perfil liviano en pantallas chicas (spec H6). Escucha el cambio de ancho para
// reacomodar la escena sin recargar modelos.
function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => setMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}

// La escena nunca rompe la página: cualquier error (modelo que no carga, chunk
// que falla) vuelve a la imagen.
class SceneBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    this.props.onFail(`error: ${error?.message}`);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * @param {Array}    items     Categorías con modelo: { id, nombre, slug }, ordenadas por cantidad de cursos.
 * @param {Function} onSelect  Recibe el id de la categoría tocada.
 * @param {string}   poster    Imagen estática (respaldo y candidata a LCP).
 * @param {string}   alt       Texto alternativo de la imagen.
 */
export default function Hero3D({ items, onSelect, poster, alt, width, height }) {
  const boxRef = useRef(null);
  const [allowed] = useState(canShow3D);
  const [load, setLoad] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(true);
  const [dragged, setDragged] = useState(false);
  const mobile = useIsMobile();
  const onFirstDrag = useCallback(() => setDragged(true), []);

  const wants3D = allowed && !failed && items.length > 0;

  // Descarga diferida: cuando el navegador está libre después de la carga, así
  // el chunk 3D no compite con la imagen del hero (LCP).
  useEffect(() => {
    if (!wants3D || load) return undefined;
    let idleId;
    let timeoutId;
    const start = () => {
      if (window.requestIdleCallback) idleId = window.requestIdleCallback(() => setLoad(true), { timeout: 2000 });
      else timeoutId = window.setTimeout(() => setLoad(true), 300);
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      window.removeEventListener('load', start);
      if (idleId) window.cancelIdleCallback?.(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [wants3D, load]);

  // Pausa el render fuera de pantalla o con la pestaña oculta (spec H6).
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !load) return undefined;
    let inView = true;
    const update = () => setActive(inView && document.visibilityState === 'visible');
    const obs = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => {
          inView = entry.isIntersecting;
          update();
        })
      : null;
    obs?.observe(el);
    document.addEventListener('visibilitychange', update);
    return () => {
      obs?.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, [load]);

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
