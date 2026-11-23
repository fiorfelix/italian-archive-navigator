import { renameSync, rmSync } from 'node:fs';
// node:sqlite renamed DatabaseSync to Database (Node 25); @types/node 26.6 only types the old
// name. Both are the same class at runtime (checked on Node 26.13.1).
import { DatabaseSync as Database } from 'node:sqlite';
import { normalizeName, variantKey } from '../data/normalize.js';
import { SCHEMA_SQL, SCHEMA_VERSION } from '../data/schema.js';
import type { OfficesFile } from '../curated/offices.js';
import type {
  Alias,
  Comune,
  ComuneContact,
  ComuneEvent,
  ComuneOffice,
  Locality,
  ProvinceEvent,
  StateOffice,
} from '../data/store.js';

export interface SourceRecord {
  id: string;
  title: string;
  page_url: string;
  download_url: string;
  metadata_url?: string;
  route: 'download' | 'api' | 'manual';
  file_name: string;
  sha256: string;
  rows: number;
  downloaded_at: string;
  licence: string;
  licence_url: string;
}

export interface BuildInput {
  comuni: Comune[];
  comuneEvents: ComuneEvent[];
  provinceEvents: ProvinceEvent[];
  localities: Locality[];
  comuneContacts: ComuneContact[];
  comuneOffices: ComuneOffice[];
  stateOffices: StateOffice[];
  offices: OfficesFile;
  aliases: (Alias & { comune: string })[];
  sources: SourceRecord[];
  refreshedAt: string;
}

export interface BuildReport {
  comuni: number;
  comune_events: number;
  province_events: number;
  localities: number;
  comune_contacts: number;
  comune_offices: number;
  state_offices: number;
  names: number;
  aliases: number;
}

/** Sanity checks that must hold before a database replaces the current one. */
function validate(input: BuildInput, minComuni: number, minEvents: number): string[] {
  const errors: string[] = [];
  if (input.comuni.length < minComuni) {
    errors.push(`Only ${input.comuni.length} comuni parsed; expected about 7,900.`);
  }
  if (input.comuneEvents.length < minEvents) {
    errors.push(`Only ${input.comuneEvents.length} comune events parsed; expected about 21,000.`);
  }
  const byCode = new Map(input.comuni.map((c) => [c.istat_code, c]));
  if (byCode.size !== input.comuni.length) errors.push('Duplicate ISTAT codes in comuni list.');
  for (const a of input.aliases) {
    const c = byCode.get(a.istat_code);
    if (!c) errors.push(`aliases.yaml: "${a.alias}" points to unknown ISTAT code ${a.istat_code}.`);
    else if (normalizeName(c.name_it) !== normalizeName(a.comune)) {
      errors.push(
        `aliases.yaml: "${a.alias}" says comune "${a.comune}" but ${a.istat_code} is "${c.name_it}".`,
      );
    }
  }
  const aoo = new Set(input.stateOffices.map((o) => o.aoo_code));
  for (const a of input.offices.archivi_di_stato) {
    if (a.aoo && !aoo.has(a.aoo)) {
      errors.push(
        `offices.yaml: province ${a.province} points to IndicePA AOO "${a.aoo}", which is not in the data.`,
      );
    }
  }
  for (const [type, p] of Object.entries(input.offices.pointers)) {
    for (const o of p.offices) {
      if (!aoo.has(o))
        errors.push(`offices.yaml: pointer ${type} lists unknown IndicePA AOO "${o}".`);
    }
  }
  if (input.comuni.length >= minComuni) {
    const covered = input.comuneContacts.filter((c) => byCode.has(c.istat_code)).length;
    if (covered < input.comuni.length * 0.95) {
      errors.push(
        `Only ${covered} of ${input.comuni.length} comuni have an IndicePA contact; expected nearly all.`,
      );
    }
  }
  return errors;
}

