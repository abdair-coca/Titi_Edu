import { useCallback, useEffect, useState } from 'react';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useGamification } from '../context/GamificationContext.jsx';
import { useStaggerReveal } from '../lib/motion.js';
import { ErrorBox } from './social/StateBlocks.jsx';
import { PanelTitle, ProgressBar, SURFACE } from './ui/v3.jsx';
import { BoltIcon, BooksIcon, CheckIcon, CommentIcon, GotaIcon, PencilIcon, TargetIcon, UsersIcon } from './icons.jsx';

// Ícono y rol por misión (por su `codigo`; el prefijo dice el evento).
function missionLook(codigo = '') {
  if (codigo.includes('leccion')) return { Icon: BooksIcon, solid: 'bg-green-500 text-white' };
  if (codigo.includes('evaluacion')) return { Icon: CheckIcon, solid: 'bg-titi-achievement text-white' };
  if (codigo.includes('post')) return { Icon: PencilIcon, solid: 'bg-blue-500 text-white' };
  if (codigo.includes('coment')) return { Icon: CommentIcon, solid: 'bg-blue-500 text-white' };
  if (codigo.includes('seguir')) return { Icon: UsersIcon, solid: 'bg-titi-streak text-white' };
  return { Icon: TargetIcon, solid: 'bg-titi-dark text-white' };
}

/**
 * DailyMissions — panel con las 3 misiones diarias del usuario y su progreso
 * (superficie v3, rediseno-plataforma-v3 R4). Se refresca cuando cambian las
 * gotas totales (una ganancia puede haber hecho avanzar una misión). Se usa
 * en "Mis cursos" ("Desafíos del día"). `title` renombra el encabezado; su
 * última palabra va de acento.
 */
export default function DailyMissions({ title = 'Misiones de hoy' }) {
  const { isAuthenticated } = useAuth();
  const { gotas } = useGamification();
  const [misiones, setMisiones] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMisiones = useCallback(async () => {
    if (!isAuthenticated) return;
    setError(null);
    try {
      const { data } = await client.get('/api/missions/today');
      if (data?.success) setMisiones(data.data.misiones);
      else setError(data?.message || 'No se pudieron cargar las misiones');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Carga inicial + re-fetch cuando suben las gotas totales (posible avance).
  useEffect(() => {
    fetchMisiones();
  }, [fetchMisiones, gotas.total]);

  const listRef = useStaggerReveal([misiones?.length ?? 0]);

  if (!isAuthenticated) return null;

  const words = title.split(' ');
  const accent = words.length > 1 ? words.pop() : null;
  const hechas = (misiones || []).filter((m) => m.completada).length;

  return (
    <section aria-label={title} className={`${SURFACE} p-4 sm:p-5`}>
      <PanelTitle Icon={BoltIcon} solid="bg-titi-yellow" title={words.join(' ')} accent={accent}>
        {misiones?.length > 0 && (
          <span className="text-sm font-black tabular-nums text-titi-dark">
            {hechas}/{misiones.length}
          </span>
        )}
      </PanelTitle>
      <p className="text-sm font-medium text-gray-500 -mt-2 mb-3">Se renuevan cada día. Cada una suma gotas.</p>

      {loading && !misiones ? (
        <ul className="space-y-2.5 animate-pulse motion-reduce:animate-none" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl border-2 border-gray-100 p-3">
              <span className="w-9 h-9 rounded-xl bg-gray-100 shrink-0" />
              <span className="flex-1 flex flex-col gap-2">
                <span className="h-3 w-2/3 bg-gray-100 rounded-full" />
                <span className="h-2 w-full bg-gray-100 rounded-full" />
              </span>
            </li>
          ))}
        </ul>
      ) : error ? (
        <ErrorBox title="No pudimos cargar los desafíos" message={error} onRetry={fetchMisiones} />
      ) : (
        <ul ref={listRef} className="space-y-2.5">
          {(misiones || []).map((m) => (
            <MissionRow key={m.id} mission={m} />
          ))}
        </ul>
      )}
    </section>
  );
}

function MissionRow({ mission }) {
  const { codigo, titulo, descripcion, meta, progreso, recompensa, completada } = mission;
  const { Icon, solid } = missionLook(codigo);

  return (
    <li
      className={`group rounded-xl border-2 p-3 transition-colors duration-150 ${
        completada ? 'bg-titi-yellow-light border-titi-dark' : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`w-9 h-9 rounded-xl border-2 border-titi-dark grid place-items-center shrink-0 -rotate-6 transition-transform duration-200 group-hover:rotate-0 motion-reduce:transition-none ${
            completada ? 'bg-green-500 text-white' : solid
          }`}
        >
          {completada ? <CheckIcon className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-titi-dark truncate">{titulo}</p>
          <p className="text-xs font-semibold text-gray-500 truncate">{descripcion}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1 h-7 px-2 rounded-lg text-sm font-black tabular-nums shrink-0 ${
            completada ? 'bg-titi-yellow text-titi-dark' : 'bg-titi-cream text-titi-yellow-dark'
          }`}
          title={`${recompensa} gotas`}
        >
          <GotaIcon className="w-4 h-4" />+{recompensa}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <ProgressBar
          value={Math.min(progreso, meta)}
          max={meta}
          color={completada ? 'bg-green-500' : 'bg-titi-yellow'}
          height="h-2"
          label={`Progreso de ${titulo}`}
          className="flex-1"
        />
        <span className={`text-xs font-extrabold tabular-nums shrink-0 ${completada ? 'text-green-600' : 'text-gray-500'}`}>
          {completada ? '¡Listo!' : `${progreso}/${meta}`}
        </span>
      </div>
    </li>
  );
}
