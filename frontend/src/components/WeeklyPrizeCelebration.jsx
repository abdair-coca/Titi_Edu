import TitiMascot from './TitiMascot.jsx';
import { GotaIcon } from './icons.jsx';
import { useGamification } from '../context/GamificationContext.jsx';

/**
 * WeeklyPrizeCelebration — overlay que felicita al usuario cuando fue el top de
 * su grupo de amigos la semana pasada. Lee `weeklyPrize` del GamificationContext
 * (detectado al entrar) y se cierra al confirmar.
 */
export default function WeeklyPrizeCelebration() {
  const { weeklyPrize, dismissWeeklyPrize } = useGamification();
  if (!weeklyPrize) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Premio semanal"
      className="fixed inset-0 z-[60] grid place-items-center p-4 bg-titi-dark/60"
      onClick={dismissWeeklyPrize}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl border border-titi-yellow shadow-2xl p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-bold text-titi-yellow-dark uppercase tracking-wide">
          ¡Top de la semana!
        </p>
        <div className="flex justify-center my-2">
          <TitiMascot state="celebra" size="lg" message="" />
        </div>
        <h2 className="text-2xl font-extrabold text-titi-dark">
          Fuiste #1 de tus amigos
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Ganaste el bonus por liderar el ranking semanal.
        </p>

        <div className="mt-4 inline-flex items-center gap-2 bg-titi-yellow-light border border-titi-yellow rounded-xl px-4 py-2">
          <GotaIcon className="w-6 h-6 text-titi-yellow-dark" />
          <span className="text-2xl font-black text-titi-dark tabular-nums">
            +50
          </span>
        </div>

        <button
          type="button"
          onClick={dismissWeeklyPrize}
          className="mt-6 w-full bg-titi-yellow text-titi-dark font-bold text-base px-6 py-3 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150"
        >
          ¡Genial!
        </button>
      </div>
    </div>
  );
}
