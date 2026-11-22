import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client.js';
import { useGamification } from '../../context/GamificationContext.jsx';
import useStreak from '../../hooks/useStreak.js';
import { useCountUp } from '../../lib/motion.js';
import TitiMascot from '../TitiMascot.jsx';
import { AwardIcon, BoltIcon, GotaIcon, GraduationIcon, ListIcon, UsersIcon } from '../icons.jsx';

// Bloque final de /courses (rediseno-catalogo-cursos R8): visitante → por qué
// Titi + cifras reales; con sesión → tu racha, tus gotas y el próximo logro.

/** true la primera vez que el elemento entra en pantalla. */
function useSeen() {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return undefined;
    }
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [seen]);
  return [ref, seen];
}

function Stat({ value, label, seen }) {
  const shown = useCountUp(seen ? value : 0);
  return (
    <div className="bg-white/5 border-2 border-white/10 rounded-2xl p-4">
      <p className="text-3xl sm:text-4xl font-black text-titi-yellow tabular-nums leading-none">{shown}</p>
      <p className="text-sm font-bold text-white/60 mt-1.5">{label}</p>
    </div>
  );
}

const PERKS = [
  { Icon: ListIcon, title: 'Lecciones cortas', text: 'Las terminas en una sentada.' },
  { Icon: UsersIcon, title: 'Aprendes con tu gente', text: 'Ves qué cursos toman tus amigos.' },
  { Icon: GotaIcon, title: 'Gotas y racha', text: 'Cada lección suma y se nota.' },
  { Icon: AwardIcon, title: 'Certificados', text: 'Al terminar, te llevas el tuyo.' },
];

function GuestOutro({ stats }) {
  const [ref, seen] = useSeen();
  const numbers = [
    { value: stats.cursos, label: 'cursos publicados' },
    { value: stats.profes, label: 'profes de la comunidad' },
    { value: stats.lecciones, label: 'lecciones' },
    { value: stats.categorias, label: 'categorías' },
  ].filter((n) => n.value > 0);

  return (
    <section ref={ref} aria-label="Empieza a aprender con Titi" className="bg-titi-dark rounded-3xl border-2 border-titi-dark p-6 sm:p-10 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-8 items-center">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-titi-cream leading-tight">
            Aprende con tu <span className="text-titi-yellow">comunidad</span>
          </h2>
          <p className="text-base font-medium text-white/60 mt-2 max-w-md">
            Cursos hechos por gente real, a tu ritmo y gratis.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
            {PERKS.map(({ Icon, title, text }) => (
              <li key={title} className="group flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-titi-yellow text-titi-dark grid place-items-center shrink-0 transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110 motion-reduce:transition-none">
                  <Icon className="w-5 h-5" />
                </span>
                <span>
                  <span className="block text-sm font-extrabold text-titi-cream">{title}</span>
                  <span className="block text-sm font-medium text-white/55">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <Link to="/register" className="titi-btn-primary px-7 py-3.5 text-base mt-8">
            Crear mi cuenta gratis
          </Link>
          <p className="text-sm font-medium text-white/50 mt-3">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" state={{ from: '/courses' }} className="font-bold text-titi-yellow hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
        <div className="relative">
          <div className="grid grid-cols-2 gap-3">
            {numbers.map((n) => (
              <Stat key={n.label} {...n} seen={seen} />
            ))}
          </div>
          <TitiMascot state="saludo" size="lg" message="" className="hidden lg:flex absolute -bottom-12 -right-6" />
        </div>
      </div>
    </section>
  );
}

function useNextAchievement() {
  const [next, setNext] = useState(undefined);
  useEffect(() => {
    let cancelled = false;
    client
      .get('/api/progress/achievements')
      .then(({ data }) => {
        if (cancelled) return;
        const logros = data?.success ? data.data?.logros || [] : [];
        setNext(logros.find((l) => !l.desbloqueado) || null);
      })
      .catch(() => !cancelled && setNext(null));
    return () => {
      cancelled = true;
    };
  }, []);
  return next;
}

function MemberOutro() {
  const { racha, estaActiva } = useStreak();
  const { gotas } = useGamification();
  const next = useNextAchievement();
  const [ref, seen] = useSeen();
  const rachaShown = useCountUp(seen ? racha : 0);
  const gotasShown = useCountUp(seen ? gotas?.saldo || 0 : 0);

  return (
    <section ref={ref} aria-label="Tu progreso" className="bg-titi-dark rounded-3xl border-2 border-titi-dark p-6 sm:p-8">
      <div className="flex items-center gap-4 mb-6">
        <TitiMascot state={estaActiva ? 'racha' : 'idle'} size="sm" message="" />
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-titi-cream leading-tight">
            {estaActiva ? '¡Vas con todo!' : 'Hoy es buen día para sumar'}
          </h2>
          <p className="text-sm font-medium text-white/60">Cada lección suma gotas y alarga tu racha.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white/5 border-2 border-white/10 rounded-2xl p-4 flex items-center gap-3">
          <span className={`w-11 h-11 rounded-xl grid place-items-center text-white ${estaActiva ? 'bg-titi-streak' : 'bg-white/10'}`}>
            <BoltIcon className="w-6 h-6" />
          </span>
          <div>
            <p className="text-2xl font-black text-titi-cream tabular-nums leading-none">{rachaShown}</p>
            <p className="text-xs font-bold text-white/55 mt-1">{racha === 1 ? 'día de racha' : 'días de racha'}</p>
          </div>
        </div>
        <div className="bg-white/5 border-2 border-white/10 rounded-2xl p-4 flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl grid place-items-center bg-titi-yellow text-titi-dark">
            <GotaIcon className="w-6 h-6" />
          </span>
          <div>
            <p className="text-2xl font-black text-titi-cream tabular-nums leading-none">{gotasShown}</p>
            <p className="text-xs font-bold text-white/55 mt-1">gotas para gastar</p>
          </div>
        </div>
        {next !== undefined && (
          <Link
            to="/certificates"
            className="group bg-white/5 border-2 border-white/10 rounded-2xl p-4 flex items-center gap-3 hover:border-titi-achievement transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow"
          >
            <span className="w-11 h-11 rounded-xl grid place-items-center bg-titi-achievement text-white shrink-0 transition-transform duration-200 group-hover:rotate-12 motion-reduce:transition-none">
              {next ? <AwardIcon className="w-6 h-6" /> : <GraduationIcon className="w-6 h-6" />}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white/55">{next ? 'Próximo logro' : 'Logros'}</p>
              <p className="text-sm font-extrabold text-titi-cream truncate">{next ? next.nombre : '¡Los tienes todos!'}</p>
              {next?.descripcion && <p className="text-xs font-medium text-white/50 line-clamp-1">{next.descripcion}</p>}
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}

export default function CatalogOutro({ signedIn, stats }) {
  return signedIn ? <MemberOutro /> : <GuestOutro stats={stats} />;
}
