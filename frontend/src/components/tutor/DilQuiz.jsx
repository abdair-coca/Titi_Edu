import { useId, useState } from 'react';
import { CheckIcon, PracticeIcon, SendIcon } from '../icons.jsx';
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
    <form onSubmit={handleSubmit} className="rounded-xl border-2 border-titi-dark bg-titi-cream p-3">
      <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-titi-dark">
        <span className="w-6 h-6 rounded-md bg-green-500 border-2 border-titi-dark grid place-items-center text-white -rotate-6" aria-hidden="true">
          <PracticeIcon className="w-3.5 h-3.5" />
        </span>
        Práctica
      </p>
      <p id={questionId} className="mt-2 text-sm font-extrabold text-titi-dark">
        <InlineText text={node.question} {...inline} />
      </p>
      <div role="radiogroup" aria-labelledby={questionId} className="mt-3 flex flex-col gap-2">
        {node.options.map((option, index) => {
          const checked = selected === index;
          return (
            <label
              key={index}
              className={`group flex items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 text-sm font-bold text-titi-dark transition-all duration-150 motion-reduce:transition-none has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-titi-yellow/60 ${
                checked ? 'bg-titi-yellow border-titi-dark shadow-[0_3px_0_#1A1A2E]' : 'bg-white border-gray-200'
              } ${locked ? 'cursor-default opacity-80' : 'cursor-pointer hover:border-titi-dark active:translate-y-0.5 active:shadow-none'}`}
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
                className={`w-6 h-6 shrink-0 grid place-items-center rounded-lg border-2 text-xs font-black ${checked ? 'bg-titi-dark border-titi-dark text-white' : 'bg-white border-gray-300 text-gray-500'}`}
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
        <p role="status" className="mt-3 flex items-center gap-2 text-sm font-bold text-green-700">
          <span className="w-5 h-5 rounded-full bg-green-500 grid place-items-center text-white shrink-0" aria-hidden="true">
            <CheckIcon className="w-3 h-3" />
          </span>
          Respuesta enviada. El tutor te dará feedback.
        </p>
      ) : interactive ? (
        <button
          type="submit"
          disabled={selected === null}
          className="titi-btn-primary mt-3 text-sm px-4 py-2 disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_0px_#E6B800]"
        >
          <SendIcon className="w-4 h-4" />
          Responder
        </button>
      ) : (
        <p className="mt-3 text-xs font-semibold text-gray-500">Esta práctica ya no está activa.</p>
      )}
    </form>
  );
}
