import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import client from '../api/client.js';
import { formatDate } from '../lib/format.js';
import { useStaggerReveal } from '../lib/motion.js';
import { CourseCover } from '../components/catalog/CourseCard.jsx';
import { categoryTheme } from '../components/catalog/categoryTheme.jsx';
import { ErrorBox } from '../components/social/StateBlocks.jsx';
import { BTN_SECONDARY_SM, EmptyState, PageHeader, SURFACE } from '../components/ui/v3.jsx';
import { AwardIcon, CheckIcon, ChevronLeftIcon, CloseIcon, CopyIcon, ExternalLinkIcon, ShieldIcon } from '../components/icons.jsx';

// Certificados v3 (rediseno-plataforma-v3 R5): superficie con la portada de la
// categoría (sin emoji), sello dorado, código y acciones con press.

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

  const gridRef = useStaggerReveal([certificados.length]);

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
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Mis"
        accent="certificados"
        subtitle="Cada certificado tiene un código único que cualquiera puede verificar."
      >
        {!loading && !error && certificados.length > 0 && (
          <span className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-titi-dark text-titi-cream text-sm font-extrabold tabular-nums">
            <AwardIcon className="w-5 h-5 text-titi-certificate" />
            {certificados.length} {certificados.length === 1 ? 'certificado' : 'certificados'}
          </span>
        )}
      </PageHeader>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Cargando certificados">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
              <div className="h-28 bg-gray-100 border-b-2 border-gray-200" />
              <div className="p-4 flex flex-col gap-3">
                <div className="h-3 w-1/3 bg-gray-100 rounded-full" />
                <div className="h-5 w-3/4 bg-gray-100 rounded-full" />
                <div className="h-12 bg-gray-100 rounded-xl" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-9 bg-gray-100 rounded-xl" />
                  <div className="h-9 bg-gray-100 rounded-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorBox title="No pudimos cargar tus certificados" message={error} onRetry={fetch} />
      ) : certificados.length === 0 ? (
        <EmptyState
          state="pensando"
          title="Todavía no tenés"
          accent="certificados"
          text="Completá todas las lecciones y aprobá las evaluaciones de un curso para ganar el tuyo."
        >
          <button type="button" onClick={() => navigate('/my-courses')} className="titi-btn-primary">
            Ir a mis cursos
          </button>
        </EmptyState>
      ) : (
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {certificados.map((cert) => {
            const theme = categoryTheme(cert.curso?.categoria?.nombre);
            const copied = copiedId === cert.id;
            return (
              <article key={cert.id} className={`${SURFACE} overflow-hidden flex flex-col`}>
                <div className="relative border-b-2 border-titi-dark">
                  <CourseCover curso={cert.curso || {}} className="h-28" iconSize="sm" />
                  <span
                    title="Certificado Titi"
                    className="absolute -bottom-5 right-4 w-11 h-11 rounded-full bg-titi-certificate text-white border-2 border-titi-dark grid place-items-center rotate-6"
                  >
                    <AwardIcon className="w-5 h-5" />
                  </span>
                </div>
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div className="pr-12">
                    <p className={`text-xs font-extrabold uppercase tracking-wide ${theme.text}`}>
                      {cert.curso?.categoria?.nombre || 'Certificado Titi'}
                    </p>
                    <h3 className="text-lg font-extrabold text-titi-dark leading-snug line-clamp-2">{cert.curso?.titulo || 'Curso'}</h3>
                    <p className="text-sm font-semibold text-gray-500 mt-0.5">Emitido el {formatDate(cert.fechaEmision)}</p>
                  </div>
                  <div className="bg-titi-cream border-2 border-dashed border-gray-300 rounded-xl px-3 py-2 mt-auto">
                    <p className="text-xs font-extrabold uppercase tracking-wide text-gray-500 mb-0.5">Código de verificación</p>
                    <p className="text-sm font-mono font-bold text-titi-dark break-all">{cert.codigoVerif}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => copyCode(cert)} className={`${BTN_SECONDARY_SM} ${copied ? '!bg-green-500 !text-white' : ''}`}>
                      {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                      {copied ? 'Copiado' : 'Copiar código'}
                    </button>
                    <Link to={`/verify/${cert.codigoVerif}`} className="titi-btn-primary text-sm px-3 py-2">
                      <ExternalLinkIcon className="w-4 h-4" />
                      Verificar
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// App.jsx la importa como export nombrado (`m.Certificates`): sin esto la ruta
// /certificates rompía con "Lazy element type must resolve to a function".
export { Certificates };

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
    <div className="min-h-screen bg-titi-cream flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <img src="/Titi.png" alt="Titi" className="w-20 h-20 mx-auto mb-2 object-contain drop-shadow-sm select-none" draggable={false} />
          <h1 className="text-3xl sm:text-4xl font-black text-titi-dark leading-tight">
            Verificación de <span className="text-titi-streak">certificado</span>
          </h1>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 animate-pulse motion-reduce:animate-none">
            <div className="w-12 h-12 rounded-xl bg-gray-100 mx-auto mb-3" />
            <div className="h-4 w-2/3 bg-gray-100 rounded-full mb-3 mx-auto" />
            <div className="h-24 bg-gray-100 rounded-xl" />
          </div>
        ) : error ? (
          <div className={`${SURFACE} p-6 sm:p-8 text-center`}>
            <span className="w-12 h-12 rounded-xl bg-red-500 border-2 border-titi-dark grid place-items-center mx-auto mb-3 -rotate-6 text-white" aria-hidden="true">
              <CloseIcon className="w-6 h-6" />
            </span>
            <h2 className="text-xl font-extrabold text-red-600 mb-1">Certificado no válido</h2>
            <p className="text-base font-medium text-gray-500">{error}</p>
          </div>
        ) : (
          <div className={`${SURFACE} p-6 sm:p-8 text-center`}>
            <span className="w-12 h-12 rounded-xl bg-green-500 border-2 border-titi-dark grid place-items-center mx-auto mb-3 -rotate-6 text-white" aria-hidden="true">
              <ShieldIcon className="w-6 h-6" />
            </span>
            <h2 className="text-xl font-extrabold text-titi-dark mb-4">
              Certificado <span className="text-green-600">válido</span>
            </h2>
            <dl className="text-left bg-titi-cream border-2 border-gray-200 rounded-xl p-4 space-y-3">
              <div>
                <dt className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Curso</dt>
                <dd className="text-base font-extrabold text-titi-dark">{certificado.curso?.titulo}</dd>
              </div>
              <div>
                <dt className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Otorgado a</dt>
                <dd className="text-base font-extrabold text-titi-dark">@{certificado.username}</dd>
              </div>
              <div>
                <dt className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Fecha de emisión</dt>
                <dd className="text-sm font-bold text-titi-dark">{formatDate(certificado.fechaEmision)}</dd>
              </div>
              <div>
                <dt className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Código</dt>
                <dd className="text-sm font-mono font-bold text-titi-dark break-all">{certificado.codigoVerif}</dd>
              </div>
            </dl>
          </div>
        )}

        <p className="text-center mt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm font-bold uppercase tracking-wide text-blue-500 hover:text-blue-600 transition-all duration-150 active:scale-95"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Ir a Titi
          </Link>
        </p>
      </div>
    </div>
  );
}