/** Archivio di Stato per current province: curated entries first, then same-province seat. */
function archiveMap(input: BuildInput) {
  const rows = new Map<
    string,
    { aoo: string | null; basis: string; verified: boolean; note: string | null; source: string }
  >();
  for (const a of input.offices.archivi_di_stato) {
    rows.set(a.province, {
      aoo: a.aoo,
      basis: 'curated',
      verified: a.verified,
      note: a.note ?? null,
      source: a.source_url,
    });
  }
  // Every province with an Archivio di Stato maps to it, even with no comuni in this data.
  const provinces = new Set([
    ...input.comuni.map((c) => c.province_abbr),
    ...input.stateOffices
      .filter((o) => o.kind === 'archivio_di_stato')
      .map((o) => o.province_abbr ?? ''),
  ]);
  for (const abbr of provinces) {
    if (!abbr) continue;
    const c = { province_abbr: abbr };
    if (rows.has(c.province_abbr)) continue;
    const seat = input.stateOffices.find(
      (o) => o.kind === 'archivio_di_stato' && o.province_abbr === c.province_abbr,
    );
    rows.set(c.province_abbr, {
      aoo: seat?.aoo_code ?? null,
      basis: 'same_province',
      verified: !!seat,
      note: seat ? null : 'No Archivio di Stato found in this province.',
      source: 'https://indicepa.gov.it/ipa-dati/dataset/aoo',
    });
  }
  return rows;
}

/** Every name a comune has carried, with the code it had at the time. */
/** Reference dates: today, and the 2021 census (localities carry their 2021 comune code). */
const TODAY = '9999-12-31';
const CENSUS_2021 = '2021-12-31';

type DatedName = { name: string; code: string; date: string };

