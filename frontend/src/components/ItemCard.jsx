import { BoltIcon, GiftIcon, GotaIcon, RefreshIcon, SnowflakeIcon } from './icons.jsx';
import { SURFACE } from './ui/v3.jsx';

// Ícono por `codigo` del ítem: el emoji de `item.icono` (dato) no se muestra
// (design.md §5.6).
const ITEM_ICON = {
  congelar_racha: SnowflakeIcon,
  intento_extra: RefreshIcon,
  multiplicador_gotas: BoltIcon,
};

/**
 * ItemCard — un ítem de la tienda (superficie v3, rediseno-plataforma-v3 R7):
 * cuadro sólido girado con el ícono, "Tenés N", descripción, precio y
 * "Comprar". Deshabilitado si no alcanza el saldo o si llegó al `limiteStack`.
 */
export default function ItemCard({ item, saldo, buying, tint = 'bg-blue-500', onBuy }) {
  const { codigo, nombre, descripcion, precio, cantidad, limiteStack } = item;
  const stackLleno = limiteStack != null && cantidad >= limiteStack;
  const sinSaldo = saldo < precio;
  const disabled = buying || stackLleno || sinSaldo;
  const Icon = ITEM_ICON[codigo] || GiftIcon;

  return (
    <article className={`${SURFACE} group p-4 sm:p-5 flex flex-col gap-3`}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`w-12 h-12 rounded-xl border-2 border-titi-dark grid place-items-center text-white shrink-0 -rotate-6 transition-transform duration-200 group-hover:rotate-0 group-hover:scale-105 motion-reduce:transition-none ${tint}`}
        >
          <Icon className="w-6 h-6" />
        </span>
        <h3 className="min-w-0 flex-1 text-lg font-extrabold text-titi-dark leading-snug pt-1">{nombre}</h3>
        {cantidad > 0 && (
          <span className="shrink-0 h-7 inline-flex items-center px-2.5 rounded-full bg-titi-yellow border-2 border-titi-dark text-xs font-extrabold text-titi-dark tabular-nums">
            Tenés {cantidad}
            {limiteStack != null && <span className="text-titi-dark/60">/{limiteStack}</span>}
          </span>
        )}
      </div>

      <p className="text-sm font-medium text-gray-600 bg-titi-cream border-2 border-gray-100 rounded-xl px-3 py-2.5">{descripcion}</p>

      <div className="flex items-center justify-between gap-3 mt-auto">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 text-titi-yellow-dark font-black text-xl tabular-nums">
            <GotaIcon className="w-5 h-5" />
            {precio}
          </span>
          {sinSaldo && !stackLleno && (
            <p className="text-xs font-bold text-gray-500 tabular-nums">Te faltan {precio - saldo} gotas</p>
          )}
        </div>
        <button type="button" onClick={() => onBuy(codigo)} disabled={disabled} className="titi-btn-primary text-sm px-5 py-2 disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_0px_#E6B800]">
          {stackLleno ? 'Máximo' : buying ? 'Comprando…' : 'Comprar'}
        </button>
      </div>
    </article>
  );
}
