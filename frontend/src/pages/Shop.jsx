import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useGamification } from '../context/GamificationContext.jsx';
import { useStaggerReveal, useCountUp } from '../lib/motion.js';
import ItemCard from '../components/ItemCard.jsx';
import PurchaseToast from '../components/PurchaseToast.jsx';
import {
  GotaIcon,
  BagIcon,
  CheckIcon,
  TrophyIcon,
  BoltIcon,
  GiftIcon,
} from '../components/icons.jsx';

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
    <div className="max-w-3xl mx-auto">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-titi-dark">Tienda</h1>
          <p className="text-base font-medium text-gray-500 mt-1">
            Gastá tus gotas en consumibles que te ayudan a estudiar.
          </p>
        </div>
        {/* Saldo (mockup): card blanca con gota + label */}
        <div className="flex items-center gap-2.5 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-4 py-2.5 shrink-0">
          <GotaIcon className="w-6 h-6 text-titi-yellow-dark" />
          <div>
            <p className="text-xl font-black text-titi-dark tabular-nums leading-tight">
              {saldoAnim}
            </p>
            <p className="text-xs font-semibold text-gray-500 whitespace-nowrap">
              Gotas disponibles
            </p>
          </div>
        </div>
      </header>

      {/* Hero (mockup): beneficio de gastar gotas */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4 sm:p-5 mb-6 flex items-center gap-4">
        <span className="w-12 h-12 rounded-xl bg-titi-yellow shadow-sm grid place-items-center shrink-0">
          <BagIcon className="w-6 h-6 text-titi-dark" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-titi-dark leading-tight">
            Mejorá tu experiencia de aprendizaje
          </h2>
          <p className="text-sm font-medium text-gray-500">
            Usá tus gotas para desbloquear beneficios que te ayudan a mantener tu progreso.
          </p>
        </div>
        <span className="hidden sm:grid w-14 h-14 rounded-full bg-titi-yellow-light place-items-center shrink-0">
          <GotaIcon className="w-8 h-8 text-titi-yellow-dark" />
        </span>
      </section>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 bg-gray-100 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={fetchItems}
            className="text-sm font-bold text-titi-dark hover:text-titi-yellow-dark active:scale-95 transition-all duration-150 shrink-0"
          >
            Reintentar →
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-8 text-center">
          <img
            src="/Titi.png"
            alt="Titi"
            className="w-24 h-24 mb-4 object-contain drop-shadow-sm select-none"
            draggable={false}
          />
          <h3 className="text-xl font-bold text-titi-dark mb-2">La tienda está vacía</h3>
          <p className="text-base font-medium text-gray-500 max-w-xs">
            Todavía no hay ítems disponibles.
          </p>
        </div>
      ) : (
        <>
          {/* Potenciadores */}
          <div className="mb-3">
            <h2 className="text-xl sm:text-2xl font-extrabold text-titi-dark">Potenciadores</h2>
            <p className="text-sm font-medium text-gray-500">
              Consumibles que mejoran tu rendimiento.
            </p>
          </div>
          <div ref={itemsRef} className="grid gap-4 sm:grid-cols-2 mb-8">
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

          {/* Cómo obtener más gotas */}
          <div className="mb-3">
            <h2 className="text-xl sm:text-2xl font-extrabold text-titi-dark">
              Cómo obtener más gotas
            </h2>
            <p className="text-sm font-medium text-gray-500">
              Completá actividades y desafíos para ganar más.
            </p>
          </div>
          <div ref={waysRef} className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {WAYS.map(({ Icon, chip, titulo, desc }) => (
              <div
                key={titulo}
                className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4 text-center flex flex-col items-center gap-2"
              >
                <span className={`w-10 h-10 rounded-full grid place-items-center shadow-sm ${chip}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <p className="text-sm font-bold text-titi-dark leading-tight">{titulo}</p>
                <p className="text-xs font-medium text-gray-500 leading-snug">{desc}</p>
              </div>
            ))}
          </div>

          {/* Banner de cierre */}
          <section className="bg-titi-yellow-light border border-titi-yellow/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4">
            <span className="w-10 h-10 rounded-full bg-titi-yellow shadow-sm grid place-items-center shrink-0">
              <GotaIcon className="w-5 h-5 text-titi-dark" />
            </span>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h3 className="text-lg font-bold text-titi-dark">¡Más gotas, más aprendizaje!</h3>
              <p className="text-sm font-medium text-gray-500">
                Invertí tus gotas sabiamente y seguí avanzando en tu camino.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/courses')}
              className="bg-titi-yellow text-titi-dark font-bold text-sm px-4 py-2.5 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 whitespace-nowrap"
            >
              Explorar cursos
            </button>
          </section>
        </>
      )}

      <PurchaseToast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}
