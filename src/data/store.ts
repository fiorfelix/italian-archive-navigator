/**
 * The only interface the tools use to read data (SPEC §3). The SQLite implementation lives
 * in sqlite-store.ts; a hosted SQL implementation can replace it at deploy time.
 */
export interface Comune {
  istat_code: string;
  name: string;
  name_it: string;
  name_other: string | null;
  cadastral_code: string;
  province_code: string;
  province_abbr: string;
  province_name: string;
  region_code: string;
  region_name: string;
}

export interface ComuneEvent {
  report: number;
  type: string;
  event_date: string;
  code: string;
  name: string;
  name_other: string | null;
  province_abbr: string | null;
  province_code: string | null;
  rel_code: string | null;
  rel_name: string | null;
  rel_province_abbr: string | null;
  rel_province_code: string | null;
  flag: string | null;
}

export interface ProvinceEvent {
  report: number;
  type: string;
  event_date: string;
  code: string;
  name: string;
  abbr: string | null;
  rel_code: string | null;
  rel_name: string | null;
  rel_abbr: string | null;
}

export interface Locality {
  loc_id: string;
  name: string;
  type: 1 | 2;
  istat_code: string;
}

/** A Comune's own entry in IndicePA. Only PEC addresses are kept. */
export interface ComuneContact {
  istat_code: string;
  ipa_code: string;
  name: string;
  address: string | null;
  cap: string | null;
  pec: string[];
  website: string | null;
  updated: string | null;
}

/** An office (unità organizzativa) of a Comune, e.g. Servizi demografici / Stato civile. */
export interface ComuneOffice {
  istat_code: string;
  uo_code: string;
  name: string;
  address: string | null;
  cap: string | null;
  emails: { address: string; pec: boolean }[];
  updated: string | null;
}

/** A state office from IndicePA (Archivio di Stato, Soprintendenza, Defence office). */
export interface StateOffice {
  aoo_code: string;
  kind: 'archivio_di_stato' | 'soprintendenza_archivistica' | 'difesa';
  name: string;
  address: string | null;
  cap: string | null;
  comune: string | null;
  province_abbr: string | null;
  pec: string[];
}

export interface ArchiveMapping {
  province_abbr: string;
  aoo_code: string | null;
  basis: 'curated' | 'same_province';
  verified: boolean;
  note: string | null;
  source_url: string;
}

export interface Alias {
  alias: string;
  kind: 'frazione' | 'historical_alias';
  istat_code: string;
  note: string | null;
  source_url: string;
  verified: boolean;
}

export type NameKind = 'current' | 'current_other_language' | 'historical' | 'alias' | 'locality';

export interface NameHit {
  name: string;
  kind: NameKind;
  ref: string;
  /** yyyy-mm-dd on which the name belonged to the comune coded `ref` ('9999-12-31' = today). */
  ref_date: string;
}

export interface SourceInfo {
  id: string;
  title: string;
  page_url: string;
  route: string;
  sha256: string;
  downloaded_at: string;
  licence: string;
  licence_url: string;
}

export interface Store {
  findNamesByNorm(norm: string): NameHit[];
  findNamesByVariant(variant: string): NameHit[];
  /** Every indexed name with its variant key, for fuzzy matching. */
  allVariants(): (NameHit & { variant: string })[];
  getComune(istatCode: string): Comune | undefined;
  /** Events where the comune is the subject (`code`), ordered by date. */
  eventsOf(codes: string[]): ComuneEvent[];
  /** Events where the comune is the other party (`rel_code`), ordered by date. */
  eventsRelatedTo(codes: string[]): ComuneEvent[];
  /** Province names known for a province code, from today's list and province events. */
  provinceEvents(code: string): ProvinceEvent[];
  currentProvinceName(code: string): string | undefined;
  aliasesByNorm(norm: string): Alias[];
  comuneContact(istatCode: string): ComuneContact | undefined;
  comuneOffices(istatCode: string): ComuneOffice[];
  stateOffice(aooCode: string): StateOffice | undefined;
  archiveForProvince(abbr: string): ArchiveMapping | undefined;
  pointer(officeType: string): unknown;
  /** ISO timestamp of the source download for a source id, if known. */
  sourceDate(id: string): string | undefined;
  localitiesByNorm(norm: string): Locality[];
  sources(): SourceInfo[];
  /** ISO timestamp of the last successful refresh-data run. */
  refreshedAt(): string;
  close(): void;
}
