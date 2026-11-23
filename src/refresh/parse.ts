import type { Comune, ComuneEvent, Locality, ProvinceEvent } from '../data/store.js';
import type { SituasReportDef, SourceDef } from './sources.js';

export class SchemaChangedError extends Error {
  readonly code = 'schema_changed';
}

const clean = (v: unknown): string =>
  v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim();

/** Throws SchemaChangedError unless `header` matches the source's expected columns exactly. */
export function checkHeader(source: SourceDef, header: unknown[]): void {
  const got = header.map(clean);
  const want = source.expected_header.map(clean);
  const same = got.length === want.length && got.every((h, i) => h === want[i]);
  if (!same) {
    const missing = want.filter((h) => !got.includes(h));
    const added = got.filter((h) => !want.includes(h));
    throw new SchemaChangedError(
      `Columns changed in ${source.id} (${source.download_url}).\n` +
        `  missing: ${JSON.stringify(missing)}\n  new: ${JSON.stringify(added)}\n` +
        `  order or names differ: ${!missing.length && !added.length}\n` +
        'Review the file, then update expected_header in src/refresh/sources.ts.',
    );
  }
}

function requireCode(value: string, len: number, what: string, row: number): string {
  if (!new RegExp(`^\\d{${len}}$`).test(value)) {
    throw new SchemaChangedError(`Row ${row}: ${what} "${value}" is not ${len} digits.`);
  }
  return value;
}

export function parseIstatComuni(source: SourceDef, rows: unknown[][]): Comune[] {
  const [header, ...data] = rows;
  checkHeader(source, header ?? []);
  return data
    .filter((r) => r.some((v) => clean(v) !== ''))
    .map((r, i) => {
      const c = r.map(clean);
      return {
        region_code: requireCode(c[0]!, 2, 'region code', i + 2),
        province_code: requireCode(c[2]!, 3, 'province code', i + 2),
        istat_code: requireCode(c[4]!, 6, 'comune code', i + 2),
        name: c[5]!,
        name_it: c[6]!,
        name_other: c[7] || null,
        region_name: c[10]!,
        province_name: c[11]!,
        province_abbr: c[14]!,
        cadastral_code: c[20]!,
      };
    });
}

/** SITUAS dates: ISO 8601 from the JSON service, dd/mm/yyyy from the website CSV export. */
export function situasDate(value: string, where: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const it = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (it) return `${it[3]}-${it[2]}-${it[1]}`;
  throw new SchemaChangedError(`${where}: date "${value}" is neither ISO 8601 nor dd/mm/yyyy.`);
}

export type SituasRow = Record<string, string>;

/** Checks the published column list (from the metadata service) against the expected one. */
export function checkSituasMetadata(def: SituasReportDef, metadata: unknown): void {
  const cols = (metadata as { COL_DETAILS?: { COLNAME?: string }[] })?.COL_DETAILS;
  if (!Array.isArray(cols)) {
    throw new SchemaChangedError(`SITUAS report ${def.report_id}: metadata has no COL_DETAILS.`);
  }
  const got = cols.map((c) => String(c.COLNAME));
  const want = def.columns.map(([code]) => code);
  if (got.join('|') !== want.join('|')) {
    throw new SchemaChangedError(
      `Columns changed in SITUAS report ${def.report_id} (${def.title}).\n` +
        `  expected: ${JSON.stringify(want)}\n  published: ${JSON.stringify(got)}\n` +
        'Review the report metadata, then update SITUAS_REPORTS in src/refresh/sources.ts.',
    );
  }
}

/** Rows from the JSON service. Empty fields are omitted by the service, so only unknown keys fail. */
export function situasRowsFromJson(def: SituasReportDef, json: unknown): SituasRow[] {
  const rows = (json as { resultset?: unknown })?.resultset;
  if (!Array.isArray(rows)) {
    throw new SchemaChangedError(`SITUAS report ${def.report_id}: response has no resultset.`);
  }
  const known = new Set(def.columns.map(([code]) => code));
  return rows.map((r, i) => {
    const out: SituasRow = {};
    for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
      if (!known.has(k)) {
        throw new SchemaChangedError(
          `SITUAS report ${def.report_id}, row ${i + 1}: unknown column "${k}".`,
        );
      }
      out[k] = clean(v);
    }
    return out;
  });
}

