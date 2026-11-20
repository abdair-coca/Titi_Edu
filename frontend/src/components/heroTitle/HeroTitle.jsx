// HeroTitle — título del hero de /courses, letra a letra (change rediseno-hero-cursos).
//
// Tres renglones fijos ("Aprendé" / "algo nuevo," / palabra destacada). Cada
// letra son dos spans: el de afuera no se mueve (el cielo lo mide para saber
// dónde están las letras) y el de adentro es el que se mueve con resortes.
//
// Las letras reaccionan a los golpes que manda el cielo 3D por el puente
// (`bridge`), al mouse y al toque. La palabra destacada cambia al nombre de
// la categoría que el mouse tiene encima en el cuarto (`highlight`).
// No importa three: vive en el chunk principal.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createLetterSprings } from './letterSprings.js';

const DEFAULT_WORD = 'hoy';
const REVERT_MS = 350;
const ENTER_STAGGER_MS = 38;

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Velocidades de cada reacción (ver spec R3).
function impulse(kind, { dir = 1, strength = 1 } = {}) {
  const s = Math.min(1.4, Math.max(0.2, strength));
  switch (kind) {
    case 'wind':
      return { vx: dir * 45 * s, vr: dir * 140 * s, vq: 1.4 * s };
    case 'bounce':
      return { vy: 70 * s, vq: -3.4 * s };
    case 'crash':
      return { vx: dir * 120 * s, vr: dir * 620 * s, vq: -1.6 * s };
    case 'hop':
      return { vy: -300, vq: 1.6 };
    case 'tap':
      return { vy: -440, vq: 2.4, vr: (Math.random() - 0.5) * 160 };
    default:
      return {};
  }
}

function Word({ text, className = '', startIndex }) {
  return (
    <span className={`inline-block ${className}`}>
      {Array.from(text).map((ch, i) => (
        <span key={`${startIndex + i}-${ch}`} data-sky-letter="" className="inline-block">
          <span
            data-letter=""
            className="inline-block origin-bottom transition-opacity duration-150 ease-out will-change-transform"
          >
            {ch}
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * @param {object} bridge  Puente con el cielo 3D y el cuarto (lib/heroBridge.js).
 */
export default function HeroTitle({ bridge }) {
  const rootRef = useRef(null);
  const accentRef = useRef(null);
  const springs = useRef(null);
  const letters = useRef([]);
  const known = useRef(new WeakSet());
  const firstPaint = useRef(true);
  const [reduced] = useState(prefersReduced);
  const [highlight, setHighlight] = useState(null);
  const [word, setWord] = useState(DEFAULT_WORD);

  if (!springs.current) springs.current = createLetterSprings();
  useEffect(() => () => springs.current.dispose(), []);

  // Categoría bajo el mouse en el cuarto (la manda Hero3D por el puente).
  useEffect(() => bridge?.on('roomHover', (nombre) => setHighlight(nombre || null)), [bridge]);

  // La palabra destacada sigue al cuarto; al salir vuelve "hoy" con una pausa
  // (pasar de un objeto a otro no hace parpadear el título).
  useEffect(() => {
    if (highlight) {
      setWord(highlight.toLocaleLowerCase('es'));
      return undefined;
    }
    const id = window.setTimeout(() => setWord(DEFAULT_WORD), REVERT_MS);
    return () => window.clearTimeout(id);
  }, [highlight]);

  // Después de cada render: lista de letras en orden de documento (el mismo
  // orden en que las mide el cielo) y entrada con saltito de las nuevas.
  useLayoutEffect(() => {
    const list = Array.from(rootRef.current.querySelectorAll('[data-letter]'));
    letters.current = list;
    const fresh = list.filter((el) => !known.current.has(el));
    fresh.forEach((el) => known.current.add(el));
    if (!reduced && fresh.length) {
      const big = firstPaint.current;
      fresh.forEach((el, i) =>
        springs.current.enter(el, (big ? 120 : 0) + i * (big ? ENTER_STAGGER_MS : 28), big ? undefined : { y: 22, q: -0.25 }),
      );
    }
    firstPaint.current = false;
  });

  // La palabra destacada nunca desborda la columna: se achica si es larga.
  // Después avisa al cielo que vuelva a medir las letras.
  useLayoutEffect(() => {
    const line = accentRef.current;
    if (!line) return undefined;
    const fit = () => {
      line.style.transform = '';
      const avail = line.parentElement.clientWidth;
      const needed = line.scrollWidth;
      if (needed > avail && avail > 0) line.style.transform = `scale(${(avail / needed).toFixed(3)})`;
      bridge?.emit('relayout');
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(line.parentElement);
    return () => ro?.disconnect();
  }, [word, bridge]);

  // Golpes que manda el cielo.
  useEffect(() => {
    if (!bridge || reduced) return undefined;
    return bridge.on('hit', ({ index, kind, dir, strength }) => {
      springs.current.kick(letters.current[index], impulse(kind, { dir, strength }));
    });
  }, [bridge, reduced]);

  // Mouse: saltito al pasar. Toque/click: saltito más grande y avisa al cielo.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return undefined;
    let lastHover = null;
    const letterOf = (e) => e.target.closest?.('[data-letter]');
    const onOver = (e) => {
      if (e.pointerType !== 'mouse') return;
      const el = letterOf(e);
      if (!el || el === lastHover) return;
      lastHover = el;
      springs.current.kick(el, impulse('hop'));
    };
    const onLeave = () => {
      lastHover = null;
    };
    const onClick = (e) => {
      const el = letterOf(e);
      if (!el) return;
      springs.current.kick(el, impulse('tap'));
      bridge?.emit('letterTap', { index: letters.current.indexOf(el) });
    };
    root.addEventListener('pointerover', onOver);
    root.addEventListener('pointerleave', onLeave);
    root.addEventListener('click', onClick);
    return () => {
      root.removeEventListener('pointerover', onOver);
      root.removeEventListener('pointerleave', onLeave);
      root.removeEventListener('click', onClick);
    };
  }, [bridge, reduced]);

  return (
    <h1
      ref={rootRef}
      data-sky="title"
      className="font-black text-titi-dark tracking-[-0.035em] leading-[0.92] text-[clamp(3rem,min(18cqi,14svh),6.5rem)] mb-5 sm:mb-6 select-none"
    >
      <span className="sr-only">Aprendé algo nuevo, hoy.</span>
      <span aria-hidden="true">
        <span className="block whitespace-nowrap">
          <Word text="Aprendé" startIndex={0} />
        </span>
        <span className="block whitespace-nowrap">
          <Word text="algo" startIndex={7} /> <Word text="nuevo," startIndex={11} />
        </span>
        <span className="block whitespace-nowrap">
          <span ref={accentRef} className="inline-block origin-bottom-left">
            <Word key={word} text={word} startIndex={17} className="text-titi-streak" />
            <Word text="." startIndex={99} />
          </span>
        </span>
      </span>
    </h1>
  );
}
