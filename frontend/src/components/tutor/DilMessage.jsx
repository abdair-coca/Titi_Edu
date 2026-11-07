import { useState } from 'react';
import MarkdownContent from '../MarkdownContent.jsx';
import { BookIcon, ChevronDownIcon, LightbulbIcon, PencilIcon } from '../icons.jsx';
import { usePopIn } from '../../lib/motion.js';
import DilDiagram from './DilDiagram.jsx';
import DilQuiz from './DilQuiz.jsx';
import InlineText from './InlineText.jsx';

const CALLOUT_TONES = {
  definicion: { label: 'Definición', box: 'border-blue-200 bg-blue-50', badge: 'bg-blue-500 text-white', Icon: BookIcon },
  tip: { label: 'Tip', box: 'border-titi-yellow bg-titi-yellow-light/40', badge: 'bg-titi-yellow text-titi-dark', Icon: LightbulbIcon },
  advertencia: { label: 'Atención', box: 'border-amber-200 bg-amber-50', badge: 'bg-amber-500 text-white', Icon: null },
  nota: { label: 'Nota', box: 'border-gray-200 bg-gray-50', badge: 'bg-gray-500 text-white', Icon: PencilIcon },
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
        <p className="mb-2 text-sm font-bold text-titi-dark"><InlineText text={node.title} {...inline} /></p>
      )}
      <ol className="flex flex-col gap-2">
        {node.items.map((item, index) => (
          <li key={index} className="flex items-start gap-2.5">
            <span className="mt-0.5 w-6 h-6 shrink-0 grid place-items-center rounded-full bg-titi-yellow text-xs font-bold text-titi-dark tabular-nums" aria-hidden="true">
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
    <div role="note" className={`rounded-xl border px-3 py-2.5 flex items-start gap-2.5 ${tone.box}`}>
      <span className={`mt-0.5 w-6 h-6 shrink-0 grid place-items-center rounded-lg text-xs font-black ${tone.badge}`} aria-hidden="true">
        {Icon ? <Icon className="w-3.5 h-3.5" /> : '!'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wide text-titi-dark">
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
    <div className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden shadow-[0_3px_0px_#E5E7EB]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-titi-cream active:translate-y-px transition-colors duration-150"
      >
        <span className="text-sm font-bold text-titi-dark">{item.term}</span>
        <ChevronDownIcon className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
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
        <figcaption className="mb-1.5 text-xs font-bold text-gray-500"><InlineText text={node.caption} {...inline} /></figcaption>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-titi-cream">
            <tr>
              {node.head.map((cell, index) => (
                <th key={index} scope="col" className="px-3 py-2 text-left font-bold text-titi-dark whitespace-nowrap">
                  <InlineText text={cell} {...inline} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {node.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-gray-100">
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
    <div className="rounded-xl border-2 border-titi-yellow bg-titi-cream px-3 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-titi-yellow-dark">Comprobá tu comprensión</p>
      <p className="mt-1 text-sm font-semibold text-titi-dark"><InlineText text={node.question} {...inline} /></p>
      {onFocusInput && (
        <button
          type="button"
          onClick={onFocusInput}
          className="mt-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-titi-dark hover:border-titi-yellow active:scale-95 transition-all duration-150"
        >
          Responder
        </button>
      )}
    </div>
  );
}
