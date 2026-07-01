import { GotaIcon } from './icons.jsx';

/**
 * ItemCard — un ítem de la tienda: icono + nombre + descripción + precio +
 * badge "tenés N" + CTA comprar. Disabled si no alcanza el saldo o si llegó
 * al `limiteStack`.
 */
export default function ItemCard({ item, saldo, buying, onBuy }) {
  const { codigo, nombre, descripcion, precio, icono, cantidad, limiteStack } = item;
  const stackLleno = limiteStack != null && cantidad >= limiteStack;
  const sinSaldo = saldo < precio;
  const disabled = buying || stackLleno || sinSaldo;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="text-3xl shrink-0 select-none" aria-hidden="true">
          {icono || '🎁'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-titi-dark truncate">{nombre}</p>
          <p className="text-xs text-gray-500 mt-0.5">{descripcion}</p>
        </div>
        {cantidad > 0 && (
          <span className="shrink-0 text-xs font-black text-titi-yellow-dark bg-titi-yellow-light border border-titi-yellow rounded-full px-2 py-0.5 tabular-nums">
            tenés {cantidad}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 mt-auto">
        <span className="inline-flex items-center gap-1 text-titi-yellow-dark font-black tabular-nums">
          <GotaIcon className="w-4 h-4" />
          {precio}
        </span>
        <button
          type="button"
          onClick={() => onBuy(codigo)}
          disabled={disabled}
          className="bg-titi-yellow text-titi-dark font-bold text-sm px-4 py-2 rounded-xl shadow-[0_3px_0px_#E6B800] hover:shadow-[0_1px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_3px_0px_#E6B800]"
        >
          {stackLleno ? 'Máximo' : buying ? 'Comprando…' : 'Comprar'}
        </button>
      </div>
    </div>
  );
}
