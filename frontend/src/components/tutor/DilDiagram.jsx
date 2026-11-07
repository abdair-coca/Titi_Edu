import { useEffect, useState } from 'react';
import MarkdownContent from '../MarkdownContent.jsx';
import { renderMermaidSvg } from '../../lib/mermaid.js';
import InlineText from './InlineText.jsx';

function plainCaption(caption) {
  return String(caption || '').replace(/\[\d{1,3}\]/g, '').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
}

// A diagram that Mermaid cannot draw falls back to its caption and source,
// with no visible error: the answer is still readable.
export default function DilDiagram({ node, inline }) {
  const [state, setState] = useState({ status: 'loading', svg: null });
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', svg: null });
    renderMermaidSvg(node.source)
      .then((svg) => { if (!cancelled) setState(svg ? { status: 'ready', svg } : { status: 'failed', svg: null }); })
      .catch(() => { if (!cancelled) setState({ status: 'failed', svg: null }); });
    return () => { cancelled = true; };
  }, [node.source]);

  const failed = state.status === 'failed';
  const source = <MarkdownContent content={`\`\`\`\n${node.source}\n\`\`\``} format="MARKDOWN" compact className="-my-2" />;

  return (
    <figure className="rounded-xl border-2 border-gray-200 bg-white p-3">
      {state.status === 'loading' && (
        <div className="h-32 rounded-lg bg-gray-100 animate-pulse motion-reduce:animate-none" role="status" aria-label="Dibujando diagrama" />
      )}
      {state.status === 'ready' && (
        <div
          role="img"
          aria-label={plainCaption(node.caption)}
          className="overflow-x-auto flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      )}
      {failed && source}
      <figcaption className="mt-2 flex items-start justify-between gap-2">
        <span className="text-xs font-bold text-gray-500"><InlineText text={node.caption} {...inline} /></span>
        {state.status === 'ready' && (
          <button
            type="button"
            onClick={() => setShowSource((value) => !value)}
            aria-expanded={showSource}
            className="shrink-0 text-xs font-bold text-blue-500 hover:text-titi-dark transition-colors duration-150"
          >
            {showSource ? 'Ocultar texto' : 'Ver como texto'}
          </button>
        )}
      </figcaption>
      {state.status === 'ready' && showSource && <div className="mt-2">{source}</div>}
    </figure>
  );
}
