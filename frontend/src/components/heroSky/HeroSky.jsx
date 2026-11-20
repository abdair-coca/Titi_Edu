// HeroSky — cielo 3D detrás del hero de /courses (changes cielo-hero-cursos y
// rediseno-hero-cursos).
//
// Vive en el chunk principal y NO importa three: decide si conviene mostrar el
// cielo, mide el texto del hero para armar los carriles de vuelo y, solo
// entonces, descarga `SkyScene` (chunk diferido). Si el 3D no conviene o falla,
// no pinta nada: el header queda igual que siempre.
//
// El lienzo de fondo va detrás del texto (`-z-10` dentro de un contenedor
// `isolate`). En desktop/tablet hay un segundo lienzo (avión y globos) cuya
// capa cambia entre detrás (-5) y delante (10) del texto: lo maneja SkyScene.
// Ninguno recibe eventos: los toman del contenedor (`eventSource`), así se
// puede tocar un dron aunque pase por detrás del título.
import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  SceneBoundary,
  canShow3D,
  useIdleLoad,
  useInViewActive,
  useIsMobile,
  useMediaQuery,
} from '../hero3d/support.js';
import { measureSky } from './skyLayout.js';

const SkyScene = lazy(() => import('./SkyScene.jsx'));

const DESKTOP_QUERY = '(min-width: 1024px)';
const EDGE_FADE_PX = 64;

const sameLayout = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Mide los carriles y vuelve a medir cuando cambia el tamaño del hero o del
// texto (resize, fuentes que terminan de cargar, cifras que llegan de la API).
function useSkyLayout(regionRef, textRef, desktop, enabled, bridge) {
  const [layout, setLayout] = useState(null);
  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const region = regionRef.current;
    const text = textRef.current;
    if (!region || !text) return undefined;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = measureSky(region, text, desktop);
        setLayout((prev) => (sameLayout(prev, next) ? prev : next));
      });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(region);
    ro?.observe(text);
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure).catch(() => {});
    // La palabra destacada del título cambió (no siempre cambia el tamaño).
    const off = bridge?.on('relayout', measure);
    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
      off?.();
      window.removeEventListener('resize', measure);
    };
  }, [regionRef, textRef, desktop, enabled, bridge]);
  return layout;
}

// Dónde está el mouse: solo el puntero fino hace que los drones esquiven o
// miren. En touch no hay hover; los objetos responden al toque.
function usePointerPresence(regionRef, enabled) {
  const pointer = useRef({ inside: false });
  useEffect(() => {
    const el = regionRef.current;
    if (!el || !enabled) return undefined;
    const onMove = (e) => {
      pointer.current.inside = e.pointerType === 'mouse';
    };
    const onLeave = () => {
      pointer.current.inside = false;
    };
    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [regionRef, enabled]);
  return pointer;
}

/**
 * @param {object} regionRef  Contenedor del hero (origen del lienzo y fuente de eventos).
 * @param {object} textRef    Columna de texto del hero.
 * @param {object} bridge     Puente con las letras del título (lib/heroBridge.js).
 */
export default function HeroSky({ regionRef, textRef, bridge }) {
  const [allowed] = useState(canShow3D);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [midHost, setMidHost] = useState(null);
  const mobile = useIsMobile();
  const desktop = useMediaQuery(DESKTOP_QUERY);

  const wants3D = allowed && !failed;
  const load = useIdleLoad(wants3D);
  const layout = useSkyLayout(regionRef, textRef, desktop, wants3D && load, bridge);
  const active = useInViewActive(regionRef, load);
  const pointerRef = usePointerPresence(regionRef, load);

  const fail = (reason) => {
    if (import.meta.env.DEV) console.info('[heroSky] se apaga el cielo:', reason);
    setFailed(true);
    setReady(false);
  };

  if (!wants3D || !load || !layout) return null;

  const frame = {
    left: layout.offsetX,
    width: layout.width,
    height: layout.height,
    // En desktop el lienzo termina antes del cuarto: los objetos se funden
    // en vez de cortarse en seco (máscara de borde, no un fondo degradado).
    ...(layout.fadeRight && {
      maskImage: `linear-gradient(to right, #000 calc(100% - ${EDGE_FADE_PX}px), transparent)`,
      WebkitMaskImage: `linear-gradient(to right, #000 calc(100% - ${EDGE_FADE_PX}px), transparent)`,
    }),
  };
  const fade = ['transition-opacity duration-300 ease-out', ready ? 'opacity-100' : 'opacity-0'].join(' ');

  return (
    <>
      <div aria-hidden="true" className={`absolute top-0 -z-10 pointer-events-none select-none ${fade}`} style={frame}>
        <SceneBoundary onFail={fail}>
          <Suspense fallback={null}>
            <SkyScene
              layout={layout}
              mobile={mobile}
              active={active}
              pointerRef={pointerRef}
              bridge={bridge}
              eventSource={regionRef}
              midHost={mobile ? null : midHost}
              onReady={() => setReady(true)}
              onFail={fail}
            />
          </Suspense>
        </SceneBoundary>
      </div>
      {!mobile && (
        <div
          ref={setMidHost}
          aria-hidden="true"
          className={`absolute top-0 pointer-events-none select-none ${fade}`}
          style={{ ...frame, zIndex: -5 }}
        />
      )}
    </>
  );
}
