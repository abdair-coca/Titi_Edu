import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import client from '../api/client.js';
import { formatDate } from '../lib/format.js';

/**
 * Certificates — lista de mis certificados (ruta protegida /certificates).
 * VerifyCertificate — verificación pública por código (ruta /verify/:codigo).
 */
export default function Certificates() {
  const navigate = useNavigate();
  const [certificados, setCertificados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/api/progress/certificates');
      if (data?.success) setCertificados(data.data?.certificados || []);
      else setError(data?.message || 'No se pudieron cargar tus certificados');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  async function copyCode(cert) {
    try {
      await navigator.clipboard.writeText(cert.codigoVerif);
      setCopiedId(cert.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Silencioso: clipboard puede fallar sin HTTPS
    }
  }

  return (
    <div>
      <header className="mb-5 sm:mb-8">
        <h1 className="text-xl sm:text-3xl font-extrabold text-titi-dark mb-1 leading-tight">
          Mis certificados
        </h1>
        <p className="text-sm font-medium text-gray-500">
          Cada certificado tiene un código único que cualquiera puede verificar.
        </p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
              <div className="h-4 w-2/3 bg-gray-100 rounded mb-3" />
              <div className="h-3 w-1/3 bg-gray-100 rounded mb-2" />
              <div className="h-3 w-1/2 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 max-w-2xl">
          <span className="text-red-500 text-lg" aria-hidden="true">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">{error}</p>
            <button
              type="button"
              onClick={fetch}
              className="text-sm font-bold text-titi-dark hover:text-titi-yellow-dark mt-2"
            >
              Reintentar →
            </button>
          </div>
        </div>
      ) : certificados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <img
            src="/Titi.png"
            alt="Titi"
            className="w-24 h-24 mb-4 object-contain drop-shadow-sm select-none"
            draggable={false}
          />
          <h3 className="text-xl font-bold text-titi-dark mb-2">
            Todavía no tenés certificados
          </h3>
          <p className="text-sm text-gray-400 mb-6 max-w-xs">
            Completá todas las lecciones y aprobá las evaluaciones de un curso para ganar el tuyo.
          </p>
          <button
            type="button"
            onClick={() => navigate('/my-courses')}
            className="bg-titi-yellow text-titi-dark font-bold text-base px-6 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150"
          >
            Ir a mis cursos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {certificados.map((cert) => (
            <article
              key={cert.id}
              className="bg-white rounded-2xl border-2 border-titi-yellow shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 sm:px-5 py-4 bg-titi-yellow-light">
                <span className="text-2xl sm:text-3xl select-none shrink-0" aria-hidden="true">
                  {cert.curso?.categoria?.icono || '🎓'}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wide text-titi-yellow-dark">
                    Certificado Titi
                  </p>
                  <h3 className="text-sm sm:text-base font-bold text-titi-dark leading-snug line-clamp-2">
                    {cert.curso?.titulo || 'Curso'}
                  </h3>
                </div>
              </div>
              <div className="p-4 sm:p-5 flex flex-col gap-3">
                <p className="text-sm font-medium text-gray-500">
                  Emitido el {formatDate(cert.fechaEmision)}
                </p>
                <div className="bg-titi-cream rounded-xl px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">
                    Código de verificación
                  </p>
                  <p className="text-xs font-mono font-bold text-titi-dark break-all">
                    {cert.codigoVerif}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => copyCode(cert)}
                    className="bg-white text-titi-dark font-semibold text-sm px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all text-center"
                  >
                    {copiedId === cert.id ? '✓ Copiado' : 'Copiar código'}
                  </button>
                  <Link
                    to={`/verify/${cert.codigoVerif}`}
                    className="bg-titi-yellow text-titi-dark font-bold text-sm px-3 py-2 rounded-xl shadow-[0_3px_0px_#E6B800] hover:shadow-[0_1px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 text-center"
                  >
                    Ver verificación
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Verificación pública (sin login) ----
export function VerifyCertificate() {
  const { codigo } = useParams();
  const [certificado, setCertificado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!codigo) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    client
      .get(`/api/progress/certificates/verify/${codigo}`)
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.success) setCertificado(data.data.certificado);
        else setError(data?.message || 'Certificado no válido');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err.response?.data?.message ||
            'Certificado no encontrado. Verificá que el código sea correcto.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [codigo]);

  return (
    <div className="min-h-screen bg-titi-cream flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <img
            src="/Titi.png"
            alt="Titi"
            className="w-20 h-20 mx-auto mb-2 object-contain drop-shadow-sm select-none"
            draggable={false}
          />
          <h1 className="text-2xl font-extrabold text-titi-dark">
            Verificación de certificado
          </h1>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 animate-pulse">
            <div className="h-4 w-2/3 bg-gray-100 rounded mb-3 mx-auto" />
            <div className="h-3 w-1/2 bg-gray-100 rounded mx-auto" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl border-2 border-red-200 p-8 text-center">
            <span className="text-4xl block mb-3" aria-hidden="true">❌</span>
            <h2 className="text-lg font-bold text-red-700 mb-1">Certificado no válido</h2>
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border-2 border-green-300 p-8 text-center shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <span className="text-4xl block mb-3" aria-hidden="true">✅</span>
            <h2 className="text-lg font-bold text-green-700 mb-4">Certificado válido</h2>
            <dl className="text-left bg-titi-cream rounded-xl p-4 space-y-3">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Curso</dt>
                <dd className="text-base font-bold text-titi-dark">{certificado.curso?.titulo}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Otorgado a</dt>
                <dd className="text-base font-bold text-titi-dark">@{certificado.username}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Fecha de emisión</dt>
                <dd className="text-sm font-semibold text-titi-dark">
                  {formatDate(certificado.fechaEmision)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Código</dt>
                <dd className="text-xs font-mono font-bold text-titi-dark break-all">
                  {certificado.codigoVerif}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <p className="text-center mt-6">
          <Link
            to="/"
            className="text-sm font-bold text-titi-dark hover:text-titi-yellow-dark transition-colors"
          >
            ← Ir a Titi
          </Link>
        </p>
      </div>
    </div>
  );
}
