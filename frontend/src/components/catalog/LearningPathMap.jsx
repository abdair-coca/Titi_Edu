import { useState } from 'react';
import TitiMascot from '../TitiMascot.jsx';
import { CheckIcon, StarIcon } from '../icons.jsx';
import { CategoryIcon, categoryTheme } from './categoryTheme.jsx';

// Rutas de aprendizaje como camino serpenteante (rediseno-catalogo-cursos R7).
// Nodos por curso unidos por un sendero en zigzag; lo completado pinta el
// sendero y Titi espera junto al siguiente paso.

const ROW = 112; // alto entre nodos (px)
const TOP = 44; // margen superior hasta el centro del primer nodo
const ZIGZAG = [50, 74, 50, 26]; // posición horizontal (%) por paso

const xAt = (i) => ZIGZAG[i % ZIGZAG.length];
const yAt = (i) => TOP + i * ROW;

function segment(i) {
  const [x1, y1, x2, y2] = [xAt(i), yAt(i), xAt(i + 1), yAt(i + 1)];
  return `M ${x1} ${y1} C ${x1} ${y1 + ROW / 2} ${x2} ${y2 - ROW / 2} ${x2} ${y2}`;
}

function PathNode({ step, index, isCurrent, onOpen }) {
  const { curso, done } = step;
  const theme = categoryTheme(curso.categoria?.nombre);
  const x = xAt(index);
  const labelRight = x <= 50;

  return (
    <div className="absolute" style={{ top: yAt(index), left: `${x}%` }}>
      <button
        type="button"
        onClick={() => onOpen(curso.id)}
        aria-label={`Paso ${index + 1}: ${curso.titulo}${done ? ' (completado)' : ''}`}
        className="group absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
      >
        {isCurrent && (
          <span className="absolute inset-0 rounded-full bg-titi-yellow animate-ping opacity-60 motion-reduce:animate-none" aria-hidden="true" />
        )}
        <span
          className={[
            'relative w-16 h-16 rounded-full grid place-items-center border-2 border-titi-dark text-white',
            'shadow-[0_5px_0_#1A1A2E] transition-all duration-150',
            'group-hover:-translate-y-1 group-hover:shadow-[0_8px_0_#1A1A2E] group-active:translate-y-[3px] group-active:shadow-[0_2px_0_#1A1A2E]',
            'group-focus-visible:ring-4 group-focus-visible:ring-titi-yellow motion-reduce:transition-none',
            done ? 'bg-green-500' : isCurrent ? theme.solid : 'bg-white !text-gray-400',
          ].join(' ')}
        >
          {done ? <CheckIcon className="w-7 h-7" /> : <CategoryIcon nombre={curso.categoria?.nombre} className="w-7 h-7" />}
        </span>
      </button>
      <div
        className={[
          'absolute -translate-y-1/2 w-[min(46vw,160px)] lg:w-[132px] xl:w-[150px]',
          labelRight ? 'left-11 text-left' : 'right-11 text-right',
        ].join(' ')}
      >
        <span className="block text-[11px] font-extrabold uppercase tracking-wide text-gray-400">Paso {index + 1}</span>
        <span className="block text-sm font-extrabold text-titi-dark leading-snug line-clamp-2">{curso.titulo}</span>
      </div>
    </div>
  );
}

function PathMap({ path, onOpen, signedIn }) {
  const { steps, current } = path;
  const goal = steps.length; // índice del nodo meta
  const height = yAt(goal) + 48;
  const finished = current >= steps.length;
  const titiIndex = finished ? goal : current;
  const titiX = xAt(titiIndex);
  const titiOnLeft = titiX > 50 ? false : true;

  return (
    <div className="relative mx-auto max-w-sm" style={{ height }}>
      <svg
        className="absolute inset-0 w-full h-full overflow-visible"
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {Array.from({ length: goal }, (_, i) => (
          <g key={i}>
            <path d={segment(i)} fill="none" className="stroke-gray-200" strokeWidth="14" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {i < current && (
              <path d={segment(i)} fill="none" className="stroke-titi-yellow" strokeWidth="14" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            )}
            <path
              d={segment(i)}
              fill="none"
              className="stroke-white"
              strokeWidth="2.5"
              strokeDasharray="2 10"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
      </svg>

      {steps.map((step, i) => (
        <PathNode key={step.curso.id} step={step} index={i} isCurrent={signedIn && i === current} onOpen={onOpen} />
      ))}

      {/* Meta */}
      <div className="absolute" style={{ top: yAt(goal), left: `${xAt(goal)}%` }}>
        <span
          className={[
            'absolute -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-2xl rotate-45 grid place-items-center border-2 border-titi-dark shadow-[0_5px_0_#1A1A2E]',
            finished ? 'bg-titi-certificate' : 'bg-white',
          ].join(' ')}
        >
          <StarIcon className={`w-7 h-7 -rotate-45 ${finished ? 'text-white' : 'text-titi-certificate'}`} />
        </span>
        <span className="sr-only">Meta de la ruta</span>
      </div>

      {/* Titi espera junto al siguiente paso (sin sesión, en el primero). */}
      <div
        className="absolute pointer-events-none transition-all duration-500 ease-out motion-reduce:transition-none"
        style={{
          top: yAt(titiIndex) - 40,
          left: titiOnLeft ? `calc(${titiX}% - 112px)` : `calc(${titiX}% + 44px)`,
        }}
      >
        <TitiMascot state={finished ? 'celebra' : 'saludo'} size="sm" message="" />
      </div>
    </div>
  );
}

export default function LearningPathMap({ paths, onOpen, signedIn }) {
  const [active, setActive] = useState(0);
  if (!paths.length) return null;
  const safeActive = Math.min(active, paths.length - 1);

  return (
    <section aria-label="Rutas de aprendizaje" className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-titi-dark">
          Rutas de <span className="text-titi-streak">aprendizaje</span>
        </h2>
        <p className="text-sm font-medium text-gray-500 mt-0.5">
          Caminos paso a paso para llegar de cero a un objetivo. Toca un paso para ver el curso.
        </p>
      </div>

      {/* Celular: una ruta a la vez, elegida con pestañas */}
      <div role="tablist" aria-label="Rutas" className="lg:hidden flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4">
        {paths.map((p, i) => (
          <button
            key={p.title}
            type="button"
            role="tab"
            aria-selected={i === safeActive}
            onClick={() => setActive(i)}
            className={[
              'h-10 px-4 rounded-full text-sm font-bold whitespace-nowrap border-2 shrink-0 transition-all duration-150',
              i === safeActive
                ? 'bg-titi-dark text-white border-titi-dark'
                : 'bg-white text-titi-dark border-gray-200 hover:border-titi-dark',
            ].join(' ')}
          >
            {p.title}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {paths.map((p, i) => (
          <article
            key={p.title}
            className={`${i === safeActive ? 'flex' : 'hidden'} lg:flex flex-col bg-white rounded-3xl border-2 border-titi-dark shadow-[0_5px_0_#1A1A2E] p-5 overflow-hidden`}
          >
            <header className="mb-2">
              <span className="inline-flex items-center bg-titi-yellow text-titi-dark text-xs font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-full border-2 border-titi-dark">
                {p.steps.length} cursos
              </span>
              <h3 className="text-lg font-extrabold text-titi-dark mt-2">{p.title}</h3>
              <p className="text-sm font-medium text-gray-500">{p.objetivo}</p>
            </header>
            <PathMap path={p} onOpen={onOpen} signedIn={signedIn} />
          </article>
        ))}
      </div>
    </section>
  );
}
