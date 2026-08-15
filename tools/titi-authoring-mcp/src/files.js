import fs from 'node:fs/promises';
import path from 'node:path';
import { TitiApiError } from './errors.js';

export const MAX_MATERIAL_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MATERIAL_EXTENSIONS = Object.freeze([
  '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx', '.txt', '.md', '.py',
]);

const MIME_TYPES = Object.freeze({
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.py': 'text/x-python',
});

export async function loadMaterialFile(filePath) {
  const resolvedPath = path.resolve(filePath);
  let stats;
  try {
    stats = await fs.lstat(resolvedPath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new TitiApiError('Material file does not exist', { code: 'INVALID_MATERIAL_PATH' });
    }
    throw new TitiApiError('Material file cannot be inspected', { code: 'INVALID_MATERIAL_PATH' });
  }
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new TitiApiError('Material path must reference a regular file, not a directory or symbolic link', {
      code: 'INVALID_MATERIAL_PATH',
    });
  }
  const extension = path.extname(resolvedPath).toLowerCase();
  if (!ALLOWED_MATERIAL_EXTENSIONS.includes(extension)) {
    throw new TitiApiError(`Material extension is not allowed: ${extension || '(none)'}`, {
      code: 'INVALID_MATERIAL_EXTENSION',
      data: { allowedExtensions: ALLOWED_MATERIAL_EXTENSIONS },
    });
  }
  if (stats.size > MAX_MATERIAL_BYTES) {
    throw new TitiApiError('Material file exceeds the 10 MiB limit', {
      code: 'MATERIAL_TOO_LARGE',
      data: { size: stats.size, maxSize: MAX_MATERIAL_BYTES },
    });
  }
  const bytes = await fs.readFile(resolvedPath);
  return {
    bytes,
    filename: path.basename(resolvedPath),
    mimeType: MIME_TYPES[extension],
    extension,
    size: stats.size,
  };
}