/** The day before an ISO date (names and codes recorded "before the event" held until then). */
export function dayBefore(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function historicalNames(events: ComuneEvent[]): DatedName[] {
  const out: DatedName[] = [];
  for (const e of events) {
    if (e.report === 103) continue; // boundary changes repeat names already listed elsewhere
    // A created comune (report 100) holds its name from the event date; in the other reports
    // the name and code are those in force until the day before the event.
    const date = e.report === 100 ? e.event_date : dayBefore(e.event_date);
    out.push({ name: e.name, code: e.code, date });
    if (e.name_other) out.push({ name: e.name_other, code: e.code, date });
    // Renames (104) and code changes (105) carry the new name and code in rel_*.
    if ((e.report === 104 || e.report === 105) && e.rel_name && e.rel_code) {
      out.push({ name: e.rel_name, code: e.rel_code, date: e.event_date });
    }
  }
  // Bilingual names are published as "Italiano/Deutsch"; index each half too.
  const split = out.flatMap((n) =>
    n.name.includes('/') ? n.name.split('/').map((p) => ({ ...n, name: p.trim() })) : [],
  );
  return [...out, ...split];
}

/**
 * Writes a complete database to a temporary file and swaps it in only when everything
 * succeeded, so a failed refresh always leaves the previous database in place.
 */
export function buildDatabase(
  path: string,
  input: BuildInput,
  options: { minComuni?: number; minEvents?: number } = {},
): BuildReport {
  const errors = validate(input, options.minComuni ?? 7000, options.minEvents ?? 15000);
  if (errors.length) throw new Error(`Validation failed:\n  - ${errors.join('\n  - ')}`);

  const tmp = `${path}.tmp-${process.pid}`;
  rmSync(tmp, { force: true });
  const db = new Database(tmp);
  let names = 0;
  try {
    db.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;');
    db.exec(SCHEMA_SQL);
    db.exec('BEGIN');
    const meta = db.prepare('INSERT INTO meta VALUES (?, ?)');
    meta.run('schema_version', String(SCHEMA_VERSION));
    meta.run('refreshed_at', input.refreshedAt);

    const src = db.prepare('INSERT INTO sources VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    for (const s of input.sources) {
      src.run(
        s.id,
        s.title,
        s.page_url,
        s.download_url,
        s.metadata_url ?? null,
        s.route,
        s.file_name,
        s.sha256,
        s.rows,
        s.downloaded_at,
        s.licence,
        s.licence_url,
      );
    }

    const seen = new Set<string>();
    const nameRow = db.prepare('INSERT INTO name_index VALUES (?,?,?,?,?,?)');
    const index = (name: string, kind: string, ref: string, date = TODAY) => {
      const key = `${name}|${kind}|${ref}|${date}`;
      if (!name || seen.has(key)) return;
      seen.add(key);
      nameRow.run(name, normalizeName(name), variantKey(name), kind, ref, date);
      names++;
    };

    const com = db.prepare('INSERT INTO comuni VALUES (?,?,?,?,?,?,?,?,?,?)');
    for (const c of input.comuni) {
      com.run(
        c.istat_code,
        c.name,
        c.name_it,
        c.name_other,
        c.cadastral_code,
        c.province_code,
        c.province_abbr,
        c.province_name,
        c.region_code,
        c.region_name,
      );
      index(c.name_it, 'current', c.istat_code);
      if (c.name !== c.name_it) index(c.name, 'current', c.istat_code);
      if (c.name_other) index(c.name_other, 'current_other_language', c.istat_code);
    }

    const ev = db.prepare('INSERT INTO comune_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    for (const e of input.comuneEvents) {
      ev.run(
        e.report,
        e.type,
        e.event_date,
        e.code,
        e.name,
        e.name_other,
        e.province_abbr,
        e.province_code,
        e.rel_code,
        e.rel_name,
        e.rel_province_abbr,
        e.rel_province_code,
        e.flag,
      );
    }
    const current = new Map(input.comuni.map((c) => [c.istat_code, c]));
    for (const n of historicalNames(input.comuneEvents)) {
      // A current comune's own current name is already indexed as 'current'.
      const c = current.get(n.code);
      if (c && [c.name, c.name_it, c.name_other].includes(n.name)) continue;
      index(n.name, 'historical', n.code, n.date);
    }

    const pev = db.prepare('INSERT INTO province_events VALUES (?,?,?,?,?,?,?,?,?)');
    for (const p of input.provinceEvents) {
      pev.run(
        p.report,
        p.type,
        p.event_date,
        p.code,
        p.name,
        p.abbr,
        p.rel_code,
        p.rel_name,
        p.rel_abbr,
      );
    }

    const loc = db.prepare('INSERT INTO localities VALUES (?,?,?,?,?)');
    for (const l of input.localities) {
      loc.run(l.loc_id, l.name, normalizeName(l.name), l.type, l.istat_code);
      index(l.name, 'locality', l.istat_code, CENSUS_2021);
    }

    const cc = db.prepare('INSERT INTO comune_contacts VALUES (?,?,?,?,?,?,?,?)');
    for (const c of input.comuneContacts) {
      cc.run(
        c.istat_code,
        c.ipa_code,
        c.name,
        c.address,
        c.cap,
        JSON.stringify(c.pec),
        c.website,
        c.updated,
      );
    }
    const co = db.prepare('INSERT INTO comune_offices VALUES (?,?,?,?,?,?,?)');
    for (const o of input.comuneOffices) {
      co.run(
        o.istat_code,
        o.uo_code,
        o.name,
        o.address,
        o.cap,
        JSON.stringify(o.emails),
        o.updated,
      );
    }
    const so = db.prepare('INSERT INTO state_offices VALUES (?,?,?,?,?,?,?,?)');
    for (const o of input.stateOffices) {
      so.run(
        o.aoo_code,
        o.kind,
        o.name,
        o.address,
        o.cap,
        o.comune,
        o.province_abbr,
        JSON.stringify(o.pec),
      );
    }
    const am = db.prepare('INSERT INTO archive_map VALUES (?,?,?,?,?,?)');
    for (const [p, a] of archiveMap(input))
      am.run(p, a.aoo, a.basis, a.verified ? 1 : 0, a.note, a.source);
    const pt = db.prepare('INSERT INTO pointers VALUES (?,?)');
    for (const [type, p] of Object.entries(input.offices.pointers)) pt.run(type, JSON.stringify(p));

    const ali = db.prepare('INSERT INTO aliases VALUES (?,?,?,?,?,?)');
    for (const a of input.aliases) {
      ali.run(a.alias, a.kind, a.istat_code, a.note, a.source_url, a.verified ? 1 : 0);
      index(a.alias, 'alias', a.istat_code);
    }
    db.exec('COMMIT');
    db.close();
  } catch (err) {
    if (db.isOpen) db.close();
    rmSync(tmp, { force: true });
    throw err;
  }

  // rename() replaces the old file atomically on POSIX; a running server keeps reading
  // the old file until it reopens the database.
  renameSync(tmp, path);

  return {
    comuni: input.comuni.length,
    comune_events: input.comuneEvents.length,
    province_events: input.provinceEvents.length,
    localities: input.localities.length,
    comune_contacts: input.comuneContacts.length,
    comune_offices: input.comuneOffices.length,
    state_offices: input.stateOffices.length,
    names,
    aliases: input.aliases.length,
  };
}
