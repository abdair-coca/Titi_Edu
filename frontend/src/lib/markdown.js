const SAFE_PROTOCOLS = new Set(['https:']);

export function sanitizeMarkdownUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  if (url.startsWith('./') || url.startsWith('../') || url.startsWith('#')) return url;

  try {
    const parsed = new URL(url);
    if (!SAFE_PROTOCOLS.has(parsed.protocol.toLowerCase())) return '';
    if (parsed.pathname.toLowerCase().endsWith('.svg')) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

export function isExternalMarkdownUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