/** Rows from a CSV exported by hand from the SITUAS website (labels, matched by position). */
export function situasRowsFromCsv(def: SituasReportDef, rows: string[][]): SituasRow[] {
  const [header, ...data] = rows;
  checkHeader(
    {
      id: def.id,
      title: def.title,
      page_url: '',
      download_url: 'manual CSV',
      expected_header: def.columns.map(([, label]) => label),
    },
    header ?? [],
  );
  return data.map((r) => {
    const out: SituasRow = {};
    def.columns.forEach(([code], i) => {
      const v = clean(r[i]);
      if (v !== '') out[code] = v;
    });
    return out;
  });
}

const opt = (v: string | undefined) => (v ? v : null);

export function toComuneEvents(def: SituasReportDef, rows: SituasRow[]): ComuneEvent[] {
  return rows.map((r, i) => {
    const where = `SITUAS report ${def.report_id}, row ${i + 1}`;
    const code = r.PRO_COM_T ?? '';
    if (!/^\d{6}$/.test(code))
      throw new SchemaChangedError(`${where}: comune code "${code}" is not 6 digits.`);
    const type = def.report_id === 104 ? 'CD' : (r.COD_VARIAZIONE ?? r.COD_VARIAZIONE_M ?? '');
    if (!type) throw new SchemaChangedError(`${where}: no variation type.`);
    return {
      report: def.report_id,
      type,
      event_date: situasDate(r.DATA_INIZIO_AMMINISTRATIVA ?? '', where),
      code,
      name: r.COMUNE ?? '',
      name_other: opt(r.COMUNE_A),
      province_abbr: opt(r.SIGLA_UTS),
      province_code: opt(r.COD_UTS),
      rel_code: opt(r.PRO_COM_T_REL),
      rel_name: opt(r.COMUNE_REL),
      rel_province_abbr: opt(r.SIGLA_UTS_REL),
      rel_province_code: opt(r.COD_UTS_REL),
      flag: opt(r.FLAG_ES_SCORPORO ?? r.FLAG_CAMBIO_REGIONE),
    };
  });
}

export function toProvinceEvents(def: SituasReportDef, rows: SituasRow[]): ProvinceEvent[] {
  return rows.map((r, i) => {
    const where = `SITUAS report ${def.report_id}, row ${i + 1}`;
    return {
      report: def.report_id,
      type: def.report_id === 114 ? 'CD' : (r.COD_VARIAZIONE ?? ''),
      event_date: situasDate(r.DATA_INIZIO_AMMINISTRATIVA ?? '', where),
      code: r.COD_UTS ?? '',
      name: r.DEN_UTS ?? '',
      abbr: opt(r.SIGLA_UTS),
      rel_code: opt(r.COD_UTS_REL),
      rel_name: opt(r.DEN_UTS_REL),
      rel_abbr: opt(r.SIGLA_UTS_REL),
    };
  });
}

/**
 * Inhabited named places from the 2021 census file: centri and nuclei abitati, excluding each
 * comune's main centre (CENTRO_CL = 1), which is the comune itself.
 */
export function parseLocalita(
  def: {
    id: string;
    title: string;
    page_url: string;
    download_url: string;
    expected_header: readonly string[];
  },
  rows: string[][],
): Locality[] {
  const [header, ...data] = rows;
  checkHeader({ ...def, expected_header: [...def.expected_header] }, header ?? []);
  const out: Locality[] = [];
  data.forEach((r, i) => {
    const c = r.map(clean);
    const type = c[5];
    if (type !== '1' && type !== '2') return;
    if (c[7] === '1') return;
    const proCom = c[2]!;
    if (!/^\d{4,6}$/.test(proCom)) {
      throw new SchemaChangedError(`Locality row ${i + 2}: PRO_COM "${proCom}" is not numeric.`);
    }
    if (!c[6]) return;
    out.push({
      loc_id: c[3]!,
      name: c[6],
      type: type === '1' ? 1 : 2,
      istat_code: proCom.padStart(6, '0'),
    });
  });
  return out;
}
