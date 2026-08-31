import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import python from 'highlight.js/lib/languages/python';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';
import yaml from 'highlight.js/lib/languages/yaml';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import java from 'highlight.js/lib/languages/java';
import 'highlight.js/styles/github.css';
import { isExternalMarkdownUrl, sanitizeMarkdownUrl } from '../lib/markdown.js';
import { CopyIcon } from './icons.jsx';

const HIGHLIGHT_LANGUAGES = { python, javascript, typescript, bash, json, xml, css, sql, markdown, yaml, c, cpp, java };

// Bloque de código con botón "Copiar" (solo cuando `codeCopy` está activo).
function CodeBlock({ children }) {
  const preRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = preRef.current?.innerText || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard no disponible — silencioso.
    }
  };

  return (
    <div className="relative my-4">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 z-10 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-xs font-bold text-gray-300 hover:bg-white/20 hover:text-white transition-colors"
      >
        <CopyIcon className="w-3.5 h-3.5" aria-hidden="true" />
        {copied ? 'Copiado' : 'Copiar'}
      </button>
      <pre ref={preRef} className="bg-titi-dark text-white rounded-xl p-4 pt-10 overflow-x-auto text-sm">
        {children}
      </pre>
    </div>
  );
}

function SafeLink({ href, children, ...props }) {
  const safeHref = sanitizeMarkdownUrl(href);
  if (!safeHref) return <span>{children}</span>;
  const external = isExternalMarkdownUrl(safeHref);
  return (
    <a
      {...props}
      href={safeHref}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="text-titi-yellow-dark font-semibold underline underline-offset-2 hover:text-titi-dark"
    >
      {children}
    </a>
  );
}

function SafeImage({ src, alt = '' }) {
  const safeSrc = sanitizeMarkdownUrl(src);
  if (!safeSrc) return null;
  return <img src={safeSrc} alt={alt} loading="lazy" referrerPolicy="no-referrer" className="max-w-full rounded-xl" />;
}

export default function MarkdownContent({ content, format = 'TEXTO', className = '', compact = false, codeCopy = false }) {
  if (format !== 'MARKDOWN') {
    return <div className={`whitespace-pre-line ${className}`}>{content}</div>;
  }

  return (
    <div className={`titi-markdown ${compact ? 'text-sm' : 'text-sm sm:text-base'} text-gray-600 leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { languages: HIGHLIGHT_LANGUAGES }]]}
        skipHtml
        urlTransform={sanitizeMarkdownUrl}
        components={{
          a: SafeLink,
          img: SafeImage,
          h1: ({ children }) => <h1 className="text-2xl font-extrabold text-titi-dark mt-6 mb-3">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-bold text-titi-dark mt-5 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-bold text-titi-dark mt-4 mb-2">{children}</h3>,
          p: ({ children }) => <p className="mb-3">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-titi-yellow pl-4 italic my-3">{children}</blockquote>,
          code: ({ className, children, ...props }) => (
            <code {...props} className={`${className || ''} ${className ? '' : 'rounded bg-titi-cream px-1 py-0.5'} text-sm`}>
              {children}
            </code>
          ),
          pre: codeCopy
            ? (props) => <CodeBlock {...props} />
            : ({ children }) => <pre className="bg-titi-dark text-white rounded-xl p-4 overflow-x-auto my-4 text-sm">{children}</pre>,
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}
