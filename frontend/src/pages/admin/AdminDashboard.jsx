import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorBox } from '../../components/social/StateBlocks.jsx';
import { BackLink, PageHeader } from '../../components/ui/v3.jsx';
import client from '../../api/client.js';
import { useCountUp, useStaggerReveal } from '../../lib/motion.js';
import { AwardIcon, BooksIcon, ChipIcon, ShieldIcon, TagIcon, TargetIcon, UsersIcon } from '../../components/icons.jsx';
import { TILE } from '../../components/ui/v3.jsx';

const PANELS = [
  { to: '/admin/users', titulo: 'Usuarios', desc: 'Verificar profesores y cambiar roles', Icon: UsersIcon, chip: 'bg-blue-500 text-white' },
  { to: '/admin/courses', titulo: 'Cursos', desc: 'Aprobar y moderar el catálogo', Icon: BooksIcon, chip: 'bg-titi-yellow text-titi-dark' },
  { to: '/admin/categories', titulo: 'Categorías', desc: 'Crear, editar y borrar categorías', Icon: TagIcon, chip: 'bg-titi-achievement text-white' },
  { to: '/admin/rag', titulo: 'Control RAG', desc: 'Monitorear indexación y probar búsquedas', Icon: ChipIcon, chip: 'bg-titi-dark text-titi-yellow' },
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
        { label: 'Usuarios', value: stats.usuarios, Icon: UsersIcon, solid: 'bg-blue-500 text-white' },
        { label: 'Profes verificados', value: stats.profesoresVerificados, Icon: ShieldIcon, solid: 'bg-green-500 text-white' },
        { label: 'Cursos publicados', value: stats.cursosPublicados, Icon: BooksIcon, solid: 'bg-titi-yellow text-titi-dark' },
        { label: 'Inscripciones', value: stats.inscripciones, Icon: TargetIcon, solid: 'bg-titi-streak text-white' },
        { label: 'Certificados', value: stats.certificados, Icon: AwardIcon, solid: 'bg-titi-achievement text-white' },
      ]
    : [];

  return (
    <div>
      <PageHeader title="Panel de" accent="administración" subtitle={<>Gobierná usuarios, cursos y categorías de Titi.</>} />

      {loading ? (
        <div className="bg-gray-200 rounded-2xl p-4 sm:p-5 mb-6 sm:mb-8 animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Cargando estadísticas">
          <div className="h-5 w-40 bg-gray-100 rounded-full mb-3" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[104px] bg-gray-100 rounded-xl" />
            ))}
          </div>
        </div>
      ) : error ? (
        <ErrorBox title="No pudimos cargar los datos" message={error} onRetry={fetchStats} />
      ) : (
        <section aria-label="Estadísticas" className="bg-titi-dark rounded-2xl border-2 border-titi-dark p-4 sm:p-5 mb-6 sm:mb-8">
          <h2 className="text-lg font-extrabold text-titi-cream mb-3">
            Titi en <span className="text-titi-yellow">números</span>
          </h2>
          <div ref={statsRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {cards.map((c) => (
              <StatTile key={c.label} {...c} />
            ))}
          </div>
        </section>
      )}

      <div ref={panelsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PANELS.map((p) => (
          <Link
            key={p.to}
            to={p.to}
            className={`group ${TILE} p-5 flex items-center gap-4`}
          >
            <span className={`w-12 h-12 rounded-xl border-2 border-titi-dark grid place-items-center shrink-0 -rotate-6 transition-transform duration-200 group-hover:rotate-0 motion-reduce:transition-none ${p.chip}`} aria-hidden="true">
              <p.Icon className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-titi-dark">{p.titulo}</p>
              <p className="text-sm font-semibold text-gray-500">{p.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value, Icon, solid }) {
  const shown = useCountUp(value ?? 0);
  return (
    <div className="bg-white/5 border-2 border-white/10 rounded-xl p-3 sm:p-4">
      <span className={`w-9 h-9 rounded-xl grid place-items-center mb-2 -rotate-6 ${solid}`} aria-hidden="true">
        <Icon className="w-5 h-5" />
      </span>
      <p className="text-3xl font-black text-titi-cream tabular-nums leading-none">{shown}</p>
      <p className="text-xs font-bold text-white/60 mt-1">{label}</p>
    </div>
  );
}
