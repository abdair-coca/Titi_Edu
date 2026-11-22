import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useGamification } from '../context/GamificationContext.jsx';
import { useStaggerReveal, useCountUp } from '../lib/motion.js';
import ItemCard from '../components/ItemCard.jsx';
import PurchaseToast from '../components/PurchaseToast.jsx';
import { ErrorBox, SectionHeading } from '../components/social/StateBlocks.jsx';
import { DARK_PANEL, DARK_TILE, EmptyState, PageHeader } from '../components/ui/v3.jsx';
import { GotaIcon, CheckIcon, TrophyIcon, BoltIcon, GiftIcon } from '../components/icons.jsx';

// Tienda v3 (rediseno-plataforma-v3 R7): saldo en tile oscuro con conteo,
// ítems como superficies con ícono por código, "cómo ganar gotas" en panel oscuro.

// Chip sólido rotado por índice para los ítems (duotono por rol, §2).
const ITEM_TINTS = ['bg-blue-500', 'bg-titi-achievement', 'bg-titi-streak', 'bg-green-500'];

// "Cómo obtener más gotas" — contenido estático del mockup.
const WAYS = [
  {
    Icon: CheckIcon,
    chip: 'bg-green-500 text-white',
    titulo: 'Completá lecciones',
    desc: 'Ganá gotas por cada lección que termines.',
  },
  {
    Icon: TrophyIcon,
    chip: 'bg-blue-500 text-white',
    titulo: 'Logros y desafíos',
    desc: 'Superá desafíos diarios y lográ objetivos.',
  },
  {
    Icon: BoltIcon,
    chip: 'bg-titi-achievement text-white',
    titulo: 'Rachas de estudio',
    desc: 'Mantené tu racha activa y ganá recompensas.',
  },
  {
    Icon: GiftIcon,
    chip: 'bg-titi-streak text-white',
    titulo: 'Eventos especiales',
    desc: 'Participá en eventos y ganá más gotas.',
  },
];

/**
 * Shop — tienda de gotas (mockup v2). Catálogo de consumibles, saldo visible
 * con count-up, compra optimista con rollback, y sección de cómo ganar gotas.
 */
export default function Shop() {
  const { isAuthenticated } = useAuth();
  const { refreshGotas } = useGamification();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [saldo, setSaldo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [buyingCodigo, setBuyingCodigo] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchItems = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/api/shop/items');
      if (data?.success) {
        setItems(data.data.items || []);
        setSaldo(data.data.saldo ?? 0);
      } else {
        setError(data?.message || 'No se pudo cargar la tienda');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function handleBuy(codigo) {
    if (buyingCodigo) return;
    const item = items.find((it) => it.codigo === codigo);
    if (!item) return;

    setBuyingCodigo(codigo);
    // Optimista: descuenta saldo y suma al inventario local.
    setSaldo((s) => s - item.precio);
    setItems((prev) =>
      prev.map((it) => (it.codigo === codigo ? { ...it, cantidad: it.cantidad + 1 } : it)),
    );

    try {
      const { data } = await client.post('/api/shop/buy', { codigo });
      if (data?.success) {
        setSaldo(data.data.saldo);
        setItems((prev) =>
          prev.map((it) => (it.codigo === codigo ? { ...it, cantidad: data.data.cantidad } : it)),
        );
        setToast({ ok: true, message: `Compraste ${item.nombre}` });
        refreshGotas();
      } else {
        rollbackBuy(codigo, item.precio);
        setToast({ ok: false, message: data?.message || 'No se pudo completar la compra' });
      }
    } catch (err) {
      rollbackBuy(codigo, item.precio);
      setToast({
        ok: false,
        message: err.response?.data?.message || err.message || 'Error de red',
      });
    } finally {
      setBuyingCodigo(null);
    }
  }

  function rollbackBuy(codigo, precio) {
    setSaldo((s) => s + precio);
    setItems((prev) =>
      prev.map((it) => (it.codigo === codigo ? { ...it, cantidad: it.cantidad - 1 } : it)),
    );
  }

  const saldoAnim = useCountUp(saldo);
  const itemsRef = useStaggerReveal([items.length]);
  const waysRef = useStaggerReveal([loading]);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Tienda de" accent="gotas" subtitle="Gastá tus gotas en ayudas para estudiar y cuidar tu racha.">
        <div className="flex items-center gap-3 bg-titi-dark rounded-2xl border-2 border-titi-dark px-4 py-2.5" aria-live="polite">
          <span className="w-10 h-10 rounded-xl bg-titi-yellow text-titi-dark grid place-items-center -rotate-6 shrink-0" aria-hidden="true">
            <GotaIcon className="w-5 h-5" />
          </span>
          <div>
            <p className="text-2xl font-black text-titi-cream tabular-nums leading-none">{saldoAnim}</p>
            <p className="text-xs font-bold text-white/60 whitespace-nowrap mt-0.5">gotas disponibles</p>
          </div>
        </div>
      </PageHeader>

      {loading ? (
        <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Cargando la tienda">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border-2 border-gray-200 p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-100" />
                <div className="h-4 w-1/2 bg-gray-100 rounded-full" />
              </div>
              <div className="h-14 bg-gray-100 rounded-xl" />
              <div className="flex justify-between">
                <div className="h-6 w-16 bg-gray-100 rounded-full" />
                <div className="h-10 w-28 bg-gray-100 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorBox title="No pudimos cargar la tienda" message={error} onRetry={fetchItems} />
      ) : items.length === 0 ? (
        <EmptyState state="pensando" title="La tienda está" accent="vacía" text="Todavía no hay ítems. Mientras tanto, seguí juntando gotas.">
          <button type="button" onClick={() => navigate('/courses')} className="titi-btn-primary">
            Explorar cursos
          </button>
        </EmptyState>
      ) : (
        <>
          <SectionHeading title="Potenciadores para" accent="estudiar" />
          <div ref={itemsRef} className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            {items.map((item, i) => (
              <ItemCard
                key={item.codigo}
                item={item}
                saldo={saldo}
                tint={ITEM_TINTS[i % ITEM_TINTS.length]}
                buying={buyingCodigo === item.codigo}
                onBuy={handleBuy}
              />
            ))}
          </div>

          {/* Cómo obtener más gotas: panel oscuro de cierre */}
          <section aria-label="Cómo obtener más gotas" className={`${DARK_PANEL} p-4 sm:p-6`}>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-titi-cream leading-tight">
                  Cómo ganar más <span className="text-titi-yellow">gotas</span>
                </h2>
                <p className="text-sm font-medium text-white/60">Completá actividades y desafíos: todo suma.</p>
              </div>
              <button type="button" onClick={() => navigate('/courses')} className="titi-btn-primary text-sm px-5 whitespace-nowrap self-start sm:self-auto">
                Explorar cursos
              </button>
            </div>
            <div ref={waysRef} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {WAYS.map(({ Icon, chip, titulo, desc }) => (
                <div key={titulo} className={`${DARK_TILE} group p-3 sm:p-4 flex flex-col gap-2`}>
                  <span className={`w-10 h-10 rounded-xl grid place-items-center -rotate-6 transition-transform duration-200 group-hover:rotate-0 motion-reduce:transition-none ${chip}`} aria-hidden="true">
                    <Icon className="w-5 h-5" />
                  </span>
                  <p className="text-sm font-extrabold text-titi-cream leading-tight">{titulo}</p>
                  <p className="text-xs font-medium text-white/60 leading-snug">{desc}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <PurchaseToast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}
