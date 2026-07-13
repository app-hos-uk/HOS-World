import { BadRequestException } from '@nestjs/common';
import { resolve, sep } from 'path';

const MAX_SEGMENTS = 10;
const MAX_SEGMENT_LEN = 64;

/** Sanitize one path segment (no slashes). */
function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, MAX_SEGMENT_LEN);
}

/** Sanitize a filename while preserving the extension dot. */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '').substring(0, 255);
}

/**
 * Sanitize a nested upload folder path (e.g. gallery/us/times-square/my-event).
 * Allows `/` between segments; blocks `..` and empty segments.
 */
export function sanitizeUploadFolder(folder: string): string {
  if (!folder?.trim()) return 'uploads';

  const raw = folder.trim().replace(/\\/g, '/');
  if (raw.includes('..') || raw.startsWith('/')) {
    throw new BadRequestException('Invalid upload folder path');
  }

  const segments = raw
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(sanitizeSegment)
    .filter(Boolean)
    .slice(0, MAX_SEGMENTS);

  return segments.length > 0 ? segments.join('/') : 'uploads';
}

/**
 * Parse a relative path under /uploads/ into folder + filename.
 * Example: gallery/us/times-square/uuid.jpg → { folder, filename }
 */
export function parseUploadRelativePath(relativePath: string): {
  folder: string;
  filename: string;
} {
  if (!relativePath?.trim()) {
    throw new BadRequestException('Invalid file path');
  }

  const raw = relativePath.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (raw.includes('..')) {
    throw new BadRequestException('Invalid file path');
  }

  const parts = raw.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new BadRequestException('Invalid file path');
  }

  const filename = sanitizeFilename(parts[parts.length - 1]);
  if (!filename || !filename.includes('.')) {
    throw new BadRequestException('Invalid filename');
  }

  const folderParts = parts
    .slice(0, -1)
    .map(sanitizeSegment)
    .filter(Boolean);

  if (folderParts.length === 0) {
    throw new BadRequestException('Invalid file path');
  }

  return {
    folder: folderParts.join('/'),
    filename,
  };
}

/** Resolve absolute file path and ensure it stays inside uploadBasePath. */
export function resolveUploadFilePath(
  uploadBasePath: string,
  folder: string,
  filename: string,
): string {
  const safeFolder = sanitizeUploadFolder(folder);
  const safeFilename = sanitizeFilename(filename);
  if (!safeFilename) {
    throw new BadRequestException('Invalid filename');
  }

  const segments = safeFolder.split('/');
  const resolved = resolve(uploadBasePath, ...segments, safeFilename);
  const base = resolve(uploadBasePath);

  if (resolved !== base && !resolved.startsWith(base + sep)) {
    throw new BadRequestException('Invalid file path');
  }

  return resolved;
}
