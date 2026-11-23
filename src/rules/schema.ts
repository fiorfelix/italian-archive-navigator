import * as z from 'zod/v4';

export const EVENT_TYPES = ['birth', 'marriage', 'death', 'military'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected yyyy-mm-dd');
const text = z.object({ it: z.string().min(1), en: z.string().min(1) });

export const REGIMES = {
  napoleonic: { it: 'Stato civile napoleonico', en: 'Napoleonic civil registration' },
  restoration_civil: {
    it: 'Stato civile della Restaurazione',
    en: 'Restoration-era civil registration',
  },
  tuscan_civil: {
    it: 'Stato civile toscano (compilato dai parroci)',
    en: 'Tuscan state registers compiled by parish priests',
  },
  parish_civil: {
    it: 'Registri parrocchiali con valore civile',
    en: 'Parish registers with civil validity',
  },
  parish_only: {
    it: 'Solo registri parrocchiali',
    en: 'Parish registers only (no civil registration)',
  },
  italian_civil: { it: 'Stato civile italiano', en: 'Italian civil registration' },
  foreign_parish: {
    it: 'Registri parrocchiali (amministrazione non italiana)',
    en: 'Parish registers under a non-Italian administration',
  },
  military_records: { it: 'Documentazione matricolare militare', en: 'Military service records' },
} as const;

export const HOLDER_TYPES = [
  'stato_civile',
  'archivio_di_stato',
  'parrocchia',
  'diocesi',
  'ufficio_documentale_militare',
  'ministero_difesa',
] as const;

const territory = z
  .object({
    national: z.literal(true).optional(),
    /** ISTAT date the territory joined Italy (AN event); null means "already Italian in 1861". */
    joined_italy: z
      .object({ from: isoDate.optional(), to: isoDate.optional(), in_1861: z.boolean().optional() })
      .optional(),
    /** Province (ISTAT abbreviation convention) at the comune's first recorded date. */
    first_provinces: z.array(z.string().regex(/^[A-Z]{2}$|^[A-Za-z ]+$/)).optional(),
    provinces: z.array(z.string().regex(/^[A-Z]{2}$/)).optional(),
    regions: z.array(z.string().min(2)).optional(),
    comuni: z.array(z.string().regex(/^\d{6}$/)).optional(),
  })
  .refine((t) => Object.keys(t).length > 0, 'territory needs at least one selector');

export const ruleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  territory,
  period: z.object({ from: isoDate, to: isoDate }),
  events: z.array(z.enum(EVENT_TYPES)).min(1),
  regime: z.enum(Object.keys(REGIMES) as [keyof typeof REGIMES, ...(keyof typeof REGIMES)[]]),
  records: z.array(text).min(1),
  holders: z
    .array(z.object({ what: text, office_type: z.enum(HOLDER_TYPES), note: z.string().optional() }))
    .min(1),
  fallbacks: z.array(text),
  notes: z.array(z.string()).optional(),
  source_url: z.url(),
  sources: z.array(z.object({ url: z.url(), quote: z.string().max(200).optional() })).optional(),
  verified: z.boolean(),
  /** Regions (today) for which this rule has been reviewed; elsewhere it is "not yet reviewed". */
  reviewed_for: z.array(z.string().min(2)),
});

export const ruleFileSchema = z.object({
  version: z.number().int().positive(),
  state: z.string().min(1),
  state_en: z.string().min(1),
  rules: z.array(ruleSchema).min(1),
});

export type Rule = z.infer<typeof ruleSchema> & {
  file: string;
  override: boolean;
  version: number;
};
