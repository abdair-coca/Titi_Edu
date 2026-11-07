import ReactMarkdown from 'react-markdown';
import { citationNumberFromHref, linkCitations } from '../../lib/dil.js';

const INLINE_ELEMENTS = ['p', 'strong', 'em', 'code', 'a'];

// Inline Markdown for DIL text fields: no HTML, links or images. [n] becomes a
// badge that opens its source.
export default function InlineText({ text, citationNumbers, onCite, paragraphs = false }) {
  return (
    <ReactMarkdown
      allowedElements={INLINE_ELEMENTS}
      unwrapDisallowed
      skipHtml
      components={{
        p: ({ children }) => (paragraphs ? <p className="mb-2 last:mb-0">{children}</p> : <>{children} </>),
        strong: ({ children }) => <strong className="font-bold text-titi-dark">{children}</strong>,
        code: ({ children }) => <code className="rounded bg-titi-cream px-1 py-0.5 text-xs font-semibold text-titi-dark">{children}</code>,
        a: ({ href, children }) => {
          const number = citationNumberFromHref(href);
          return number ? <CitationBadge number={number} onCite={onCite} /> : <span>{children}</span>;
        },
      }}
    >
      {linkCitations(text, citationNumbers)}
    </ReactMarkdown>
  );
}

function CitationBadge({ number, onCite }) {
  return (
    <button
      type="button"
      onClick={() => onCite?.(number)}
      aria-label={`Ver fuente ${number}`}
      className="mx-0.5 inline-flex min-w-[1.25rem] justify-center rounded-md bg-titi-yellow-light px-1 text-xs font-bold text-titi-dark align-baseline hover:bg-titi-yellow active:scale-95 transition-colors duration-150"
    >
      {number}
    </button>
  );
}
