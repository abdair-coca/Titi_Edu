import { useState } from 'react';
import MarkdownContent from '../MarkdownContent.jsx';
import { AlertIcon, BookIcon, ChevronDownIcon, LightbulbIcon, PencilIcon } from '../icons.jsx';
import { BTN_SECONDARY_SM } from '../ui/v3.jsx';
import { usePopIn } from '../../lib/motion.js';
import DilDiagram from './DilDiagram.jsx';
import DilQuiz from './DilQuiz.jsx';
import InlineText from './InlineText.jsx';

const CALLOUT_TONES = {
  definicion: { label: 'Definición', box: 'border-blue-500 bg-blue-50', badge: 'bg-blue-500 text-white', Icon: BookIcon },
  tip: { label: 'Tip', box: 'border-titi-dark bg-titi-yellow-light', badge: 'bg-titi-yellow text-titi-dark', Icon: LightbulbIcon },
  advertencia: { label: 'Atención', box: 'border-titi-streak bg-orange-50', badge: 'bg-titi-streak text-white', Icon: AlertIcon },
  nota: { label: 'Nota', box: 'border-gray-300 bg-gray-50', badge: 'bg-titi-dark text-white', Icon: PencilIcon },
};

// Renders a DIL answer (see lib/dil.js). Text fields go through InlineText.
export default function DilMessage({ nodes, citationNumbers, onCite, onFocusInput, quizEnabled = false, onQuizAnswer }) {
  const ref = usePopIn([]);
  const inline = { citationNumbers, onCite };

  return (
    <div ref={ref} className="flex flex-col gap-3 text-sm text-gray-600 leading-relaxed">
      {nodes.map((node, index) => {
        const key = `${index}-${node.c}`;
        switch (node.c) {
          case 'Text':
            return <InlineText key={key} text={node.text} paragraphs {...inline} />;
          case 'Steps':
            return <StepsNode key={key} node={node} inline={inline} />;
          case 'Callout':
            return <CalloutNode key={key} node={node} inline={inline} />;
          case 'Concepts':
            return <ConceptsNode key={key} node={node} inline={inline} />;
          case 'Table':
            return <TableNode key={key} node={node} inline={inline} />;
          case 'Code':
            return <CodeNode key={key} node={node} inline={inline} />;
          case 'Diagram':
            return <DilDiagram key={key} node={node} inline={inline} />;
          case 'Quiz':
            return <DilQuiz key={key} node={node} inline={inline} interactive={quizEnabled} onAnswer={onQuizAnswer} />;
          case 'Check':
            return <CheckNode key={key} node={node} inline={inline} onFocusInput={onFocusInput} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

function StepsNode({ node, inline }) {
  return (
    <div>
      {node.title && (
        <p className="mb-2 text-sm font-extrabold text-titi-dark"><InlineText text={node.title} {...inline} /></p>
      )}
      <ol className="flex flex-col gap-2">
        {node.items.map((item, index) => (
          <li key={index} className="relative flex items-start gap-2.5">
            {index < node.items.length - 1 && (
              <span aria-hidden="true" className="absolute left-[11px] top-7 -bottom-2 w-0.5 bg-titi-yellow" />
            )}
            <span className="relative mt-0.5 w-6 h-6 shrink-0 grid place-items-center rounded-full bg-titi-yellow border-2 border-titi-dark text-xs font-black text-titi-dark tabular-nums" aria-hidden="true">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 pt-0.5"><InlineText text={item} {...inline} /></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CalloutNode({ node, inline }) {
  const tone = CALLOUT_TONES[node.tone] || CALLOUT_TONES.nota;
  const { Icon } = tone;
  return (
    <div role="note" className={`rounded-xl border-2 px-3 py-2.5 flex items-start gap-2.5 ${tone.box}`}>
      <span className={`mt-0.5 w-7 h-7 shrink-0 grid place-items-center rounded-lg border-2 border-titi-dark -rotate-6 ${tone.badge}`} aria-hidden="true">
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-extrabold uppercase tracking-wide text-titi-dark">
          {tone.label}
          {node.title && <span className="normal-case tracking-normal">: <InlineText text={node.title} {...inline} /></span>}
        </p>
        <p className="mt-0.5"><InlineText text={node.text} {...inline} /></p>
      </div>
    </div>
  );
}

function ConceptsNode({ node, inline }) {
  return (
    <div className="grid gap-2">
      {node.items.map((item, index) => <ConceptCard key={index} item={item} inline={inline} />)}
    </div>
  );
}

function ConceptCard({ item, inline }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border-2 bg-white overflow-hidden transition-all duration-150 ${open ? 'border-titi-dark shadow-[0_3px_0_#1A1A2E]' : 'border-gray-200 shadow-[0_3px_0_#E5E7EB]'}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-titi-cream active:translate-y-px transition-colors duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-titi-yellow/60"
      >
        <span className="text-sm font-extrabold text-titi-dark">{item.term}</span>
        <ChevronDownIcon className={`w-4 h-4 shrink-0 text-titi-dark transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <p className="px-3 pb-3"><InlineText text={item.text} {...inline} /></p>
        </div>
      </div>
    </div>
  );
}

function TableNode({ node, inline }) {
  return (
    <figure>
      {node.caption && (
        <figcaption className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-gray-500"><InlineText text={node.caption} {...inline} /></figcaption>
      )}
      <div className="overflow-x-auto rounded-xl border-2 border-titi-dark">
        <table className="w-full text-sm">
          <thead className="bg-titi-yellow-light border-b-2 border-titi-dark">
            <tr>
              {node.head.map((cell, index) => (
                <th key={index} scope="col" className="px-3 py-2 text-left text-xs font-extrabold uppercase tracking-wide text-titi-dark whitespace-nowrap">
                  <InlineText text={cell} {...inline} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {node.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-gray-100 even:bg-titi-cream/60">
                {row.map((cell, index) => (
                  <td key={index} className="px-3 py-2 align-top font-medium text-gray-600">
                    <InlineText text={cell} {...inline} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function CodeNode({ node, inline }) {
  const language = node.language === 'text' ? '' : node.language;
  return (
    <div>
      {node.caption && <p className="text-xs font-bold text-gray-500"><InlineText text={node.caption} {...inline} /></p>}
      <MarkdownContent content={`\`\`\`${language}\n${node.code}\n\`\`\``} format="MARKDOWN" compact codeCopy className="-my-2" />
    </div>
  );
}

function CheckNode({ node, inline, onFocusInput }) {
  return (
    <div className="rounded-xl border-2 border-titi-dark bg-titi-yellow-light px-3 py-3">
      <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-titi-dark">
        <LightbulbIcon className="w-4 h-4" />
        Comprobá tu comprensión
      </p>
      <p className="mt-1 text-sm font-bold text-titi-dark"><InlineText text={node.question} {...inline} /></p>
      {onFocusInput && (
        <button
          type="button"
          onClick={onFocusInput}
          className={`${BTN_SECONDARY_SM} mt-2.5`}
        >
          <PencilIcon className="w-4 h-4" />
          Responder
        </button>
      )}
    </div>
  );
}
