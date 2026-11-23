import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import * as z from 'zod/v4';
import type { Alias } from '../data/store.js';

const aliasEntry = z.object({
  alias: z.string().min(1),
  kind: z.enum(['frazione', 'historical_alias']),
  istat_code: z.string().regex(/^\d{6}$/),
  comune: z.string().min(1), // human-readable check value; must match the ISTAT name
  note: z.string().optional(),
  source_url: z.url(),
  verified: z.boolean(),
});

const aliasFile = z.object({
  version: z.number().int().positive(),
  aliases: z.array(aliasEntry),
});

export type AliasEntry = z.infer<typeof aliasEntry>;

export function loadAliases(path: string): AliasEntry[] {
  const raw = parse(readFileSync(path, 'utf8')) as unknown;
  const result = aliasFile.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid ${path}:\n${z.prettifyError(result.error)}`);
  }
  return result.data.aliases;
}

export function toAlias(e: AliasEntry): Alias {
  return {
    alias: e.alias,
    kind: e.kind,
    istat_code: e.istat_code,
    note: e.note ?? null,
    source_url: e.source_url,
    verified: e.verified,
  };
}
