import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  AlertIcon,
  AwardIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  ExternalLinkIcon,
  ListIcon,
  PlayIcon,
  UsersIcon,
} from '../icons.jsx';
import { CategoryIcon, categoryTheme } from './categoryTheme.jsx';
import { CourseCover, FriendStack, LevelChip } from './CourseCard.jsx';
import { enrolledCount, lessonCount } from './catalogData.js';
import useSheetDismiss from './useSheetDismiss.js';

// Vista rápida del curso (rediseno-catalogo-cursos R6): panel lateral en
// desktop, hoja inferior en celular. El catálogo sigue detrás.

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function useCourseDetail(id) {
  const [state, setState] = useState({ loading: true, error: null, curso: null, viewer: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    setState({ loading: true, error: null, curso: null, viewer: null });
    client
      .get(`/api/courses/${id}`)
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) setState({ loading: false, error: null, curso: data.data.curso, viewer: data.data.viewer });
        else setState({ loading: false, error: data?.message || 'No se pudo cargar el curso', curso: null, viewer: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ loading: false, error: err.response?.data?.message || err.message || 'Error de red', curso: null, viewer: null });
      });
    return () => {
      cancelled = true;
    };
  }, [id, tick]);
  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, retry };
}

function Syllabus({ modulos }) {
  const [open, setOpen] = useState(0);
  if (!modulos?.length) {
    return <p className="text-sm font-medium text-gray-500">El temario se está preparando.</p>;
  }
  return (
    <ol className="flex flex-col gap-2">
      {modulos.map((m, i) => {
        const isOpen = open === i;
        return (
          <li key={m.id} className="rounded-2xl border-2 border-gray-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-titi-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-titi-yellow"
            >
              <span className="w-7 h-7 rounded-full bg-titi-dark text-titi-cream grid place-items-center text-xs font-extrabold shrink-0">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-titi-dark truncate">{m.titulo}</span>
                <span className="block text-xs font-bold text-gray-400">
                  {plural(m.lecciones?.length || 0, 'lección', 'lecciones')}
                </span>
              </span>
              <ChevronDownIcon
                className={`w-5 h-5 text-gray-400 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {isOpen && m.lecciones?.length > 0 && (
              <ul className="px-3 pb-3 flex flex-col gap-1">
                {m.lecciones.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 pl-10 text-sm font-medium text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                    <span className="truncate">{l.titulo}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-2 animate-pulse motion-reduce:animate-none" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 rounded-2xl bg-gray-100" />
      ))}
    </div>
  );
}

/**
 * Acción principal según quién mira (R6). La inscripción es optimista y se
 * revierte si el servidor dice que no.
 */
function PrimaryAction({ cursoId, viewer, enrollment, onEnrolled }) {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [enrolledNow, setEnrolledNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const learnHref = `/courses/${cursoId}/learn${enrollment?.siguienteLeccionId ? `?lessonId=${enrollment.siguienteLeccionId}` : ''}`;
  const btn = 'titi-btn-primary w-full py-3.5 text-base';

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        className={btn}
        onClick={() => navigate('/login', { state: { from: `/courses?curso=${cursoId}` } })}
      >
        Inicia sesión para inscribirte
      </button>
    );
  }
  if (viewer?.isOwner || (user?.rol && user.rol !== 'ESTUDIANTE')) {
    return (
      <Link to={`/courses/${cursoId}`} className={btn}>
        Ver curso
      </Link>
    );
  }
  if (viewer?.enrolled || enrolledNow) {
    return (
      <div className="flex flex-col gap-2">
        {enrolledNow && (
          <p className="titi-pop-in inline-flex items-center justify-center gap-1.5 text-sm font-extrabold text-green-600">
            <CheckIcon className="w-4 h-4" /> ¡Listo! Ya estás inscrito
          </p>
        )}
        <Link to={learnHref} className={btn}>
          <PlayIcon className="w-4 h-4" />
          {enrolledNow ? 'Empezar ahora' : 'Seguir aprendiendo'}
        </Link>
      </div>
    );
  }

  const enroll = async () => {
    setBusy(true);
    setError(null);
    setEnrolledNow(true);
    try {
      const { data } = await client.post(`/api/courses/${cursoId}/enroll`);
      if (data?.success) onEnrolled?.();
      else {
        setEnrolledNow(false);
        setError(data?.message || 'No se pudo completar la inscripción');
      }
    } catch (err) {
      if (err.response?.status === 409) {
        onEnrolled?.();
        return;
      }
      setEnrolledNow(false);
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="flex items-start gap-2 text-xs font-bold text-red-600 bg-red-50 border-2 border-red-200 rounded-xl p-2.5">
          <AlertIcon className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}
      <button type="button" className={btn} onClick={enroll} disabled={busy}>
        Inscribirme gratis
      </button>
    </div>
  );
}

export default function CourseQuickView({ cursoId, preview, friends, enrollment, onClose, onEnrolled }) {
  const open = Boolean(cursoId);
  const { panelRef, dragHandlers } = useSheetDismiss({ open, onClose });
  const { loading, error, curso: detail, viewer, retry } = useCourseDetail(cursoId);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setExpanded(false), [cursoId]);

  if (!open) return null;

  // Lo del catálogo se ve al instante; el detalle completa profes y temario.
  const curso = { ...preview, ...detail, _count: { ...preview?._count, ...detail?._count } };
  const theme = categoryTheme(curso.categoria?.nombre);
  const lecciones = lessonCount(preview) || detail?.modulos?.reduce((n, m) => n + (m.lecciones?.length || 0), 0) || 0;
  const inscritos = enrolledCount(curso);
  const profes = [
    curso.creador?.username,
    ...(detail?.profesores || []).map((p) => p.profesor?.username),
  ].filter((u, i, all) => u && all.indexOf(u) === i);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={curso.titulo || 'Vista rápida del curso'}>
      <button type="button" aria-label="Cerrar vista rápida" tabIndex={-1} onClick={onClose} className="titi-backdrop-in absolute inset-0 bg-titi-dark/60 cursor-default" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={[
          'titi-quickview absolute bg-titi-cream flex flex-col focus:outline-none',
          'inset-x-0 bottom-0 max-h-[92svh] rounded-t-3xl border-t-2 border-titi-dark',
          'md:inset-y-0 md:left-auto md:right-0 md:w-[460px] md:max-h-none md:rounded-none md:rounded-l-3xl md:border-t-0 md:border-l-2',
        ].join(' ')}
      >
        <div {...dragHandlers} className="md:hidden pt-2 pb-1 grid place-items-center cursor-grab touch-none">
          <span className="w-10 h-1.5 rounded-full bg-gray-300" />
        </div>

        <div className="overflow-y-auto overscroll-contain flex-1">
          <div className="relative group">
            <CourseCover curso={curso} className="h-44 md:h-56" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="absolute top-3 right-3 w-10 h-10 grid place-items-center rounded-full bg-white border-2 border-titi-dark shadow-[0_3px_0_#1A1A2E] text-titi-dark hover:bg-titi-yellow active:translate-y-0.5 active:shadow-none transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-titi-yellow/60"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
            <LevelChip nivel={curso.nivel} className="absolute top-3 left-3" />
          </div>

          <div className="p-5 flex flex-col gap-5">
            <header className="flex flex-col gap-2">
              <span className={`group inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide ${theme.text}`}>
                <span className={`w-6 h-6 rounded-lg grid place-items-center text-white ${theme.solid}`}>
                  <CategoryIcon nombre={curso.categoria?.nombre} className="w-3.5 h-3.5" />
                </span>
                {curso.categoria?.nombre || 'General'}
              </span>
              <h2 className="text-2xl font-black text-titi-dark leading-tight">{curso.titulo}</h2>
              {profes.length > 0 && (
                <p className="text-sm font-bold text-gray-500">
                  Con <span className="text-titi-dark">{profes.join(', ')}</span>
                </p>
              )}
            </header>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded-2xl border-2 border-gray-200 p-3 text-center">
                <ListIcon className="w-5 h-5 mx-auto text-titi-dark" />
                <p className="text-lg font-extrabold text-titi-dark tabular-nums">{lecciones}</p>
                <p className="text-xs font-bold text-gray-400">{lecciones === 1 ? 'lección' : 'lecciones'}</p>
              </div>
              <div className="bg-white rounded-2xl border-2 border-gray-200 p-3 text-center">
                <UsersIcon className="w-5 h-5 mx-auto text-titi-dark" />
                <p className="text-lg font-extrabold text-titi-dark tabular-nums">{inscritos}</p>
                <p className="text-xs font-bold text-gray-400">{inscritos === 1 ? 'inscrito' : 'inscritos'}</p>
              </div>
              <div className="bg-white rounded-2xl border-2 border-gray-200 p-3 text-center">
                <AwardIcon className={`w-5 h-5 mx-auto ${curso.emiteCertificado === false ? 'text-gray-300' : 'text-titi-certificate'}`} />
                <p className="text-lg font-extrabold text-titi-dark">{curso.emiteCertificado === false ? 'No' : 'Sí'}</p>
                <p className="text-xs font-bold text-gray-400">certificado</p>
              </div>
            </div>

            {friends?.friendCount > 0 && (
              <div className="flex items-center gap-3 bg-titi-yellow-light rounded-2xl border-2 border-titi-dark p-3">
                <FriendStack {...friends} />
                <span className="text-xs font-bold text-gray-600">ya están aprendiendo esto</span>
              </div>
            )}

            {curso.descripcion && (
              <section>
                <p className={`text-base font-medium text-gray-600 leading-relaxed whitespace-pre-line ${expanded ? '' : 'line-clamp-4'}`}>
                  {curso.descripcion}
                </p>
                {curso.descripcion.length > 220 && (
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-1 text-sm font-bold uppercase tracking-wide text-blue-500 hover:text-blue-600 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow"
                  >
                    {expanded ? 'Ver menos' : 'Ver más'}
                  </button>
                )}
              </section>
            )}

            <section className="flex flex-col gap-3">
              <h3 className="text-lg font-extrabold text-titi-dark">Temario</h3>
              {loading ? (
                <DetailSkeleton />
              ) : error ? (
                <div className="flex flex-col items-start gap-2 bg-red-50 border-2 border-red-200 rounded-2xl p-3">
                  <p className="flex items-center gap-2 text-sm font-bold text-red-700">
                    <AlertIcon className="w-4 h-4" /> {error}
                  </p>
                  <button type="button" onClick={retry} className="titi-btn-ghost px-4 py-2">
                    Reintentar
                  </button>
                </div>
              ) : (
                <Syllabus modulos={detail?.modulos} />
              )}
            </section>
          </div>
        </div>

        <footer className="p-4 border-t-2 border-titi-dark bg-white flex flex-col gap-2 md:rounded-bl-3xl">
          {loading ? (
            <div className="h-[52px] rounded-xl bg-gray-100 animate-pulse motion-reduce:animate-none" />
          ) : (
            <PrimaryAction cursoId={cursoId} viewer={viewer} enrollment={enrollment} onEnrolled={onEnrolled} />
          )}
          <Link
            to={`/courses/${cursoId}`}
            className="inline-flex items-center justify-center gap-1.5 h-9 text-sm font-bold text-gray-500 hover:text-titi-dark rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-titi-yellow"
          >
            Ver página del curso <ExternalLinkIcon className="w-4 h-4" />
          </Link>
        </footer>
      </div>
    </div>
  );
}
