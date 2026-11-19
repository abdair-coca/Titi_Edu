// AuthScene — Titi y su "constelación social" para las pantallas de auth.
//
// Un solo componente para móvil y desktop (un solo Titi montado). Vive sobre el
// mismo fondo que el formulario: no es un panel aparte.
//
// Microinteracciones:
// - Titi mira hacia el puntero (solo con mouse; ±6°, gsap.quickTo).
// - Da un saltito con cada tecla que se escribe (`typingTick`).
// - Tocar a Titi: festeja, cambia de frase y suelta tres gotas.
// - Tocar un chip: el chip rebota y Titi comenta sobre él (racha, gotas, amigos).
// Con prefers-reduced-motion se apaga todo el movimiento; los textos siguen cambiando.
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import TitiMascot from '../TitiMascot.jsx';
import { FlameIcon } from '../StreakBadge.jsx';
import { usePopIn, MOTION } from '../../lib/motion.js';
import { GotaIcon } from '../icons.jsx';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TAP_LINES = [
  '¡Ja! Eso hace cosquillas',
  '¿Seguimos donde lo dejamos?',
  'Hoy es un gran día para aprender',
  'Tus amigos ya están estudiando',
];

const CHIPS = [
  {
    id: 'amigo',
    label: 'Ana empezó Cálculo I',
    short: 'Ana',
    detail: 'Tu amiga, hace 5 min',
    reaction: { state: 'saludo', bubble: 'Ana ya va por el módulo 2. ¡Alcancémosla!' },
    position: '-left-[30%] top-[16%] lg:-left-[34%]',
    delay: '0s',
  },
  {
    id: 'racha',
    label: '12 días',
    short: '12',
    detail: 'de racha',
    reaction: { state: 'racha', bubble: '¡12 días seguidos! No la cortemos hoy' },
    position: '-right-[24%] top-[54%] lg:-right-[30%]',
    delay: '-1.6s',
  },
  {
    id: 'gotas',
    label: '+20 gotas',
    short: '+20',
    detail: 'Lección completada',
    reaction: { state: 'celebra', bubble: 'Cada lección completada suma gotas' },
    position: '-left-[16%] bottom-[2%] lg:-left-[22%]',
    delay: '-3.2s',
  },
];

function ChipIcon({ id }) {
  if (id === 'amigo') {
    return (
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-500 text-[11px] font-black text-white lg:h-9 lg:w-9 lg:text-xs">
        AM
      </span>
    );
  }
  if (id === 'racha') {
    return (
      <span className="grid h-8 w-8 shrink-0 place-items-center lg:h-9 lg:w-9">
        <FlameIcon size={26} animated={false} />
      </span>
    );
  }
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-titi-yellow text-titi-dark lg:h-9 lg:w-9">
      <GotaIcon className="h-4 w-4 lg:h-5 lg:w-5" />
    </span>
  );
}

// Chip: el wrapper externo recibe la entrada (GSAP desde la página), el del
// medio flota con CSS y el botón hace el rebote al tocarlo. Tres capas para que
// los transforms no se pisen.
function SceneChip({ chip, onPick }) {
  const btnRef = useRef(null);

  function handleClick() {
    if (!prefersReducedMotion() && btnRef.current) {
      gsap.fromTo(
        btnRef.current,
        { scale: 0.88 },
        { scale: 1, duration: MOTION.dur.slow, ease: 'back.out(3)', overwrite: true },
      );
    }
    onPick(chip);
  }

  return (
    <div className={`auth-chip absolute z-10 ${chip.position}`}>
      <div className="titi-float hover:[animation-play-state:paused]" style={{ animationDelay: chip.delay }}>
        <button
          ref={btnRef}
          type="button"
          onClick={handleClick}
          aria-label={`${chip.label}, ${chip.detail}`}
          className="flex items-center gap-2 rounded-full border-2 border-titi-dark bg-white py-1 pl-1 pr-3 text-left shadow-[0_3px_0px_#1A1A2E] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[0_5px_0px_#1A1A2E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60 active:translate-y-0.5 active:shadow-none lg:gap-2.5 lg:rounded-2xl lg:py-1.5 lg:pl-1.5 lg:pr-3.5"
        >
          <ChipIcon id={chip.id} />
          <span className="leading-tight">
            <span className="block text-sm font-extrabold tabular-nums text-titi-dark lg:hidden">{chip.short}</span>
            <span className="hidden text-sm font-extrabold tabular-nums text-titi-dark lg:block">{chip.label}</span>
            <span className="hidden text-xs font-semibold text-gray-500 lg:block">{chip.detail}</span>
          </span>
        </button>
      </div>
    </div>
  );
}

// Burbuja de Titi. Re-hace el pop en cada frase nueva.
function Bubble({ text }) {
  const ref = usePopIn([text], { scale: 0.8 });
  return (
    <div
      ref={ref}
      // Decorativa: los errores reales se anuncian con role="alert" en el formulario.
      aria-hidden="true"
      className="relative rounded-2xl border-2 border-titi-dark bg-white px-3 py-2 text-xs font-extrabold leading-snug text-titi-dark shadow-[0_3px_0px_#1A1A2E] sm:text-sm lg:px-4 lg:py-2.5"
    >
      {text}
      <span className="absolute -bottom-[7px] left-5 h-3 w-3 rotate-45 border-b-2 border-r-2 border-titi-dark bg-white" />
    </div>
  );
}

