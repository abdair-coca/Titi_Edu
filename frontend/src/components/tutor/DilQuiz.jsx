import { useId, useState } from 'react';
import { CheckIcon, PracticeIcon } from '../icons.jsx';
import InlineText from './InlineText.jsx';

const LETTERS = 'ABCD';

// The browser never knows the correct option: the choice is sent as the student's
// answer and the tutor gives formative feedback in the next turn.
export default function DilQuiz({ node, inline, interactive, onAnswer }) {
  const questionId = useId();
  const [selected, setSelected] = useState(null);
  const [sent, setSent] = useState(false);
  const locked = sent || !interactive;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (locked || selected === null) return;
    setSent(true);
    onAnswer?.(node.options[selected]);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border-2 border-titi-yellow bg-titi-cream p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-titi-yellow-dark">
        <PracticeIcon className="w-4 h-4" aria-hidden="true" />
        Práctica
      </p>
      <p id={questionId} className="mt-1 text-sm font-bold text-titi-dark">
        <InlineText text={node.question} {...inline} />
      </p>
      <div role="radiogroup" aria-labelledby={questionId} className="mt-3 flex flex-col gap-2">
        {node.options.map((option, index) => {
          const checked = selected === index;
          return (
            <label
              key={index}
              className={`flex items-start gap-2.5 rounded-xl border-2 bg-white px-3 py-2.5 text-sm font-semibold text-titi-dark transition-all duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-titi-yellow ${
                checked ? 'border-titi-yellow-dark shadow-[0_3px_0px_#E6B800]' : 'border-gray-200 shadow-[0_3px_0px_#E5E7EB]'
              } ${locked ? 'cursor-default opacity-80' : 'cursor-pointer hover:border-titi-yellow active:translate-y-0.5 active:shadow-none'}`}
            >
              <input
                type="radio"
                name={questionId}
                value={index}
                checked={checked}
                disabled={locked}
                onChange={() => setSelected(index)}
                className="sr-only"
              />
              <span
                className={`w-6 h-6 shrink-0 grid place-items-center rounded-lg text-xs font-bold ${checked ? 'bg-titi-yellow text-titi-dark' : 'bg-gray-100 text-gray-500'}`}
                aria-hidden="true"
              >
                {LETTERS[index]}
              </span>
              <span className="min-w-0 flex-1 pt-0.5"><InlineText text={option} {...inline} /></span>
            </label>
          );
        })}
      </div>
      {sent ? (
        <p role="status" className="mt-3 flex items-center gap-1.5 text-xs font-bold text-green-700">
          <CheckIcon className="w-4 h-4" aria-hidden="true" />
          Respuesta enviada. El tutor te dará feedback.
        </p>
      ) : interactive ? (
        <button
          type="submit"
          disabled={selected === null}
          className="mt-3 bg-titi-yellow text-titi-dark font-bold text-sm px-4 py-2 rounded-xl shadow-[0_4px_0px_#E6B800] hover:shadow-[0_2px_0px_#E6B800] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_0px_#E6B800]"
        >
          Responder
        </button>
      ) : (
        <p className="mt-3 text-xs font-medium text-gray-500">Esta práctica ya no está activa.</p>
      )}
    </form>
  );
}
