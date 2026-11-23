import { existsSync } from 'node:fs';
// node:sqlite renamed DatabaseSync to Database (Node 25); @types/node 26.6 only types the old
// name. Both are the same class at runtime (checked on Node 26.13.1).
import { DatabaseSync as Database } from 'node:sqlite';
import { normalizeName } from './normalize.js';
import { SCHEMA_VERSION } from './schema.js';
import type {
  Alias,
  ArchiveMapping,
  Comune,
  ComuneContact,
  ComuneOffice,
  StateOffice,
  ComuneEvent,
  Locality,
  NameHit,
  ProvinceEvent,
  SourceInfo,
  Store,
} from './store.js';

export class DataUnavailableError extends Error {
  readonly code = 'data_unavailable';
}

export class SqliteStore implements Store {
  private readonly db: Database;
  private variantsCache?: (NameHit & { variant: string })[];

  constructor(path: string) {
    if (!existsSync(path)) {
      throw new DataUnavailableError(
        `Database not found at ${path}. Run "npm run refresh-data" to build it.`,
      );
    }
    this.db = new Database(path, { readOnly: true });
    const row = this.db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
      { value: string } | undefined;
    if (Number(row?.value) !== SCHEMA_VERSION) {
      this.db.close();
      throw new DataUnavailableError(
        `Database schema version ${row?.value ?? 'unknown'} does not match ${SCHEMA_VERSION}. Run "npm run refresh-data".`,
      );
    }
  }

  private all<T>(sql: string, ...params: (string | number)[]): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  findNamesByNorm(norm: string): NameHit[] {
    return this.all(
      'SELECT DISTINCT name, kind, ref, ref_date FROM name_index WHERE norm = ?',
      norm,
    );
  }

  findNamesByVariant(variant: string): NameHit[] {
    return this.all(
      'SELECT DISTINCT name, kind, ref, ref_date FROM name_index WHERE variant = ?',
      variant,
    );
  }

  allVariants() {
    this.variantsCache ??= this.all(
      'SELECT DISTINCT variant, name, kind, ref, ref_date FROM name_index',
    );
    return this.variantsCache;
  }

  getComune(istatCode: string): Comune | undefined {
    return this.all<Comune>('SELECT * FROM comuni WHERE istat_code = ?', istatCode)[0];
  }

  eventsOf(codes: string[]): ComuneEvent[] {
    if (!codes.length) return [];
    const marks = codes.map(() => '?').join(',');
    return this.all(
      `SELECT * FROM comune_events WHERE code IN (${marks}) ORDER BY event_date, report, rowid`,
      ...codes,
    );
  }

  eventsRelatedTo(codes: string[]): ComuneEvent[] {
    if (!codes.length) return [];
    const marks = codes.map(() => '?').join(',');
    return this.all(
      `SELECT * FROM comune_events WHERE rel_code IN (${marks}) ORDER BY event_date, report, rowid`,
      ...codes,
    );
  }

  provinceEvents(code: string): ProvinceEvent[] {
    return this.all(
      'SELECT * FROM province_events WHERE code = ? OR rel_code = ? ORDER BY event_date',
      code,
      code,
    );
  }

  currentProvinceName(code: string): string | undefined {
    return this.all<{ province_name: string }>(
      'SELECT province_name FROM comuni WHERE province_code = ? LIMIT 1',
      code,
    )[0]?.province_name;
  }

  aliasesByNorm(norm: string): Alias[] {
    return this.all<Omit<Alias, 'verified'> & { verified: number }>('SELECT * FROM aliases')
      .filter((a) => normalizeName(a.alias) === norm)
      .map((a) => ({ ...a, verified: a.verified === 1 }));
  }

  localitiesByNorm(norm: string): Locality[] {
    return this.all(
      'SELECT loc_id, name, type, istat_code FROM localities WHERE norm = ? ORDER BY istat_code',
      norm,
    );
  }

  comuneContact(istatCode: string): ComuneContact | undefined {
    const r = this.all<Omit<ComuneContact, 'pec'> & { pec: string }>(
      'SELECT * FROM comune_contacts WHERE istat_code = ?',
      istatCode,
    )[0];
    return r ? { ...r, pec: JSON.parse(r.pec) as string[] } : undefined;
  }

  comuneOffices(istatCode: string): ComuneOffice[] {
    return this.all<Omit<ComuneOffice, 'emails'> & { emails: string }>(
      'SELECT * FROM comune_offices WHERE istat_code = ? ORDER BY name',
      istatCode,
    ).map((r) => ({ ...r, emails: JSON.parse(r.emails) as ComuneOffice['emails'] }));
  }

  stateOffice(aooCode: string): StateOffice | undefined {
    const r = this.all<Omit<StateOffice, 'pec'> & { pec: string }>(
      'SELECT * FROM state_offices WHERE aoo_code = ?',
      aooCode,
    )[0];
    return r ? { ...r, pec: JSON.parse(r.pec) as string[] } : undefined;
  }

  archiveForProvince(abbr: string): ArchiveMapping | undefined {
    const r = this.all<Omit<ArchiveMapping, 'verified'> & { verified: number }>(
      'SELECT * FROM archive_map WHERE province_abbr = ?',
      abbr,
    )[0];
    return r ? { ...r, verified: r.verified === 1 } : undefined;
  }

  pointer(officeType: string): unknown {
    const r = this.all<{ data: string }>(
      'SELECT data FROM pointers WHERE office_type = ?',
      officeType,
    )[0];
    return r ? (JSON.parse(r.data) as unknown) : undefined;
  }

  sourceDate(id: string): string | undefined {
    return this.all<{ downloaded_at: string }>(
      'SELECT downloaded_at FROM sources WHERE id = ?',
      id,
    )[0]?.downloaded_at;
  }

  sources(): SourceInfo[] {
    return this.all(
      'SELECT id, title, page_url, route, sha256, downloaded_at, licence, licence_url FROM sources ORDER BY id',
    );
  }

  refreshedAt(): string {
    const row = this.db.prepare("SELECT value FROM meta WHERE key = 'refreshed_at'").get() as
      { value: string } | undefined;
    return row?.value ?? 'unknown';
  }

  close(): void {
    this.db.close();
  }
}
