// Mermaid is heavy: it loads only when a diagram appears, once, with strict
// security. Mermaid 11 still draws node labels as sanitized HTML inside
// <foreignObject>; the flowchart option below does not change that.
let mermaidPromise;
let renderId = 0;

export function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((module) => {
      const mermaid = module.default || module.mermaid || module;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        flowchart: { curve: 'basis', padding: 10, nodeSpacing: 32, rankSpacing: 40, htmlLabels: false },
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

export function nextMermaidId(prefix = 'titi-diagram') {
  renderId += 1;
  return `${prefix}-${renderId}`;
}

// Labels live in <foreignObject>, so it stays; anything that runs code, loads a
// document or takes input goes.
const UNSAFE_SVG_ELEMENTS = 'script, iframe, frame, object, embed, link, meta, base, form, input, button, textarea, select';

// The tutor's diagrams come from a model and land in the app document, so the
// SVG is cleaned again after Mermaid: no scripts, handlers or external links.
function sanitizeSvg(svg) {
  const svgDocument = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = svgDocument.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg') return null;
  svgDocument.querySelectorAll(UNSAFE_SVG_ELEMENTS).forEach((node) => node.remove());
  for (const node of [root, ...root.querySelectorAll('*')]) {
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase();
      const isLink = name === 'href' || name.endsWith(':href');
      if (name.startsWith('on') || (isLink && !attribute.value.trim().startsWith('#'))) node.removeAttribute(attribute.name);
    }
  }
  return new XMLSerializer().serializeToString(root);
}

// Returns null for a definition Mermaid cannot parse, so the caller shows text instead.
export async function renderMermaidSvg(definition) {
  const mermaid = await loadMermaid();
  const valid = await mermaid.parse(definition, { suppressErrors: true });
  if (!valid) return null;
  const { svg } = await mermaid.render(nextMermaidId('titi-tutor-diagram'), definition);
  return sanitizeSvg(svg);
}
