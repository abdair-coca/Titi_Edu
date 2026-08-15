import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import TitiMascot from '../../components/TitiMascot.jsx';
import { authoringError, authoringMutation } from '../../lib/authoring.js';
import client from '../../api/client.js';

const SCOPES = ['course:read', 'course:create', 'content:write', 'material:write', 'publish', 'analytics:read'];

export default function Integrations() {
  const navigate = useNavigate();
  const tokenFieldRef = useRef(null);
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(null);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState('');
  const [expiresInHours, setExpiresInHours] = useState(720);
  const [scopes, setScopes] = useState(['course:read']);
  const [tokenToDelete, setTokenToDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/api/authoring/service-tokens');
      if (!data?.success) throw new Error(data?.message || 'No se pudieron cargar los tokens');
      setTokens(data.data.tokens || []);
    } catch (err) {
      setError(authoringError(err, 'No se pudieron cargar los tokens'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleScope(scope) {
    setScopes((current) => current.includes(scope)
      ? current.filter((item) => item !== scope)
      : [...current, scope]);
  }

  async function create(event) {
    event.preventDefault();
    if (!name.trim() || !scopes.length) {
      setError('Indicá nombre y al menos un permiso');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data } = await authoringMutation('post', '/service-tokens', {
        nombre: name.trim(),
        expiresInHours: Number(expiresInHours),
        scopes,
      });
      if (!data?.success || !data.data?.token) {
        throw new Error(data?.message || 'El token fue creado, pero el secreto no pudo recuperarse. Revocalo y creá otro.');
      }
      setReveal(data.data.token);
      setCopied(false);
      setName('');
      await load();
      requestAnimationFrame(() => tokenFieldRef.current?.focus());
    } catch (err) {
      setError(authoringError(err, 'No se pudo crear el token'));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(token) {
    setBusy(true);
    setError(null);
    try {
      const { data } = await authoringMutation('post', `/service-tokens/${token.id}/revoke`, {});
      if (!data?.success) throw new Error(data?.message || 'No se pudo revocar');
      await load();
    } catch (err) {
      setError(authoringError(err, 'No se pudo revocar'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteRevokedToken() {
    if (!tokenToDelete) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await authoringMutation('delete', `/service-tokens/${tokenToDelete.id}`, {});
      if (!data?.success) throw new Error(data?.message || 'No se pudo eliminar');
      setTokenToDelete(null);
      await load();
    } catch (err) {
      setError(authoringError(err, 'No se pudo eliminar el token'));
    } finally {
      setBusy(false);
    }
  }

  async function copyToken() {
    if (!reveal) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(reveal);
    } catch {
      tokenFieldRef.current?.focus();
      tokenFieldRef.current?.select();
      const copiedWithFallback = document.execCommand?.('copy');
      if (!copiedWithFallback) {
        setError('No se pudo copiar automáticamente. El token quedó seleccionado para que uses Ctrl+C.');
        return;
      }
    }
    setCopied(true);
  }

  function closeReveal() {
    setReveal(null);
    setCopied(false);
  }

  return (
    <div className="max-w-4xl">
      <button type="button" onClick={() => navigate('/teacher')} className="text-sm font-semibold text-gray-500 hover:text-titi-dark mb-4">
        ← Mis cursos
      </button>
      <h1 className="text-3xl font-black text-titi-dark">Integraciones</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">Tokens personales para automatizar autoría. El secreto se muestra una sola vez.</p>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4"><p className="text-sm font-semibold text-red-700">{error}</p></div>}

      {reveal && (
        <section role="alert" aria-live="assertive" className="bg-titi-cream border-2 border-titi-yellow rounded-2xl p-5 mb-5 shadow-[0_4px_0px_#E6B800]">
          <h2 className="text-xl font-bold text-titi-dark">Copiá y guardá este token ahora</h2>
          <p className="text-sm text-gray-600 mt-1">Esta es la única vez que Titi mostrará el secreto completo. Al cerrar este aviso no podrá recuperarse.</p>
          <textarea
            ref={tokenFieldRef}
            readOnly
            value={reveal}
            onFocus={(event) => event.target.select()}
            aria-label="Token de servicio recién creado"
            rows={3}
            className="w-full mt-4 bg-white border border-gray-200 rounded-xl p-3 font-mono text-sm text-titi-dark break-all resize-none focus:outline-none focus:border-titi-yellow focus:ring-2 focus:ring-titi-yellow/20"
          />
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button type="button" onClick={copyToken} className="titi-btn-primary">{copied ? 'Copiado' : 'Copiar token'}</button>
            <button type="button" onClick={closeReveal} className="titi-btn-ghost">Ya lo guardé: ocultar</button>
            {copied && <span className="text-sm font-semibold text-green-700">Token copiado al portapapeles.</span>}
          </div>
        </section>
      )}

      <form onSubmit={create} className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-4">
        <h2 className="text-xl font-bold text-titi-dark">Crear token</h2>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-titi-dark">Nombre</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className="titi-input" placeholder="Automatización de mis cursos" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-titi-dark">Expira en horas</span>
          <input type="number" min="1" max="2160" value={expiresInHours} onChange={(event) => setExpiresInHours(event.target.value)} className="titi-input max-w-xs" />
        </label>
        <fieldset>
          <legend className="text-sm font-semibold text-titi-dark mb-2">Permisos</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SCOPES.map((scope) => (
              <label key={scope} className="flex items-center gap-2 text-sm text-titi-dark bg-titi-cream rounded-xl p-2.5">
                <input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} className="accent-titi-yellow" />
                {scope}
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">El permiso <strong>publish</strong> está desmarcado por defecto.</p>
        </fieldset>
        <button type="submit" disabled={busy} className="titi-btn-primary self-start">{busy ? 'Creando…' : 'Crear token'}</button>
      </form>

      <section className="mt-6">
        <h2 className="text-xl font-bold text-titi-dark mb-1">Tokens existentes</h2>
        <p className="text-xs text-gray-500 mb-3">Por seguridad, los secretos anteriores no pueden copiarse ni recuperarse. Revocá el token y creá otro si no lo guardaste.</p>
        {loading ? (
          <div className="h-24 bg-white border border-gray-100 rounded-2xl animate-pulse" />
        ) : tokens.length ? (
          <div className="space-y-3">
            {tokens.map((token) => (
              <article key={token.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <p className="font-bold text-titi-dark">{token.nombre} <span className="font-mono text-xs text-gray-500">{token.prefijo}…</span></p>
                  <p className="text-xs text-gray-500 mt-1">Expira: {new Date(token.expiresAt).toLocaleString()} · {token.scopes.join(', ')}</p>
                  <p className="text-xs font-semibold mt-1 text-gray-500">{token.revokedAt ? 'Revocado' : token.lastUsedAt ? `Último uso: ${new Date(token.lastUsedAt).toLocaleString()}` : 'Sin uso todavía'}</p>
                </div>
                <div className="flex items-center gap-3">
                  {!token.revokedAt && <button type="button" onClick={() => revoke(token)} disabled={busy} className="text-red-500 font-bold text-sm">Revocar</button>}
                  {token.revokedAt && <button type="button" onClick={() => setTokenToDelete(token)} disabled={busy} className="text-red-500 font-bold text-sm">Eliminar</button>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl p-6"><TitiMascot mood="idle" size="sm" message="Todavía no creaste tokens." /></div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(tokenToDelete)}
        title="¿Eliminar token revocado?"
        message="Esta acción elimina permanentemente el token revocado. No se puede deshacer."
        confirmText={busy ? 'Eliminando…' : 'Eliminar'}
        danger
        busy={busy}
        onConfirm={deleteRevokedToken}
        onCancel={() => setTokenToDelete(null)}
      />
    </div>
  );
}
