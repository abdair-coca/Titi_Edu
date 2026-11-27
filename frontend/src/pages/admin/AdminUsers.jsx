import { useCallback, useEffect, useState } from 'react';
import { ErrorBox } from '../../components/social/StateBlocks.jsx';
import { BackLink, BTN_SECONDARY, PageHeader } from '../../components/ui/v3.jsx';
import Avatar from '../../components/social/Avatar.jsx';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, FireIcon } from '../../components/icons.jsx';
import client from '../../api/client.js';

const ROLES = ['ESTUDIANTE', 'PROFESOR', 'ADMIN'];
const PAGE_SIZE = 20;

export default function AdminUsers() {
  const [usuarios, setUsuarios] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/api/admin/users', { params: { page, pageSize: PAGE_SIZE } });
      if (data?.success) {
        setUsuarios(data.data.usuarios || []);
        setTotal(data.data.total || 0);
      } else {
        setError(data?.message || 'No se pudieron cargar los usuarios');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function verify(u) {
    setBusy(u.id);
    try {
      const { data } = await client.put(`/api/admin/users/${u.id}/verify`);
      if (data?.success) setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, verificado: true } : x)));
      else alert(data?.message || 'No se pudo verificar');
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Error');
    } finally {
      setBusy(null);
    }
  }

  async function changeRole(u, rol) {
    if (rol === u.rol) return;
    setBusy(u.id);
    try {
      const { data } = await client.put(`/api/admin/users/${u.id}/role`, { rol });
      if (data?.success) {
        setUsuarios((prev) =>
          prev.map((x) => (x.id === u.id ? { ...x, rol: data.data.usuario.rol, verificado: data.data.usuario.verificado } : x)),
        );
      } else {
        alert(data?.message || 'No se pudo cambiar el rol');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Error');
    } finally {
      setBusy(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <BackLink to="/admin">Panel de administración</BackLink>
      <PageHeader title="Usuarios de" accent="Titi" subtitle={<>{total} usuarios registrados</>} />

      {loading ? (
        <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Cargando usuarios"><div className="h-11 bg-gray-100" />{[0, 1, 2, 3, 4].map((i) => <div key={i} className="px-4 py-3 flex items-center gap-4 border-t border-gray-100"><span className="w-9 h-9 rounded-full bg-gray-100" /><span className="flex-1 h-4 bg-gray-100 rounded-full" /><span className="w-24 h-8 bg-gray-100 rounded-xl" /></div>)}</div>
      ) : error ? (
        <ErrorBox title="No pudimos cargar los datos" message={error} onRetry={fetchUsers} />
      ) : (
        <div className="titi-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-titi-cream border-b-2 border-titi-dark text-left text-xs font-extrabold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Verificación</th>
                  <th className="px-4 py-3 text-right">Racha</th>
                  <th className="px-4 py-3 text-right">Cursos</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-t border-gray-100 hover:bg-titi-cream transition-colors duration-150">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar username={u.username} src={u.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="font-extrabold text-titi-dark">@{u.username}</p>
                          <p className="text-xs font-medium text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.rol}
                        onChange={(e) => changeRole(u, e.target.value)}
                        disabled={busy === u.id}
                        aria-label={`Rol de ${u.username}`}
                        className="bg-white border-2 border-gray-200 rounded-xl px-3 py-1.5 text-sm font-bold text-titi-dark cursor-pointer hover:border-titi-dark focus:outline-none focus:border-titi-dark focus:ring-4 focus:ring-titi-yellow/40 transition-all duration-150 disabled:opacity-50"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {u.rol !== 'PROFESOR' ? (
                        <span className="text-gray-300">—</span>
                      ) : u.verificado ? (
                        <span className="inline-flex items-center gap-1 bg-green-500 text-white border-2 border-titi-dark text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                          <CheckIcon className="w-3.5 h-3.5" /> Verificado
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => verify(u)}
                          disabled={busy === u.id}
                          className="titi-btn-primary text-sm px-3 py-1.5"
                        >
                          Verificar
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1 tabular-nums font-extrabold text-titi-streak"><FireIcon className="w-4 h-4" />{u.racha}</span></td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-titi-dark">{u._count?.cursosCreados ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className={BTN_SECONDARY}
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Anterior
          </button>
          <span className="text-sm font-bold text-gray-500 tabular-nums">Página {page} de {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className={BTN_SECONDARY}
          >
            Siguiente
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
