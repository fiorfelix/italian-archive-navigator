import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAliases, toAlias } from '../../src/curated/aliases.js';
import { loadOffices } from '../../src/curated/offices.js';
import type { ComuneEvent, ProvinceEvent } from '../../src/data/store.js';
import { buildDatabase } from '../../src/refresh/build.js';
import { parseDelimited } from '../../src/refresh/csv.js';
import {
  parseIstatComuni,
  parseLocalita,
  situasRowsFromJson,
  toComuneEvents,
  toProvinceEvents,
} from '../../src/refresh/parse.js';
import type { JsonGetter } from '../../src/refresh/run.js';
import {
  matchComuneContacts,
  parseComuneContacts,
  parseComuneOffices,
  parseStateOffices,
} from '../../src/refresh/indicepa.js';
import {
  INDICEPA_AOO,
  INDICEPA_ENTI,
  INDICEPA_UO,
  ISTAT_COMUNI,
  ISTAT_LOCALITA,
  SITUAS_REPORTS,
} from '../../src/refresh/sources.js';

export const fx = (name: string) => join(import.meta.dirname, '..', 'fixtures', name);
export const situasFixture = (kind: 'r' | 'm', id: number): unknown =>
  JSON.parse(readFileSync(fx(`situas/${kind}${id}.json`), 'utf8'));

/** Serves the SITUAS fixtures the way the public service would. */
export const fixtureGetter: JsonGetter = async (url) => {
  const id = Number(/pfun=(\d+)/.exec(url)?.[1]);
  let json: unknown;
  if (url.includes('reportspooljsoncount')) {
    const rows = (situasFixture('r', id) as { resultset: unknown[] }).resultset;
    json = { resultset: [{ NUM_ROWS: rows.length }] };
  } else if (url.includes('anagrafica_report_metadato_web')) json = situasFixture('m', id);
  else json = situasFixture('r', id);
  return { bytes: new TextEncoder().encode(JSON.stringify(json)), json };
};

/** Builds a small database from the public-data fixtures and returns its path. */
export function buildFixtureDb(aliasFile = fx('aliases.yaml')): string {
  const path = join(mkdtempSync(join(tmpdir(), 'ian-test-')), 'test.sqlite');
  const rows = JSON.parse(readFileSync(fx('istat_comuni_rows.json'), 'utf8')) as unknown[][];
  const comuni = parseIstatComuni(ISTAT_COMUNI, rows);
  const json = (n: string) => JSON.parse(readFileSync(fx(`indicepa/${n}`), 'utf8')) as unknown[][];
  const comuneEvents: ComuneEvent[] = [];
  const provinceEvents: ProvinceEvent[] = [];
  for (const def of SITUAS_REPORTS) {
    const data = situasRowsFromJson(def, situasFixture('r', def.report_id));
    if (def.level === 'comune') comuneEvents.push(...toComuneEvents(def, data));
    else provinceEvents.push(...toProvinceEvents(def, data));
  }
  buildDatabase(
    path,
    {
      comuni,
      comuneContacts: matchComuneContacts(
        comuni,
        parseComuneContacts(INDICEPA_ENTI, json('enti_rows.json')),
      ),
      comuneOffices: parseComuneOffices(INDICEPA_UO, json('uo_rows.json')),
      stateOffices: parseStateOffices(
        INDICEPA_AOO,
        parseDelimited(readFileSync(fx('indicepa/aoo.txt'), 'utf8'), '\t'),
      ),
      offices: loadOffices(fx('offices.yaml')),
      comuneEvents,
      provinceEvents,
      localities: parseLocalita(
        ISTAT_LOCALITA,
        parseDelimited(readFileSync(fx('localita_2021.tsv'), 'utf8'), '\t'),
      ),
      aliases: loadAliases(aliasFile).map((e) => ({ ...toAlias(e), comune: e.comune })),
      sources: [],
      refreshedAt: '2026-11-18T00:00:00.000Z',
    },
    { minComuni: 1, minEvents: 1 },
  );
  return path;
}
