import * as z from 'zod/v4';

/**
 * Text that looks like a web address or e-mail: a scheme ("http://"), "www.", an "@", or a
 * dotted host name ending in a common top-level domain ("example.com"; short endings such as .de are left out
 * because they collide with abbreviations like "G.De Ruggiero"). Place and person
 * names never need these, so name fields reject them (SPEC §5, M5).
 */
const LOOKS_LIKE_URL =
  /[a-z][a-z0-9+.-]*:\/\/|\bwww\.|@|\b[a-z0-9-]{2,}\.(com|it|org|net|gov|eu|io|info|biz)\b/i;

export function looksLikeUrl(value: string): boolean {
  return LOOKS_LIKE_URL.test(value);
}

/** A trimmed name or label: 1..max characters, no control characters, no web addresses. */
export const nameText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
    .refine((v) => !/[\u0000-\u001f\u007f]/.test(v), 'must not contain control characters')
    .refine((v) => !looksLikeUrl(v), 'looks like a web or e-mail address; enter a name only');

/** "yyyy" or "yyyy-mm-dd": a real calendar date, not in the future. */
export const pastDate = () =>
  z
    .string()
    .trim()
    .regex(/^\d{4}(-\d{2}-\d{2})?$/, 'use yyyy-mm-dd or yyyy')
    .refine((v) => {
      if (v.length === 4) return true;
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }, 'not a real date')
    .refine(
      (v) => v.slice(0, v.length === 4 ? 4 : 10) <= new Date().toISOString().slice(0, v.length),
      'date is in the future',
    );
