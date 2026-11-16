import DOMPurify from 'dompurify';

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const XXE_PATTERNS: RegExp[] = [
  /<!\s*doctype\b/i,
  /<!\s*entity\b/i,
  /\b(?:system|public)\s+["'][^"']*["']/i,
  /\b(?:file|php|expect|gopher|jar):\/\//i,
];

const DANGEROUS_URI_PATTERN = /^(?:\s*(?:javascript|vbscript|data\s*:\s*text\/html)\s*:)/i;

const CONTROL_CHARS_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Strips all HTML tags, scripts, event handlers, and dangerous URIs to prevent XSS.
 * Works safely in both Browser (DOMPurify) and Node.js server contexts.
 */
export function sanitizeText(value: unknown, maxLength = 2000): string {
  if (value === null || value === undefined) return '';
  let str = String(value).replace(CONTROL_CHARS_PATTERN, '');

  // Strip dangerous script/style blocks first even before DOMPurify/regex
  str = str
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');

  if (typeof window !== 'undefined' && typeof DOMPurify?.sanitize === 'function') {
    str = DOMPurify.sanitize(str, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });
  } else {
    str = str
      .replace(/<[^>]*>/g, '')
      .replace(/\bon\w+\s*=\s*(['"])[\s\S]*?\1/gi, '')
      .replace(/\bon\w+\s*=\s*[^\s>]+/gi, '');
  }

  // Neutralize dangerous URI schemes
  if (DANGEROUS_URI_PATTERN.test(str)) {
    str = str.replace(DANGEROUS_URI_PATTERN, '');
  }

  return str.slice(0, maxLength).trim();
}

/**
 * Sanitizes rich HTML safely (keeps safe formatting only).
 */
export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  if (typeof window !== 'undefined' && typeof DOMPurify?.sanitize === 'function') {
    return DOMPurify.sanitize(rawHtml, {
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'svg', 'math'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
    });
  }
  return sanitizeText(rawHtml);
}

/**
 * Detects XXE (XML External Entity) or DTD injection patterns in uploaded/raw text.
 */
export function hasXXEPayload(raw: string): boolean {
  if (!raw) return false;
  return XXE_PATTERNS.some((pattern) => pattern.test(raw));
}

/**
 * Prevents Excel / CSV Formula Injection (CSV/XLSX Injection) on export.
 * Numeric strings like "-12.5" are preserved; dangerous formula prefixes (=, +, -, @, tab, cr)
 * are neutralized by prefixing with a single quote.
 */
export function sanitizeSpreadsheetCell(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'boolean') return value;

  const clean = sanitizeText(String(value), 1000);
  if (!clean) return '';

  const trimmedStart = clean.replace(/^\s+/, '');
  const isNegativeNumber = /^-\d+(?:[.,]\d+)?$/.test(trimmedStart);
  if (!isNegativeNumber && /^[=+\-@\t\r]/.test(trimmedStart)) {
    return `'${clean}`;
  }
  return clean;
}

/**
 * Sanitizes imported spreadsheet cells against XSS, XXE, and formula injection.
 */
export function sanitizeImportedCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  if (hasXXEPayload(raw)) {
    throw new Error(
      'Fichier rejeté : directive XML/XXE potentiellement dangereuse détectée.'
    );
  }
  let clean = sanitizeText(raw, 1000);
  // Strip spreadsheet formula escape prefix or dangerous formula triggers
  if (/^['=+\-@]/.test(clean) && !/^-\d+(?:[.,]\d+)?$/.test(clean)) {
    clean = clean.replace(/^['=+\-@]+/, '').trim();
  }
  return clean;
}

/**
 * Recursively sanitizes objects and arrays while blocking Prototype Pollution keys
 * (__proto__, constructor, prototype).
 */
export function sanitizeRecordDeep<T>(input: T, depth = 0): T {
  if (depth > 16) {
    throw new Error('Profondeur de structure JSON excessive détectée.');
  }
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') {
    return sanitizeText(input, 4000) as unknown as T;
  }
  if (typeof input === 'number' || typeof input === 'boolean') {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeRecordDeep(item, depth + 1)) as unknown as T;
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
      if (FORBIDDEN_OBJECT_KEYS.has(key)) {
        continue;
      }
      const cleanKey = sanitizeText(key, 120);
      if (!cleanKey || FORBIDDEN_OBJECT_KEYS.has(cleanKey)) {
        continue;
      }
      out[cleanKey] = sanitizeRecordDeep(val, depth + 1);
    }
    return out as T;
  }
  return input;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Validates uploaded Excel/CSV files (size, extension, and ZIP/PK magic header for .xlsx).
 */
export function validateSpreadsheetUpload(
  fileName: string,
  buffer: ArrayBuffer
): 'xlsx' | 'csv' {
  if (buffer.byteLength === 0) {
    throw new Error('Le fichier importé est vide.');
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('Fichier trop volumineux (limite maximale : 10 Mo).');
  }

  const lower = fileName.toLowerCase().trim();
  if (lower.endsWith('.csv')) {
    const textSample = new TextDecoder('utf-8', { fatal: false }).decode(
      buffer.slice(0, Math.min(buffer.byteLength, 256 * 1024))
    );
    if (hasXXEPayload(textSample)) {
      throw new Error(
        'Import CSV bloqué : contenu XML/XXE non autorisé détecté.'
      );
    }
    return 'csv';
  }

  if (lower.endsWith('.xlsx')) {
    const bytes = new Uint8Array(buffer.slice(0, 4));
    // XLSX is an OOXML ZIP archive starting with PK\x03\x04
    const isZip =
      bytes.length >= 4 &&
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      bytes[2] === 0x03 &&
      bytes[3] === 0x04;
    if (!isZip) {
      throw new Error(
        'Format .xlsx invalide : signature binaire ZIP/OOXML non reconnue.'
      );
    }
    return 'xlsx';
  }

  throw new Error(
    'Extension de fichier non autorisée. Utilisez uniquement des fichiers .xlsx ou .csv.'
  );
}
