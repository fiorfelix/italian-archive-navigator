import type { Store } from '../data/store.js';
import type { RegisterGuide } from '../rules/register-guide.js';
import type { Rule } from '../rules/schema.js';
import type { SeriesFile } from '../rules/series.js';
import { whichRecordsExist, type RecordsInput } from './records.js';

/** Steps for reading a register efficiently; the same for every regime. */
export const READING_STEPS = [
  'Check the volume matches the comune, year and register type (births, marriages, deaths).',
  'Look for an index: at the end of the volume, or a separate ten-year index. Read it first and note the act numbers for the surnames you want.',
  'Go to those acts; act numbers run in order through the volume. Without an index, read the acts in date order.',
  'Read the margins too: later events are often noted there.',
  'Write down what is clearly legible, mark unreadable parts as [illeggibile], and keep the page reference for each act.',
];

/**
 * What to expect inside the register for a comune, year and event: the regime and records from
 * the rules, plus notes on how such registers are laid out (each marked verified or not).
 */
export function registerGuide(
  store: Store,
  rules: Rule[],
  guide: RegisterGuide,
  input: RecordsInput,
  now = new Date(),
  series: SeriesFile[] = [],
) {
  const r = whichRecordsExist(store, rules, input, now, series) as Record<string, unknown> & {
    regime?: { code: keyof RegisterGuide['regimes']; it: string; en: string } | null;
    rule?: { id: string; verified: boolean; source_url: string };
  };
  const g = r.regime ? guide.regimes[r.regime.code] : undefined;
  return {
    comune: r.comune,
    event: r.event,
    regime: r.regime ?? null,
    ...(r.routed_to_comune ? { routed_to_comune: true, access_note: r.access_note } : {}),
    ...(r.records ? { records: r.records } : {}),
    ...(r.archive_series ? { archive_series: r.archive_series } : {}),
    layout: g
      ? {
          title: g.title,
          notes: g.notes.map((n) => ({
            text: n.text.replace(/\s+/g, ' ').trim(),
            verified: n.verified,
            ...(n.source_url ? { source_url: n.source_url } : {}),
            ...(n.quote ? { quote: n.quote } : {}),
          })),
        }
      : null,
    reading_steps: READING_STEPS,
    ...(r.rule
      ? { rule: { id: r.rule.id, verified: r.rule.verified, source_url: r.rule.source_url } }
      : {}),
    notes: [
      ...((r.notes as string[] | undefined) ?? []),
      ...(g ? [] : ['No notes on register layout for this regime yet.']),
      'Notes marked verified: false describe typical practice, not a rule: check the volume itself.',
    ],
  };
}
