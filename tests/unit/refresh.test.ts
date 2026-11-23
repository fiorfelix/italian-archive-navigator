import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SqliteStore } from '../../src/data/sqlite-store.js';
import { buildDatabase } from '../../src/refresh/build.js';
import { parseDelimited } from '../../src/refresh/csv.js';
import {
  checkHeader,
  checkSituasMetadata,
  SchemaChangedError,
  situasDate,
  situasRowsFromCsv,
  situasRowsFromJson,
  toComuneEvents,
} from '../../src/refresh/parse.js';
import { manualInstructions, obtainSituas, type JsonGetter } from '../../src/refresh/run.js';
import { ISTAT_COMUNI, SITUAS_REPORTS } from '../../src/refresh/sources.js';
import { buildFixtureDb, fixtureGetter, fx, situasFixture } from '../helpers/build-fixture-db.js';

const r104 = SITUAS_REPORTS.find((r) => r.report_id === 104)!;
const r103 = SITUAS_REPORTS.find((r) => r.report_id === 103)!;
const emptyDir = () => mkdtempSync(join(tmpdir(), 'ian-manual-'));

/** Writes fixture rows as the website CSV export would (labels, dd/mm/yyyy dates). */
function writeManualCsv(dir: string, fileName: string, id: number) {
  const def = SITUAS_REPORTS.find((r) => r.report_id === id)!;
  const rows = (situasFixture('r', id) as { resultset: Record<string, string>[] }).resultset;
  const it = (v: string) => v.replace(/^(\d{4})-(\d{2})-(\d{2})T.*$/, '$3/$2/$1');
  const lines = [
    def.columns.map(([, l]) => l).join(';'),
    ...rows.map((r) => def.columns.map(([c]) => it(r[c] ?? '')).join(';')),
  ];
  writeFileSync(join(dir, fileName), '﻿' + lines.join('\r\n') + '\r\n');
}

describe('parsers', () => {
  it('delimited text: BOM, CRLF, quotes', () => {
    expect(parseDelimited('﻿a;b\r\n"x;1";"say ""hi"""\r\n')).toEqual([
      ['a', 'b'],
      ['x;1', 'say "hi"'],
    ]);
  });
  it('SITUAS dates in both published formats', () => {
    expect(situasDate('1922-06-10T00:00:00Z', 'x')).toBe('1922-06-10');
    expect(situasDate('10/06/1922', 'x')).toBe('1922-06-10');
    expect(() => situasDate('June 1922', 'x')).toThrow(SchemaChangedError);
  });
  it('ISTAT header accepted as published', () => {
    const rows = JSON.parse(readFileSync(fx('istat_comuni_rows.json'), 'utf8')) as unknown[][];
    expect(() => checkHeader(ISTAT_COMUNI, rows[0]!)).not.toThrow();
  });
});

describe('column checks (fail loudly on change)', () => {
  it('accepts the published SITUAS metadata', () => {
    for (const def of SITUAS_REPORTS) {
      expect(() => checkSituasMetadata(def, situasFixture('m', def.report_id))).not.toThrow();
    }
  });
  it('rejects SITUAS metadata with a changed column list', () => {
    const m = situasFixture('m', 104) as { COL_DETAILS: { COLNAME: string }[] };
    m.COL_DETAILS[4]!.COLNAME = 'DENOMINAZIONE';
    expect(() => checkSituasMetadata(r104, m)).toThrow(/Columns changed in SITUAS report 104/);
  });
  it('rejects SITUAS data with an unknown column', () => {
    expect(() =>
      situasRowsFromJson(r104, { resultset: [{ PRO_COM_T: '000001', NUOVA: 'x' }] }),
    ).toThrow(/unknown column "NUOVA"/);
  });
  it('reads a manual CSV by position, even with duplicate labels (report 103)', () => {
    const dir = emptyDir();
    writeManualCsv(dir, 'x.csv', 103);
    const rows = situasRowsFromCsv(r103, parseDelimited(readFileSync(join(dir, 'x.csv'), 'utf8')));
    expect(rows[0]).toHaveProperty('PRO_COM_T');
    expect(rows[0]).toHaveProperty('PRO_COM_T_REL');
  });
});

