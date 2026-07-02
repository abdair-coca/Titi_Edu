import { useCallback, useEffect, useState } from 'react';
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
      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-black text-titi-dark mb-1">Usuarios</h1>
        <p className="text-sm font-medium text-gray-500">{total} usuarios registrados</p>
      </header>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 h-80 animate-pulse" />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <span className="w-8 h-8 rounded-full bg-red-500 grid place-items-center shrink-0 text-white text-sm font-black" aria-hidden="true">!</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">{error}</p>
            <button onClick={fetchUsers} className="text-sm font-bold text-titi-dark hover:text-titi-yellow-dark mt-2">
              Reintentar →
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-titi-cream text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Verificación</th>
                  <th className="px-4 py-3 text-right">Racha</th>
                  <th className="px-4 py-3 text-right">Cursos</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <p className="font-bold text-titi-dark">@{u.username}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.rol}
                        onChange={(e) => changeRole(u, e.target.value)}
                        disabled={busy === u.id}
                        aria-label={`Rol de ${u.username}`}
                        className="bg-titi-cream border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-semibold text-titi-dark cursor-pointer focus:outline-none focus:border-titi-yellow focus:ring-2 focus:ring-titi-yellow/20 disabled:opacity-50"
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
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-xs font-bold px-2.5 py-1 rounded-full">
                          ✓ Verificado
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => verify(u)}
                          disabled={busy === u.id}
                          className="bg-titi-yellow text-titi-dark font-bold text-xs px-3 py-1.5 rounded-xl shadow-[0_3px_0px_#E6B800] hover:shadow-[0_1px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50"
                        >
                          Verificar
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-titi-streak">{u.racha} 🔥</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{u._count?.cursosCreados ?? 0}</td>
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
            className="bg-white text-titi-dark font-bold text-sm px-4 py-2 rounded-xl border-2 border-gray-200 shadow-[0_4px_0px_#E5E7EB] hover:border-titi-yellow hover:-translate-y-0.5 hover:shadow-[0_6px_0px_#E5E7EB] active:translate-y-0.5 active:shadow-none transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Anterior
          </button>
          <span className="text-sm font-semibold text-gray-500">Página {page} de {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="bg-white text-titi-dark font-bold text-sm px-4 py-2 rounded-xl border-2 border-gray-200 shadow-[0_4px_0px_#E5E7EB] hover:border-titi-yellow hover:-translate-y-0.5 hover:shadow-[0_6px_0px_#E5E7EB] active:translate-y-0.5 active:shadow-none transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
