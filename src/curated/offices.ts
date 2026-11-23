import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import * as z from 'zod/v4';

const archiveEntry = z.object({
  province: z.string().regex(/^[A-Z]{2}$/),
  aoo: z.string().min(1).nullable(),
  verified: z.boolean(),
  note: z.string().optional(),
  source_url: z.url(),
});

const pointer = z.object({
  title: z.string(),
  rule: z.string(),
  rule_source_url: z.url().optional(),
  directory_url: z.url(),
  directory_note: z.string(),
  offices: z.array(z.string()),
  verified: z.literal(false),
  by_province: z
    .array(
      z.object({
        provinces: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1),
        name: z.string(),
        address: z.string(),
        pec: z.email(),
        source_url: z.url(),
        quote: z.string().max(200),
        note: z.string().optional(),
        verified: z.boolean(),
      }),
    )
    .optional(),
});

const officesFile = z.object({
  version: z.number().int().positive(),
  archivi_di_stato: z.array(archiveEntry),
  pointers: z.object({ ufficio_documentale_militare: pointer, diocesi: pointer }),
});

export type OfficesFile = z.infer<typeof officesFile>;
export type Pointer = z.infer<typeof pointer>;

export function loadOffices(path: string): OfficesFile {
  const result = officesFile.safeParse(parse(readFileSync(path, 'utf8')) as unknown);
  if (!result.success) throw new Error(`Invalid ${path}:\n${z.prettifyError(result.error)}`);
  const seen = new Set<string>();
  for (const a of result.data.archivi_di_stato) {
    if (seen.has(a.province)) throw new Error(`${path}: province ${a.province} is listed twice.`);
    seen.add(a.province);
  }
  return result.data;
}
