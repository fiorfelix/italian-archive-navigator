import type { Comune, Store } from '../data/store.js';
import { normalizeName } from '../data/normalize.js';
import { resolveComuneHistory } from './comune-history.js';

const words = (s: string) =>
  normalizeName(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
/** True if every word of `name` appears, in order and adjacent, in `full`. */
function containsName(full: string, name: string): boolean {
  const f = words(full).join(' ');
  const n = words(name).join(' ');
  return n.length > 0 && ` ${f} `.includes(` ${n} `);
}

export class ComuneInputError extends Error {
  constructor(
    readonly code: 'comune_not_found' | 'comune_ambiguous',
    message: string,
  ) {
    super(message);
  }
}

export interface ResolvedComune {
  comune: Comune;
  /** How the input was understood, when it was not the current name or code. */
  resolved_from?: string;
  /** Other comuni the same name could mean (e.g. a former name of another comune). */
  also_means?: string[];
}

/**
 * Turns a comune name (any era, a frazione, an alias) or a 6-digit ISTAT code into exactly
 * one comune existing today. Throws ComuneInputError with candidates when that is not possible.
 */
export function resolveComuneInput(
  store: Store,
  input: { comune: string; province?: string | undefined },
): ResolvedComune {
  const raw = input.comune.trim();
  if (/^\d{6}$/.test(raw)) {
    const c = store.getComune(raw);
    if (c) return { comune: c };
    throw new ComuneInputError(
      'comune_not_found',
      `No current comune has ISTAT code ${raw}. If it is an old code, give the comune name instead.`,
    );
  }
  const r = resolveComuneHistory(store, { name: raw, province: input.province });
  // A comune's current name outranks former names and localities: "Azzano d'Asti" means
  // today's comune, not the earlier comune of that name merged into Rocca d'Arazzo.
  const current = r.matches.filter(
    (m) => m.match === 'current_name' || m.match === 'current_name_other_language',
  );
  const considered = current.length ? current : r.matches;
  const targets = new Map<string, { how: string }>();
  for (const m of considered) {
    for (const c of m.current_comuni as { istat_code: string; name: string }[]) {
      if (!targets.has(c.istat_code)) {
        targets.set(c.istat_code, { how: `${String(m.matched_name)} (${String(m.match)})` });
      }
    }
  }
  // A comune found only through a spelling variant does not outweigh places spelled
  // exactly as given: treat that as ambiguous rather than guessing.
  const also = (
    r as { also_localities?: { shown: { name: string; comune: string }[]; total: number } }
  ).also_localities;
  if (also && !current.length && r.match_quality !== 'exact' && targets.size >= 1) {
    const list = [
      ...[...targets.keys()].map((code) => {
        const c = store.getComune(code)!;
        return `${c.name} (${c.province_abbr}, ISTAT ${c.istat_code})`;
      }),
      ...also.shown.map((l) => `${l.name}, locality of ${l.comune}`),
    ];
    throw new ComuneInputError(
      'comune_ambiguous',
      `"${raw}" could mean: ${list.slice(0, 10).join('; ')}${list.length > 10 ? '; …' : ''}. Give the province or the ISTAT code.`,
    );
  }
  if (targets.size === 0) {
    throw new ComuneInputError(
      'comune_not_found',
      `No comune or locality called "${raw}"${input.province ? ` in ${input.province}` : ''}. Check the spelling or use the 6-digit ISTAT code (resolve_comune_history can find it).`,
    );
  }
  if (targets.size > 1) {
    const list = [...targets.keys()]
      .slice(0, 10)
      .map((code) => store.getComune(code)!)
      .map((c) => `${c.name} (${c.province_abbr}, ISTAT ${c.istat_code})`)
      .join('; ');
    throw new ComuneInputError(
      'comune_ambiguous',
      `"${raw}" matches ${targets.size} comuni today: ${list}${targets.size > 10 ? '; …' : ''}. Give the province or the ISTAT code.`,
    );
  }
  const [code, info] = [...targets.entries()][0]!;
  const comune = store.getComune(code)!;
  // The current name won; say if the same name was also another comune's former name
  // ("Calliano" today in Trentino; also the former name of Calliano Monferrato, AT).
  const others = new Set<string>();
  if (current.length) {
    for (const m of r.matches) {
      if (current.includes(m)) continue;
      for (const c of m.current_comuni as { istat_code: string }[]) {
        // Only renames keep the asked name in today's name (Calliano → Calliano Monferrato);
        // a comune merged into a neighbour for a while (Bairo, 1929–1946) is not meant.
        const o = store.getComune(c.istat_code);
        if (c.istat_code !== code && o && containsName(o.name, raw)) others.add(c.istat_code);
      }
    }
  }
  const also_means = [...others].slice(0, 5).map((c) => {
    const o = store.getComune(c)!;
    return `"${raw}" was also the name of today's ${o.name} (${o.province_abbr}, ISTAT ${o.istat_code}); give that comune or its ISTAT code if you meant it.`;
  });
  const exact = info.how.startsWith(`${comune.name} (current_name`);
  return {
    comune,
    ...(exact
      ? {}
      : { resolved_from: `"${raw}" understood as ${info.how}, today part of ${comune.name}.` }),
    ...(also_means.length ? { also_means } : {}),
  };
}
