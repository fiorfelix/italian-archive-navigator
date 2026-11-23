import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import * as z from 'zod/v4';
import { ruleFileSchema, type Rule } from './schema.js';

export class RulesError extends Error {
  readonly code = 'rules_invalid';
}

function readDir(dir: string, override: boolean): Rule[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.yaml'));
  } catch {
    return [];
  }
  return files.sort().flatMap((f) => {
    const path = join(dir, f);
    const result = ruleFileSchema.safeParse(parse(readFileSync(path, 'utf8')) as unknown);
    if (!result.success)
      throw new RulesError(`Invalid rule file ${path}:\n${z.prettifyError(result.error)}`);
    return result.data.rules.map((r) => ({
      ...r,
      file: f,
      override,
      version: result.data.version,
    }));
  });
}

/** Loads data/rules/<country>/*.yaml and its overrides/ folder, and checks rule consistency. */
export function loadRules(dir: string): Rule[] {
  const rules = [...readDir(dir, false), ...readDir(join(dir, 'overrides'), true)];
  const ids = new Set<string>();
  for (const r of rules) {
    if (ids.has(r.id)) throw new RulesError(`Duplicate rule id "${r.id}" (${r.file}).`);
    ids.add(r.id);
    if (r.period.from > r.period.to) {
      throw new RulesError(
        `Rule "${r.id}": period.from ${r.period.from} is after period.to ${r.period.to}.`,
      );
    }
  }
  if (!rules.some((r) => r.territory.national)) {
    throw new RulesError('No national rule: every comune must have a fallback answer.');
  }
  return rules;
}
