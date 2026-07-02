import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStaggerReveal } from '../../lib/motion.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';

export default function MyTeaching() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // id del curso ocupado
  const [confirm, setConfirm] = useState(null); // { type: 'delete', curso }

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
      const url = curso.publicado
        ? `/api/courses/${curso.id}/unpublish`
        : `/api/courses/${curso.id}/publish`;
      const { data } = await client.post(url);
      if (data?.success) {
        setCursos((prev) =>
          prev.map((c) => (c.id === curso.id ? { ...c, publicado: !curso.publicado } : c)),
        );
      } else {
        alert(data?.message || 'No se pudo actualizar el estado');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Error');
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(curso) {
    setBusy(curso.id);
    try {
      const { data } = await client.delete(`/api/courses/${curso.id}`);
      if (data?.success) {
        setCursos((prev) => prev.filter((c) => c.id !== curso.id));
      } else {
        alert(data?.message || 'No se pudo borrar el curso');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Error');
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  if (!isProfesor) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-xl">
        <h2 className="text-xl font-bold text-titi-dark mb-2">Conviértete en profesor</h2>
        <p className="text-sm text-gray-500">
          Para crear cursos necesitas el rol PROFESOR. Pedile a un administrador de Titi que te
          active el rol desde el panel de administración.
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-titi-dark">
            Mis cursos como profesor
          </h1>
          <p className="text-sm font-medium text-gray-500 mt-1">
            Creá, editá y publicá tus cursos para la comunidad Titi.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/teacher/courses/new')}
          className="bg-titi-yellow text-titi-dark font-bold text-base px-5 py-2.5 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 whitespace-nowrap w-full sm:w-auto"
        >
          + Crear curso
        </button>
      </header>

      {loading ? (
        <SkeletonGrid />
      ) : error ? (
        <ErrorState message={error} onRetry={fetch} />
      ) : cursos.length === 0 ? (
        <EmptyState onCreate={() => navigate('/teacher/courses/new')} />
      ) : (
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {cursos.map((curso) => (
            <TeachingCard
              key={curso.id}
              curso={curso}
              busy={busy === curso.id}
              onEdit={() => navigate(`/teacher/courses/${curso.id}/edit`)}
              onContent={() => navigate(`/teacher/courses/${curso.id}/modules`)}
              onTogglePublish={() => togglePublish(curso)}
              onDelete={() => setConfirm({ type: 'delete', curso })}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm ? `¿Eliminar "${confirm.curso.titulo}"?` : ''}
        message="Esta acción no se puede deshacer. Si el curso tiene estudiantes inscritos, no podrá eliminarse."
        confirmText="Eliminar curso"
        cancelText="Cancelar"
        danger
        onConfirm={() => confirm && handleDelete(confirm.curso)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function TeachingCard({ curso, busy, onEdit, onContent, onTogglePublish, onDelete }) {
  return (
    <article className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col overflow-hidden">
      <div className="relative h-32 bg-gradient-to-br from-titi-yellow-light via-titi-yellow-light to-titi-yellow/40">
        {curso.portadaUrl ? (
          <img
            src={curso.portadaUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-5xl select-none">
            {curso.categoria?.icono || '📚'}
          </div>
        )}
        <span
          className={`absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm ${
            curso.publicado
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-gray-100 text-gray-600 border border-gray-200'
          }`}
        >
          {curso.publicado ? 'Publicado' : 'Borrador'}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        {curso.categoria?.nombre && (
          <span className="text-xs font-semibold text-titi-streak uppercase tracking-wide">
            {curso.categoria.nombre}
          </span>
        )}
        <h3 className="text-base font-bold text-titi-dark leading-snug line-clamp-2">
          {curso.titulo}
        </h3>
        <p className="text-xs text-gray-500 font-medium">
          {curso._count?.modulos ?? 0}{' '}
          {curso._count?.modulos === 1 ? 'módulo' : 'módulos'}
          {' · '}
          {curso._count?.inscripciones ?? 0}{' '}
          {curso._count?.inscripciones === 1 ? 'estudiante' : 'estudiantes'}
        </p>

        <div className="mt-auto pt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onContent}
            className="flex-1 min-w-[110px] bg-titi-yellow text-titi-dark font-bold text-sm px-3 py-2 rounded-xl shadow-[0_3px_0px_#E6B800] hover:shadow-[0_1px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150"
          >
            Editar contenido
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="bg-white text-titi-dark font-semibold text-sm px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all"
          >
            Datos
          </button>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={onTogglePublish}
            disabled={busy}
            className="text-titi-dark font-semibold hover:text-titi-yellow-dark disabled:opacity-50"
          >
            {curso.publicado ? 'Despublicar' : 'Publicar'}
          </button>
          <span className="text-gray-300">·</span>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="text-titi-red font-semibold hover:underline disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <img
        src="/Titi.png"
        alt="Titi"
        className="w-24 h-24 mb-4 object-contain drop-shadow-sm select-none"
        draggable={false}
      />
      <h3 className="text-xl font-bold text-titi-dark mb-2">Aún no creaste ningún curso</h3>
      <p className="text-sm text-gray-400 mb-6 max-w-xs">
        Compartí lo que sabés con la comunidad. Empezá creando tu primer curso.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="bg-titi-yellow text-titi-dark font-bold text-base px-6 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150"
      >
        Crear primer curso
      </button>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 max-w-2xl">
      <span className="w-8 h-8 rounded-full bg-red-500 grid place-items-center shrink-0 text-white text-sm font-black" aria-hidden="true">!</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-red-700">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-bold text-titi-dark hover:text-titi-yellow-dark mt-2"
        >
          Reintentar →
        </button>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
          <div className="h-32 bg-gray-100" />
          <div className="p-4 flex flex-col gap-2">
            <div className="h-3 w-1/3 bg-gray-100 rounded" />
            <div className="h-4 w-3/4 bg-gray-100 rounded" />
            <div className="h-3 w-1/2 bg-gray-100 rounded" />
            <div className="h-9 w-full bg-gray-100 rounded-xl mt-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
