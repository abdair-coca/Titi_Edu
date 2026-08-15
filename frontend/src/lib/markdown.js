const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function sanitizeMarkdownUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  if (url.startsWith('./') || url.startsWith('../') || url.startsWith('#')) return url;

  try {
    const parsed = new URL(url);
    return SAFE_PROTOCOLS.has(parsed.protocol.toLowerCase()) ? url : '';
  } catch {
    return '';
  }
}

export function isExternalMarkdownUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