describe('database build', () => {
  it('keeps the previous database when a build fails', () => {
    const path = buildFixtureDb();
    const before = readFileSync(path);
    expect(() =>
      buildDatabase(path, {
        comuni: [],
        comuneEvents: [],
        provinceEvents: [],
        localities: [],
        comuneContacts: [],
        comuneOffices: [],
        stateOffices: [],
        offices: { version: 1, archivi_di_stato: [], pointers: {} as never },
        aliases: [],
        sources: [],
        refreshedAt: 'x',
      }),
    ).toThrow(/Only 0 comuni/);
    expect(readFileSync(path).equals(before)).toBe(true);
  });
  it('rejects an alias whose comune name does not match the ISTAT code', () => {
    const bad = join(emptyDir(), 'aliases.yaml');
    writeFileSync(
      bad,
      "version: 1\naliases:\n  - {alias: X, kind: frazione, istat_code: '056010', comune: Viterbo, source_url: 'https://example.org', verified: false}\n",
    );
    expect(() => buildFixtureDb(bad)).toThrow(/says comune "Viterbo" but 056010 is "Calcata"/);
  });
  it('gives an actionable error when the database is missing', () => {
    expect(() => new SqliteStore('/nonexistent/x.sqlite')).toThrow(/npm run refresh-data/);
  });
});

describe('SITUAS: documented service first, manual CSV as fallback', () => {
  const down: JsonGetter = async () => {
    throw new Error('HTTP 503');
  };

  it('uses the service when metadata, data and count all check out', async () => {
    const r = await obtainSituas(r104, fixtureGetter, emptyDir());
    expect('route' in r && r.route).toBe('api');
    expect('rows' in r && r.rows.length).toBeGreaterThan(0);
  });
  it('treats a row-count mismatch as a failure', async () => {
    const wrongCount: JsonGetter = async (url) =>
      url.includes('count')
        ? { bytes: new Uint8Array(), json: { resultset: [{ NUM_ROWS: 1 }] } }
        : fixtureGetter(url);
    const r = await obtainSituas(r104, wrongCount, emptyDir());
    expect('failure' in r && r.failure).toMatch(/differs from the published count/);
  });
  it('falls back to a manual CSV when the service is down', async () => {
    const dir = emptyDir();
    writeManualCsv(dir, 'Comuni con cambio denominazione Periodo 17-03-1861 18-11-2026.csv', 104);
    const r = await obtainSituas(r104, down, dir);
    expect('route' in r && r.route).toBe('manual');
    expect('warning' in r && r.warning).toMatch(/HTTP 503/);
    const viaApi = await obtainSituas(r104, fixtureGetter, emptyDir());
    if (!('rows' in r) || !('rows' in viaApi)) throw new Error('expected rows');
    expect(toComuneEvents(r104, r.rows)).toEqual(toComuneEvents(r104, viaApi.rows));
  });
  it('also accepts a manual file named situas_<id>.csv', async () => {
    const dir = emptyDir();
    writeManualCsv(dir, 'situas_104.csv', 104);
    const r = await obtainSituas(r104, down, dir);
    expect('route' in r && r.route).toBe('manual');
  });
  it('asks the user to export by hand when there is no manual file', async () => {
    const dir = emptyDir();
    const r = await obtainSituas(r104, down, dir);
    expect('failure' in r).toBe(true);
    const msg = manualInstructions([{ def: r104, reason: 'x' }], dir);
    expect(msg).toContain('MANUAL DOWNLOAD NEEDED');
    expect(msg).toContain('situas_104.csv');
  });
});