export default function AuthScene({ state, bubble, typingTick = 0, className = '' }) {
  const [override, setOverride] = useState(null);
  const [taps, setTaps] = useState(0);
  const lookRef = useRef(null);
  const bobRef = useRef(null);
  const burstRef = useRef(null);
  const timerRef = useRef(null);

  // Lo que pasa en el formulario (error, cargando, foco) le gana a una reacción
  // de juego: si cambia el mensaje de la página, se descarta el override.
  useEffect(() => {
    setOverride(null);
  }, [bubble]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function react(next) {
    clearTimeout(timerRef.current);
    setOverride(next);
    timerRef.current = setTimeout(() => setOverride(null), 2600);
  }

  // Titi mira hacia el puntero (solo mouse/trackpad).
  useEffect(() => {
    const el = lookRef.current;
    if (!el || prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return undefined;
    const rot = gsap.quickTo(el, 'rotation', { duration: 0.6, ease: 'power3.out' });
    const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
    const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
      const dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
      rot(dx * 6);
      x(dx * 10);
      y(dy * 6);
    };
    const onLeave = () => {
      rot(0);
      x(0);
      y(0);
    };
    window.addEventListener('pointermove', onMove);
    document.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      gsap.killTweensOf(el);
    };
  }, []);

  // Saltito con cada tecla.
  useEffect(() => {
    if (!typingTick || prefersReducedMotion() || !bobRef.current) return;
    gsap.fromTo(
      bobRef.current,
      { y: 0, scaleY: 1 },
      { y: -6, scaleY: 1.02, duration: 0.09, yoyo: true, repeat: 1, ease: 'power2.out', overwrite: true },
    );
  }, [typingTick]);

  function handleTapTiti() {
    const next = taps + 1;
    setTaps(next);
    react({ state: 'celebra', bubble: TAP_LINES[(next - 1) % TAP_LINES.length] });
    if (prefersReducedMotion() || !burstRef.current) return;
    const drops = burstRef.current.children;
    const spread = [-1, 0, 1];
    gsap.fromTo(
      drops,
      { x: 0, y: 0, scale: 0.4, autoAlpha: 1, rotation: 0 },
      {
        x: (i) => spread[i] * (50 + Math.random() * 25),
        y: (i) => -70 - Math.random() * 40 + Math.abs(spread[i]) * 20,
        rotation: (i) => spread[i] * 25,
        scale: 1,
        duration: MOTION.dur.slow,
        ease: 'power2.out',
        overwrite: true,
      },
    );
    gsap.to(drops, { autoAlpha: 0, duration: 0.25, delay: 0.35, ease: MOTION.ease.in });
  }

  const shown = override || { state, bubble };

  return (
    <div className={`relative aspect-square ${className}`}>
      {/* Gran disco suave que une la escena con el fondo de la página. Vive acá
          (no en el fondo) para quedar siempre centrado detrás de Titi.
          Requiere `isolate` en la página para pintarse sobre el fondo crema. */}
      <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[195%] w-[195%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-titi-yellow-light" />

      {/* Anillos y disco (planos). */}
      <span aria-hidden="true" className="absolute inset-0 rounded-full border-2 border-titi-dark/10" />
      <span
        aria-hidden="true"
        className="titi-spin-slow absolute inset-[6%] rounded-full border-2 border-dashed border-titi-yellow-dark/40"
      />
      <span aria-hidden="true" className="absolute inset-[13%] rounded-full bg-titi-yellow" />

      {/* Gotas que salen al tocar a Titi. */}
      <div ref={burstRef} aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[40%] z-20">
        {[0, 1, 2].map((i) => (
          <span key={i} className="invisible absolute -ml-3 -mt-3 text-titi-yellow-dark opacity-0">
            <GotaIcon className="h-6 w-6" />
          </span>
        ))}
      </div>

      {/* Titi: capa que mira al puntero → capa del saltito → botón. */}
      <div className="absolute inset-[16%] translate-y-[5%]">
        <div ref={lookRef} className="h-full w-full">
        <div ref={bobRef} className="h-full w-full origin-bottom">
          <button
            type="button"
            onClick={handleTapTiti}
            aria-label="Saludar a Titi"
            className="h-full w-full rounded-full transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow-dark/50 active:scale-[0.94] [&>div]:h-full [&>div]:w-full [&_img]:h-full [&_img]:w-full"
          >
            <TitiMascot state={shown.state} message="" size="2xl" />
          </button>
        </div>
        </div>
      </div>

      <div className="absolute -right-[12%] -top-[4%] z-20 max-w-[10.5rem] sm:max-w-[12rem] lg:-right-[18%] lg:max-w-[14rem]">
        <Bubble text={shown.bubble} />
      </div>

      {CHIPS.map((chip) => (
        <SceneChip key={chip.id} chip={chip} onPick={(c) => react(c.reaction)} />
      ))}
    </div>
  );
}
