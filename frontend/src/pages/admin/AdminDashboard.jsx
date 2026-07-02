import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client.js';
import { useStaggerReveal } from '../../lib/motion.js';

const PANELS = [
  { to: '/admin/users', titulo: 'Usuarios', desc: 'Verificar profesores y cambiar roles', icon: '👥' },
  { to: '/admin/courses', titulo: 'Cursos', desc: 'Aprobar y moderar el catálogo', icon: '📚' },
  { to: '/admin/categories', titulo: 'Categorías', desc: 'Crear, editar y borrar categorías', icon: '🏷️' },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/api/admin/stats');
      if (data?.success) setStats(data.data.stats);
      else setError(data?.message || 'No se pudieron cargar las estadísticas');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const statsRef = useStaggerReveal([Boolean(stats)]);
  const panelsRef = useStaggerReveal([]);

  const cards = stats
    ? [
        { label: 'Usuarios', value: stats.usuarios, color: 'text-titi-blue' },
        { label: 'Profesores verificados', value: stats.profesoresVerificados, color: 'text-titi-green' },
        { label: 'Cursos publicados', value: stats.cursosPublicados, color: 'text-titi-yellow-dark' },
        { label: 'Inscripciones', value: stats.inscripciones, color: 'text-titi-streak' },
        { label: 'Certificados', value: stats.certificados, color: 'text-titi-achievement' },
      ]
    : [];

  return (
    <div>
      <header className="mb-6 sm:mb-8">
        <h1 className="text-3xl sm:text-4xl font-black text-titi-dark mb-1">Panel de administración</h1>
        <p className="text-sm font-medium text-gray-500">Gobierná usuarios, cursos y categorías de Titi.</p>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 h-24 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 mb-8">
          <span className="w-8 h-8 rounded-full bg-red-500 grid place-items-center shrink-0 text-white text-sm font-black" aria-hidden="true">!</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">{error}</p>
            <button onClick={fetchStats} className="text-sm font-bold text-titi-dark hover:text-titi-yellow-dark mt-2">
              Reintentar →
            </button>
          </div>
        </div>
      ) : (
        <div ref={statsRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {cards.map((c) => (
            <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4">
              <p className={`text-3xl font-black tabular-nums ${c.color}`}>{c.value}</p>
              <p className="text-xs font-semibold text-gray-500 mt-1">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      <div ref={panelsRef} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PANELS.map((p) => (
          <Link
            key={p.to}
            to={p.to}
            className="titi-card-pop bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(255,217,61,0.2)] p-5 flex items-center gap-4"
          >
            <span className="text-3xl select-none" aria-hidden="true">{p.icon}</span>
            <div>
              <p className="text-base font-bold text-titi-dark">{p.titulo}</p>
              <p className="text-xs text-gray-500">{p.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
