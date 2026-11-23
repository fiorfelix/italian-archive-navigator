import { italianDate } from './draft.js';

export const EVIDENCE_LABELS = [
  'VERIFIED',
  'INDEX',
  'SECONDARY',
  'INFERENCE',
  'FAMILY_ACCOUNT',
] as const;
export type EvidenceLabel = (typeof EVIDENCE_LABELS)[number];

/** How the researcher knows the fact; mapped to the fixed evidence label. */
export const SEEN_AS = {
  original_record: 'VERIFIED',
  index_entry: 'INDEX',
  transcription_or_publication: 'SECONDARY',
  derived_from_other_records: 'INFERENCE',
  family_account: 'FAMILY_ACCOUNT',
} as const satisfies Record<string, EvidenceLabel>;
export type SeenAs = keyof typeof SEEN_AS;

const LABEL_MEANING: Record<EvidenceLabel, string> = {
  VERIFIED: 'Seen in the original record (or its image).',
  INDEX: 'Found in an index or register table, not yet checked in the act itself.',
  SECONDARY: 'From a transcription, database or publication, not the original.',
  INFERENCE: 'Deduced from other records; not stated directly by any record.',
  FAMILY_ACCOUNT: 'From family memory or documents not yet matched to a record.',
};

const RECORD_IT = {
  birth: 'atto di nascita',
  marriage: 'atto di matrimonio',
  death: 'atto di morte',
  baptism: 'atto di battesimo',
  burial: 'atto di sepoltura',
  military: 'foglio matricolare',
  other: 'documento',
} as const;
export type RecordType = keyof typeof RECORD_IT;

export interface CiteInput {
  archive: string;
  fonds?: string | undefined;
  series?: string | undefined;
  comune?: string | undefined;
  year?: number | undefined;
  record_type?: RecordType | undefined;
  act_number?: string | undefined;
  person?: string | undefined;
  url?: string | undefined;
  accessed?: string | undefined;
  seen_as: SeenAs;
}

/**
 * One citation style for every record: archive, fonds, series, comune, year, record and
 * act number, then the link and access date. Missing parts are left out, not invented.
 */
export function citeSource(input: CiteInput) {
  const label = SEEN_AS[input.seen_as];
  const record = input.record_type
    ? `${RECORD_IT[input.record_type]}${input.act_number ? ` n. ${input.act_number}` : ''}`
    : input.act_number
      ? `n. ${input.act_number}`
      : undefined;
  const parts = [
    input.archive,
    input.fonds,
    input.series,
    input.comune,
    input.year ? String(input.year) : undefined,
    record,
    input.person ? `(${input.person})` : undefined,
  ].filter((p): p is string => !!p && p.trim() !== '');
  let citation = parts.join(', ').replace(/, \(/, ' (');
  if (input.url) {
    citation += `, ${input.url}`;
    citation += input.accessed ? ` (consultato il ${italianDate(input.accessed)})` : '';
  }
  citation += '.';

  const missing: string[] = [];
  if (!input.fonds && !input.series) missing.push('fonds or series');
  if (!input.year) missing.push('year');
  if (!input.act_number && input.record_type !== 'other') missing.push('act number');
  if (input.url && !input.accessed) missing.push('access date for the link');

  return {
    citation,
    evidence: { label, meaning: LABEL_MEANING[label] },
    citation_with_label: `${citation} [${label}]`,
    ...(missing.length ? { missing_for_a_complete_citation: missing } : {}),
  };
}
