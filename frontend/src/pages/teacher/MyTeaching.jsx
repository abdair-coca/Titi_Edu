import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePopIn, useStaggerReveal } from '../../lib/motion.js';
import DeletionConfirmationDialog from '../../components/DeletionConfirmationDialog.jsx';
import { authoringError, authoringMutation } from '../../lib/authoring.js';
import { CourseCover } from '../../components/catalog/CourseCard.jsx';
import { categoryTheme } from '../../components/catalog/categoryTheme.jsx';
import { ErrorBox } from '../../components/social/StateBlocks.jsx';
import { BTN_SECONDARY, BTN_SECONDARY_SM, EmptyState, INPUT, PageHeader, RoleBadge, SURFACE } from '../../components/ui/v3.jsx';
import { BooksIcon, CheckIcon, ListIcon, LockIcon, PencilIcon, PlusIcon, SendIcon, SlidersIcon, UsersIcon } from '../../components/icons.jsx';

// Enseñar v3 (rediseno-plataforma-v3 R10): misma lógica; cabecera, tarjetas y
// estados con el lenguaje v3.

export default function MyTeaching() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // id del curso ocupado
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [publishConfirm, setPublishConfirm] = useState(null);

  const gridRef = useStaggerReveal([cursos.length]);

  const isProfesor = user?.rol === 'PROFESOR' || user?.rol === 'ADMIN';

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/api/courses/my/teaching');
      if (data?.success) setCursos(data.data?.cursos || []);
      else setError(data?.message || 'No se pudieron cargar tus cursos');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isProfesor) fetch();
  }, [fetch, isProfesor]);

  async function togglePublish(curso) {
    setBusy(curso.id);
    try {
      const action = curso.publicado ? 'unpublish' : 'publication';
      const { data } = await authoringMutation('post', `/courses/${curso.id}/preview-${action}`, {});
      if (!data?.success) throw new Error(data?.message || 'No se pudo preparar el cambio');
      setPublishConfirm({ curso, action: curso.publicado ? 'unpublish' : 'publish', ...data.data });
    } catch (err) {
      setError(authoringError(err, 'No se pudo preparar el cambio'));
    } finally {
      setBusy(null);
    }
  }

  async function finishPublish(phrase) {
    if (!publishConfirm) return;
    const { curso, action, confirmationToken, fingerprint } = publishConfirm;
    setBusy(curso.id);
    try {
      const { data } = await authoringMutation('post', `/courses/${curso.id}/${action}`, {
        expectedFingerprint: fingerprint,
        confirmationToken,
        phrase,
      });
      if (!data?.success) throw new Error(data?.message || 'No se pudo actualizar el estado');
      setCursos((current) => current.map((item) => (item.id === curso.id ? { ...item, publicado: action === 'publish' } : item)));
      setPublishConfirm(null);
    } catch (err) { setError(authoringError(err, 'No se pudo actualizar el estado')); }
    finally { setBusy(null); }
  }

  async function startDelete(curso) {
    setBusy(curso.id);
    try {
      const { data } = await authoringMutation('post', `/courses/${curso.id}/preview-deletion`, {});
      if (!data?.success) throw new Error(data?.message || 'No se pudo preparar el borrado');
      setDeleteConfirm({ kind: 'course', curso, ...data.data });
    } catch (err) {
      setError(authoringError(err, 'No se pudo preparar el borrado del curso'));
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(phrase) {
    if (!deleteConfirm) return;
    const { curso, fingerprint, confirmationToken } = deleteConfirm;
    setBusy(curso.id);
    try {
      const { data } = await authoringMutation('delete', `/courses/${curso.id}`, {
        expectedFingerprint: fingerprint,
        confirmationToken,
        phrase,
      });
      if (data?.success) {
        setCursos((prev) => prev.filter((c) => c.id !== curso.id));
        setDeleteConfirm(null);
      } else {
        throw new Error(data?.message || 'No se pudo borrar el curso');
      }
    } catch (err) {
      setError(authoringError(err, 'No se pudo borrar el curso'));
    } finally {
      setBusy(null);
    }
  }

  if (!isProfesor) {
    return (
      <div className="max-w-2xl">
        <EmptyState state="pensando" title="Convertite en" accent="profe" text="Para crear cursos necesitás el rol PROFESOR. Pedile a un administrador de Titi que te lo active." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Mis cursos como" accent="profe" subtitle="Creá, editá y publicá tus cursos para la comunidad Titi.">
        <button type="button" onClick={() => navigate('/teacher/courses/new')} className="titi-btn-primary text-sm px-4 whitespace-nowrap">
          <PlusIcon className="w-4 h-4" />
          Crear curso
        </button>
        <button type="button" onClick={() => navigate('/teacher/integrations')} className={BTN_SECONDARY}>
          <SlidersIcon className="w-4 h-4" />
          Integraciones
        </button>
      </PageHeader>

      {loading ? (
        <SkeletonGrid />
      ) : error ? (
        <ErrorBox title="No pudimos cargar tus cursos" message={error} onRetry={fetch} />
      ) : cursos.length === 0 ? (
        <EmptyState state="saludo" title="Todavía no creaste" accent="cursos" text="Compartí lo que sabés con la comunidad. Empezá creando tu primer curso.">
          <button type="button" onClick={() => navigate('/teacher/courses/new')} className="titi-btn-primary">
            Crear mi primer curso
          </button>
        </EmptyState>
      ) : (
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {cursos.map((curso) => (
            <TeachingCard
              key={curso.id}
              curso={curso}
              busy={busy === curso.id}
              onEdit={() => navigate(`/teacher/courses/${curso.id}/edit`)}
              onContent={() => navigate(`/teacher/courses/${curso.id}/modules`)}
              onGrades={() => navigate(`/teacher/courses/${curso.id}/grades`)}
              onTogglePublish={() => togglePublish(curso)}
              onDelete={() => startDelete(curso)}
            />
          ))}
        </div>
      )}

      <DeletionConfirmationDialog
        value={deleteConfirm}
        busy={Boolean(busy)}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
      <SignedConfirmation
        value={publishConfirm}
        busy={Boolean(busy)}
        onCancel={() => setPublishConfirm(null)}
        onConfirm={finishPublish}
      />
    </div>
  );
}

// Superficie v3 (motion.md: TeachingCard no levanta, tiene varios botones adentro).
function TeachingCard({ curso, busy, onEdit, onContent, onGrades, onTogglePublish, onDelete }) {
  const theme = categoryTheme(curso.categoria?.nombre);
  const link = 'text-sm font-bold uppercase tracking-wide transition-all duration-150 active:scale-95 disabled:opacity-50';
  return (
    <article className={`${SURFACE} flex flex-col overflow-hidden`}>
      <div className="relative border-b-2 border-titi-dark">
        <CourseCover curso={curso} className="h-32" iconSize="sm" />
        <span
          className={`absolute top-3 left-3 inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full border-2 border-titi-dark ${
            curso.publicado ? 'bg-green-500 text-white' : 'bg-white text-titi-dark'
          }`}
        >
          {curso.publicado ? <CheckIcon className="w-3.5 h-3.5" /> : <PencilIcon className="w-3.5 h-3.5" />}
          {curso.publicado ? 'Publicado' : 'Borrador'}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        {curso.categoria?.nombre && (
          <span className={`text-xs font-extrabold uppercase tracking-wide ${theme.text}`}>{curso.categoria.nombre}</span>
        )}
        <h3 className="text-lg font-extrabold text-titi-dark leading-snug line-clamp-2">{curso.titulo}</h3>
        <p className="flex items-center gap-3 text-xs text-gray-500 font-bold">
          <span className="inline-flex items-center gap-1">
            <BooksIcon className="w-3.5 h-3.5" />
            {curso._count?.modulos ?? 0} {curso._count?.modulos === 1 ? 'módulo' : 'módulos'}
          </span>
          <span className="inline-flex items-center gap-1">
            <UsersIcon className="w-3.5 h-3.5" />
            {curso._count?.inscripciones ?? 0} {curso._count?.inscripciones === 1 ? 'estudiante' : 'estudiantes'}
          </span>
        </p>

        <div className="mt-auto pt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onContent} className="titi-btn-primary flex-1 min-w-[130px] text-sm px-3 py-2">
            <ListIcon className="w-4 h-4" />
            Editar contenido
          </button>
          <button type="button" onClick={onEdit} className={BTN_SECONDARY_SM}>
            <PencilIcon className="w-4 h-4" />
            Datos
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t-2 border-gray-100 mt-1">
          <button type="button" onClick={onGrades} disabled={busy} className={`${link} text-blue-500 hover:text-blue-600`}>
            Notas
          </button>
          <button type="button" onClick={onTogglePublish} disabled={busy} className={`${link} text-blue-500 hover:text-blue-600`}>
            {curso.publicado ? 'Despublicar' : 'Publicar'}
          </button>
          <button type="button" onClick={onDelete} disabled={busy} className={`${link} text-red-500 hover:text-red-600 ml-auto`}>
            Eliminar
          </button>
        </div>
      </div>
    </article>
  );
}

function SignedConfirmation({ value, busy, onCancel, onConfirm }) {
  const [phrase, setPhrase] = useState('');
  const panelRef = usePopIn([Boolean(value)]);
  useEffect(() => setPhrase(''), [value]);
  if (!value) return null;
  const publish = value.action === 'publish';
  return (
    <div className="titi-backdrop-in fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="signed-confirm-title" className="w-full max-w-md rounded-2xl bg-white border-2 border-titi-dark shadow-[0_8px_0_#1A1A2E] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <RoleBadge Icon={publish ? SendIcon : LockIcon} solid={publish ? 'bg-green-500' : 'bg-titi-dark'} size="sm" />
          <h2 id="signed-confirm-title" className="text-xl font-extrabold text-titi-dark">
            Confirmar <span className="text-titi-streak">{publish ? 'publicación' : 'despublicación'}</span>
          </h2>
        </div>
        <p className="mt-3 text-sm font-medium text-gray-600">Escribí la frase exacta de la vista previa firmada:</p>
        <code className="mt-2 block break-all rounded-xl bg-titi-cream border-2 border-dashed border-gray-300 p-3 text-sm font-bold text-titi-dark">{value.phrase}</code>
        <input value={phrase} onChange={(event) => setPhrase(event.target.value)} className={`${INPUT} mt-3`} autoFocus aria-label="Frase de confirmación" />
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className={BTN_SECONDARY}>
            Cancelar
          </button>
          <button type="button" onClick={() => onConfirm(phrase)} disabled={busy || phrase !== value.phrase} className="titi-btn-primary text-sm">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Cargando tus cursos">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
          <div className="h-32 bg-gray-100 border-b-2 border-gray-200" />
          <div className="p-4 flex flex-col gap-2">
            <div className="h-3 w-1/3 bg-gray-100 rounded-full" />
            <div className="h-5 w-3/4 bg-gray-100 rounded-full" />
            <div className="h-3 w-1/2 bg-gray-100 rounded-full" />
            <div className="flex gap-2 mt-3">
              <div className="h-10 flex-1 bg-gray-100 rounded-xl" />
              <div className="h-10 w-20 bg-gray-100 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
