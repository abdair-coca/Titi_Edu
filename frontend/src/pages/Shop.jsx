import { useCallback, useEffect, useState } from 'react';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useGamification } from '../context/GamificationContext.jsx';
import ItemCard from '../components/ItemCard.jsx';
import PurchaseToast from '../components/PurchaseToast.jsx';
import { GotaIcon } from '../components/icons.jsx';

/**
 * Shop — tienda de gotas. Catálogo de consumibles (congelar racha, intento
 * extra, multiplicador x2), saldo visible, compra optimista con rollback.
 */
export default function Shop() {
  const { isAuthenticated } = useAuth();
  const { refreshGotas } = useGamification();
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

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-titi-dark">Tienda</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">
            Gastá tus gotas en consumibles que te ayudan a estudiar.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 bg-titi-yellow-light border border-titi-yellow rounded-xl px-3 py-2 shrink-0">
          <GotaIcon className="w-5 h-5 text-titi-yellow-dark" />
          <span className="text-xl font-black text-titi-dark tabular-nums">{saldo}</span>
        </span>
      </header>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={fetchItems}
            className="text-sm font-bold text-titi-dark hover:text-titi-yellow-dark shrink-0"
          >
            Reintentar →
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <img
            src="/Titi.png"
            alt="Titi"
            className="w-24 h-24 mb-4 object-contain drop-shadow-sm select-none"
            draggable={false}
          />
          <h3 className="text-xl font-bold text-titi-dark mb-2">La tienda está vacía</h3>
          <p className="text-sm text-gray-400 max-w-xs">Todavía no hay ítems disponibles.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <ItemCard
              key={item.codigo}
              item={item}
              saldo={saldo}
              buying={buyingCodigo === item.codigo}
              onBuy={handleBuy}
            />
          ))}
        </div>
      )}

      <PurchaseToast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}
