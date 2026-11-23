import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import * as z from 'zod/v4';
import { REGIMES } from './schema.js';

const note = z.object({
  text: z.string().min(1),
  source_url: z.url().optional(),
  quote: z.string().max(200).optional(),
  verified: z.boolean(),
});

const guideFile = z.object({
  version: z.number().int().positive(),
  regimes: z.partialRecord(
    z.enum(Object.keys(REGIMES) as [keyof typeof REGIMES, ...(keyof typeof REGIMES)[]]),
    z.object({ title: z.string().min(1), notes: z.array(note).min(1) }),
  ),
});

export type RegisterGuide = z.infer<typeof guideFile>;

/** Loads and validates the register guide. A verified note must cite a source and a quote. */
export function loadRegisterGuide(path: string): RegisterGuide {
  const result = guideFile.safeParse(parse(readFileSync(path, 'utf8')) as unknown);
  if (!result.success) throw new Error(`Invalid ${path}:\n${z.prettifyError(result.error)}`);
  for (const [regime, g] of Object.entries(result.data.regimes)) {
    for (const n of g.notes) {
      if (n.verified && (!n.source_url || !n.quote)) {
        throw new Error(`${path}: a verified note for ${regime} needs source_url and quote.`);
      }
    }
  }
  return result.data;
}
