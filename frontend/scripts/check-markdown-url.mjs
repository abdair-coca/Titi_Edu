import { sanitizeMarkdownUrl } from '../src/lib/markdown.js';

const safe = ['https://example.com', 'http://example.com', 'mailto:hello@example.com', '/docs', './docs', '../docs', '#section'];
const unsafe = ['javascript:alert(1)', 'data:text/html,boom', 'file:///private.txt', '//evil.example', 'ftp://example.com'];

if (!safe.every((value) => sanitizeMarkdownUrl(value))) throw new Error('Se rechazó una URL segura');
if (unsafe.some((value) => sanitizeMarkdownUrl(value))) throw new Error('Se permitió una URL insegura');

console.log('markdown URL sanitation: pass');
