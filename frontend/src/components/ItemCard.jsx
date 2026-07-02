import { GotaIcon } from './icons.jsx';

/**
 * ItemCard — un ítem de la tienda (mockup v2): chip sólido con el ícono del
 * ítem (el emoji viene de la data), badge "Tenés N", descripción en caja
 * cream, precio + CTA comprar. Disabled si no alcanza el saldo o si llegó
 * al `limiteStack`.
 */
export default function ItemCard({ item, saldo, buying, tint = 'bg-blue-500', onBuy }) {
  const { codigo, nombre, descripcion, precio, icono, cantidad, limiteStack } = item;
  const stackLleno = limiteStack != null && cantidad >= limiteStack;
  const sinSaldo = saldo < precio;
  const disabled = buying || stackLleno || sinSaldo;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          className={`w-12 h-12 rounded-xl grid place-items-center text-2xl select-none shadow-sm shrink-0 ${tint}`}
          aria-hidden="true"
        >
          {icono || '🎁'}
        </span>
        <p className="min-w-0 flex-1 text-lg font-bold text-titi-dark leading-snug pt-1">
          {nombre}
        </p>
        {cantidad > 0 && (
          <span className="shrink-0 text-xs font-black text-titi-yellow-dark bg-titi-yellow-light border border-titi-yellow rounded-full px-2 py-0.5 tabular-nums">
            Tenés {cantidad}
          </span>
        )}
      </div>

      <div className="bg-titi-cream border border-gray-100 rounded-xl px-3 py-2.5">
        <p className="text-sm font-medium text-gray-500">{descripcion}</p>
      </div>

      <div className="flex items-center justify-between gap-3 mt-auto">
        <span className="inline-flex items-center gap-1 text-titi-yellow-dark font-black text-lg tabular-nums">
          <GotaIcon className="w-5 h-5" />
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
