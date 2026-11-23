import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RULES_DIR, SERIES_DIR } from '../../src/config.js';
import { SqliteStore } from '../../src/data/sqlite-store.js';
import { whichRecordsExist } from '../../src/resolve/records.js';
import { matchRules, type PlaceFacts } from '../../src/rules/engine.js';
import { loadRules, RulesError } from '../../src/rules/loader.js';
import type { EventType, Rule } from '../../src/rules/schema.js';
import { loadSeries } from '../../src/rules/series.js';
import { buildFixtureDb } from '../helpers/build-fixture-db.js';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const rules = loadRules(RULES_DIR);

/** Facts for a place, as placeAt would give them. */
const place = (p: Partial<PlaceFacts> & { region_today: string }): PlaceFacts => ({
  istat_code_today: '000000',
  status: {},
  name_at: null,
  province_at: null,
  first_province: null,
  joined_italy: null,
  province_today: 'XX',
  ...p,
});
const best = (p: PlaceFacts, year: number, event: EventType = 'birth') =>
  matchRules(rules, p, year, event)[0]?.rule;

describe('rule files', () => {
  it('all load, each with a source URL and a verified flag', () => {
    expect(rules.length).toBeGreaterThan(15);
    for (const r of rules) {
      expect(r.source_url).toMatch(/^https:\/\//);
      expect(typeof r.verified).toBe('boolean');
    }
  });
  it('reject a rule file with a missing source_url', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ian-rules-'));
    writeFileSync(
      join(dir, 'bad.yaml'),
      'version: 1\nstate: X\nstate_en: X\nrules:\n  - id: x\n    title: X\n    territory: { national: true }\n    period: { from: 1866-01-01, to: 9999-12-31 }\n    events: [birth]\n    regime: italian_civil\n    records: [{ it: a, en: b }]\n    holders: [{ what: { it: a, en: b }, office_type: stato_civile }]\n    fallbacks: []\n    verified: false\n    reviewed_for: []\n',
    );
    expect(() => loadRules(dir)).toThrow(RulesError);
  });
});

describe('section 6 rules, one case per row', () => {
  it('1806–1815 Napoleonic: Lazio 1812, Marche 1810, Kingdom of Naples 1810', () => {
    expect(best(place({ region_today: 'Lazio', joined_italy: '1871-01-15' }), 1812)?.regime).toBe(
      'napoleonic',
    );
    expect(best(place({ region_today: 'Marche', first_province: 'AN' }), 1810)?.regime).toBe(
      'napoleonic',
    );
    expect(best(place({ region_today: 'Campania', first_province: 'NA' }), 1810)?.id).toBe(
      'nap-regno-napoli-1809-1815',
    );
  });
  it('1816–1865 Two Sicilies (Sicily from 1820) and Modena', () => {
    expect(best(place({ region_today: 'Lazio', first_province: 'CE' }), 1840)?.id).toBe(
      'rest-due-sicilie-continente-1816-1865',
    );
    expect(best(place({ region_today: 'Sicilia', first_province: 'PA' }), 1825)?.id).toBe(
      'rest-sicilia-1820-1865',
    );
    expect(best(place({ region_today: 'Sicilia', first_province: 'PA' }), 1818)?.id).not.toBe(
      'rest-sicilia-1820-1865',
    );
    expect(best(place({ region_today: 'Emilia-Romagna', first_province: 'MO' }), 1840)?.id).toBe(
      'rest-modena-reggio-1815-1865',
    );
  });
  it('Tuscany 1808–1814 Napoleonic registers at the State Archive of Florence: verified', () => {
    const r = best(place({ region_today: 'Toscana', first_province: 'FI' }), 1810)!;
    expect(r).toMatchObject({ id: 'nap-toscana-1808-1814', verified: true });
    expect(r.source_url).toMatch(/archiviodistatofirenze/);
  });

  it('1817–1865 Tuscany: state registers compiled from parish records', () => {
    const r = best(place({ region_today: 'Toscana', first_province: 'FI' }), 1840);
    expect(r?.regime).toBe('tuscan_civil');
  });
  it('1837–1865 Kingdom of Sardinia: parish-based', () => {
    expect(best(place({ region_today: 'Piemonte', first_province: 'TO' }), 1850)?.regime).toBe(
      'parish_civil',
    );
  });
  it('1814–1870 Papal States: Lazio until 1870, Umbria and Marche until 1860', () => {
    expect(best(place({ region_today: 'Lazio', joined_italy: '1871-01-15' }), 1850)?.regime).toBe(
      'parish_only',
    );
    expect(best(place({ region_today: 'Umbria', first_province: 'PG' }), 1850)?.regime).toBe(
      'parish_only',
    );
    expect(best(place({ region_today: 'Lazio', first_province: 'PG' }), 1850)?.id).toBe(
      'papa-umbria-1814-1860',
    );
    expect(best(place({ region_today: 'Marche', first_province: 'AP' }), 1855)?.regime).toBe(
      'parish_only',
    );
  });
  it('1814–1815: Lazio and Umbria papal from 13 May 1814 (verified); the Marche under Murat until 1815', () => {
    const lazio = place({ region_today: 'Lazio', joined_italy: '1871-01-15' });
    expect(best(lazio, 1814)).toMatchObject({ id: 'papa-lazio-1814-1870', verified: true });
    expect(best(place({ region_today: 'Umbria', first_province: 'PG' }), 1840)).toMatchObject({
      id: 'papa-umbria-1814-1860',
      verified: true,
    });
    const marche = place({ region_today: 'Marche', first_province: 'MC' });
    expect(best(marche, 1815)).toMatchObject({
      id: 'marche-governo-napoletano-1814-1815',
      verified: false,
    });
    expect(best(marche, 1840)).toMatchObject({ id: 'papa-marche-1816-1860', verified: false });
  });
  it('from 1866 Italian civil registration, two originals, allegati only in the Tribunale series', () => {
    const r = best(place({ region_today: 'Puglia', first_province: 'BA' }), 1900)!;
    expect(r.id).toBe('it-civile-1866');
    expect(r.holders.map((h) => h.office_type)).toEqual([
      'stato_civile',
      'archivio_di_stato',
      'archivio_di_stato',
    ]);
    expect(r.holders[2]!.what.en).toMatch(/only in the Tribunale series/);
  });
  it('Rome and Lazio: Italian civil registration from 1871', () => {
    const lazio = place({ region_today: 'Lazio', joined_italy: '1871-01-15' });
    expect(best(lazio, 1870)?.regime).toBe('parish_only');
    expect(best(lazio, 1871)?.regime).toBe('italian_civil');
  });
  it('Veneto and Mantua: unverified, with both dates', () => {
    const r = best(place({ region_today: 'Veneto', joined_italy: '1866-11-20' }), 1868)!;
    expect(r.id).toBe('it-veneto-mantova-transizione');
    expect(r.verified).toBe(false);
    expect(r.notes!.join(' ')).toMatch(/1866.*1871/);
  });
  it('Trentino–Alto Adige: parish registers before annexation, Italian after', () => {
    const tn = place({ region_today: 'Trentino-Alto Adige/Südtirol', joined_italy: '1920-10-16' });
    expect(best(tn, 1900)?.regime).toBe('foreign_parish');
    expect(best(tn, 1930)?.regime).toBe('italian_civil');
  });
  it('Military: provincial State Archive for older classes, Army offices later, Defence for officers', () => {
    const r = best(place({ region_today: 'Lazio' }), 1890, 'military')!;
    expect(r.holders.map((h) => h.office_type)).toEqual([
      'archivio_di_stato',
      'ufficio_documentale_militare',
      'ministero_difesa',
    ]);
    expect(r.notes!.join(' ')).toMatch(/overrides/);
  });
});

describe('verified overrides from the Guida generale', () => {
  it.each([
    [
      { region_today: 'Umbria', province_today: 'PG', first_province: 'PG' },
      1880,
      'birth',
      'as-perugia-stato-civile-1861-1899',
    ],
    [
      {
        region_today: 'Umbria',
        province_today: 'TR',
        first_province: 'PG',
        istat_code_today: '055032',
      },
      1880,
      'birth',
      'as-terni-stato-civile-1861-1900',
    ],
    [
      {
        region_today: 'Toscana',
        province_today: 'PT',
        first_province: 'FI',
        istat_code_today: '047014',
      },
      1880,
      'birth',
      'as-pistoia-stato-civile-1866-1903',
    ],
    [
      { region_today: 'Toscana', province_today: 'MS', first_province: 'MS' },
      1855,
      'birth',
      'as-massa-stato-civile-1852-1865',
    ],
    [
      { region_today: 'Toscana', province_today: 'LU', first_province: 'LU' },
      1810,
      'birth',
      'as-lucca-stato-civile-principato-1807-1814',
    ],
    [
      { region_today: 'Marche', province_today: 'PU', first_province: 'PU' },
      1863,
      'birth',
      'as-pesaro-parrocchiali-1861-1865',
    ],
    [
      { region_today: 'Lazio', province_today: 'RI', first_province: 'AQ' },
      1840,
      'birth',
      'as-laquila-cittaducale',
    ],
    [
      { region_today: 'Toscana', province_today: 'FI', first_province: 'FI' },
      1900,
      'military',
      'as-firenze-militare',
    ],
    [
      { region_today: 'Lazio', province_today: 'RM', joined_italy: '1871-01-15' },
      1880,
      'military',
      'as-roma-militare',
    ],
    [
      { region_today: 'Marche', province_today: 'AP', first_province: 'AP' },
      1883,
      'military',
      'as-ascoli-piceno-militare',
    ],
    [
      {
        region_today: 'Lazio',
        province_today: 'FR',
        first_province: 'CE',
        istat_code_today: '060056',
      },
      1840,
      'birth',
      'papa-enclave-pontecorvo-1816-1860',
    ],
  ] as const)('%j in %i (%s) → %s, verified', (p, year, event, id) => {
    const r = best(place(p), year, event)!;
    expect(r.id).toBe(id);
    expect(r.verified).toBe(true);
    expect(r.source_url).toMatch(/^https:\/\/archivi\.cultura\.gov\.it\/.*Guida_Generale_A_S/);
  });
  it('Fermo (FM) is not assumed to be in the Ascoli Piceno district', () => {
    expect(
      best(
        place({ region_today: 'Marche', province_today: 'FM', first_province: 'AP' }),
        1883,
        'military',
      )?.id,
    ).toBe('militare-esercito-nazionale');
  });
  it('outside the classes an archive holds, the national military rule applies', () => {
    expect(
      best(place({ region_today: 'Toscana', province_today: 'SI' }), 1925, 'military')?.id,
    ).toBe('militare-esercito-nazionale');
  });
  it('Umbria 1861–1865 civil registration is verified; Marche 1861–1865 parish rule is not (yet)', () => {
    expect(
      best(place({ region_today: 'Lazio', province_today: 'RI', first_province: 'PG' }), 1863),
    ).toMatchObject({ id: 'umbria-stato-civile-1861-1865', verified: true });
    expect(
      best(place({ region_today: 'Marche', province_today: 'AN', first_province: 'AN' }), 1863),
    ).toMatchObject({ id: 'marche-parrocchiali-1861-1865', verified: false });
  });
  it('Duchy of Lucca is not Tuscany before 1848; grand-ducal enclaves in province LU are', () => {
    const lu = (code: string) =>
      place({
        region_today: 'Toscana',
        province_today: 'LU',
        first_province: 'LU',
        istat_code_today: code,
      });
    expect(best(lu('046017'), 1840)).toMatchObject({
      id: 'lucca-ducato-1814-1847',
      verified: false,
    });
    expect(best(lu('046017'), 1855)).toMatchObject({
      id: 'lucca-toscana-1848-1865',
      verified: false,
    });
    expect(best(lu('046003'), 1840)).toMatchObject({
      id: 'toscana-granducato-comuni-lucchesia',
      verified: true,
    });
    expect(best(lu('046024'), 1840)?.id).toBe('toscana-granducato-comuni-lucchesia-probabili');
  });
  it('Fivizzano and Pontremoli were Tuscan until 1847; Pontremoli then Parma', () => {
    const ms = (code: string) =>
      place({
        region_today: 'Toscana',
        province_today: 'MS',
        first_province: 'MS',
        istat_code_today: code,
      });
    expect(best(ms('045007'), 1840)).toMatchObject({
      id: 'toscana-lunigiana-granducale-1814-1847',
      verified: true,
    });
    expect(best(ms('045014'), 1850)?.id).toBe('pontremoli-parma-1848-1859');
  });
  it('Tuscany 1814–1865 is verified from the Guida generale (Firenze)', () => {
    expect(
      best(place({ region_today: 'Toscana', province_today: 'SI', first_province: 'SI' }), 1840),
    ).toMatchObject({ id: 'toscana-stato-civile-1817-1865', verified: true });
  });
});

describe('which_records_exist (fixture database)', () => {
  let store: SqliteStore;
  beforeAll(() => {
    store = new SqliteStore(buildFixtureDb());
  });
  afterAll(() => store.close());
  const run = (input: Parameters<typeof whichRecordsExist>[2]) =>
    whichRecordsExist(
      store,
      rules as Rule[],
      input,
      new Date('2026-11-18'),
      loadSeries(SERIES_DIR),
    ) as Record<string, unknown> & {
      regime?: { code: string } | null;
      rule?: { id: string; verified: boolean; reviewed_for_this_region?: boolean };
      notes: string[];
    };

  it('Lazio comune before and after 1871, with its name then', () => {
    const r1850 = run({ comune: 'Tarquinia', year: 1850, event: 'birth' });
    expect(r1850.regime?.code).toBe('parish_only');
    expect(r1850.comune).toMatchObject({ in_that_year: { joined_kingdom_of_italy: '1871-01-15' } });
    const r1880 = run({ comune: 'Tarquinia', year: 1880, event: 'birth' });
    expect(r1880.regime?.code).toBe('italian_civil');
    expect(r1880.comune).toMatchObject({
      in_that_year: { name: 'Corneto Tarquinia', province: 'RM' },
    });
    // The Tarquinia override says where the second original is; the generic
    // "ask the State Archive of that year's province" hint must not contradict it.
    expect(r1880.notes.join(' ')).not.toMatch(/first place to ask/);
    // Without an override, the hint is given.
    const castro = run({ comune: 'Castro', province: 'LE', year: 1900, event: 'birth' });
    expect(castro.rule?.id).toBe('it-civile-1866');
    expect(castro.notes.join(' ')).toMatch(/province LE.*first place to ask/);
  });

  describe('living-person routing (SPEC §2)', () => {
    it('event less than 100 years ago', () => {
      const r = run({ comune: 'Viterbo', year: 1960, event: 'death' });
      expect(r.routed_to_comune).toBe(true);
      expect(r.access_note).toMatch(/office decides/);
      expect(r).not.toHaveProperty('records');
    });
    it('person born after 1940, even for an older-looking event year', () => {
      expect(
        run({ comune: 'Viterbo', year: 1925, event: 'marriage', person_birth_year: 1945 })
          .routed_to_comune,
      ).toBe(true);
    });
    it('military: the year is the birth class', () => {
      expect(run({ comune: 'Viterbo', year: 1945, event: 'military' }).routed_to_comune).toBe(true);
      expect(run({ comune: 'Viterbo', year: 1900, event: 'military' }).routed_to_comune).toBe(
        false,
      );
    });
    it('100 years exactly is not routed; 99 is', () => {
      expect(run({ comune: 'Viterbo', year: 1926, event: 'birth' }).routed_to_comune).toBe(false);
      expect(run({ comune: 'Viterbo', year: 1927, event: 'birth' }).routed_to_comune).toBe(true);
    });
  });

  it('a region outside the target set gets the national rule, flagged as not reviewed', () => {
    const r = run({ comune: 'Castro', province: 'LE', year: 1900, event: 'birth' });
    expect(r.rule?.id).toBe('it-civile-1866');
    expect(r.rule?.reviewed_for_this_region).toBe(false);
    expect(r.notes.join(' ')).toMatch(/not yet been reviewed for Puglia/);
  });

  describe('verified per-archive overrides (Archivio di Stato di Viterbo)', () => {
    it('Viterbo province 1875–1992: second original from the Tribunale, verified', () => {
      const r = run({ comune: 'Calcata', year: 1880, event: 'birth' });
      expect(r.rule).toMatchObject({ id: 'as-viterbo-stato-civile-1875-1992', verified: true });
      expect(r.notes.join(' ')).not.toMatch(/verified: false/);
    });
    it('year-level coverage: missing, single register, present', () => {
      const status = (comune: string, year: number) =>
        (
          (run({ comune, year, event: 'birth' }).archive_series as
            { status: string }[] | undefined) ?? []
        ).map((a) => a.status);
      expect(status('Calcata', 1887)).toEqual(['missing']);
      expect(status('Calcata', 1880)).toEqual(['present']);
      expect(status('Bagnoregio', 1899)).toEqual(['missing']);
    });
    it('a former comune now inside another shows only its own series (Bagnaja → Viterbo)', () => {
      const a = run({ comune: 'Bagnaja', year: 1887, event: 'birth' }).archive_series as {
        series: string;
        status: string;
      }[];
      expect(a).toEqual([expect.objectContaining({ series: 'Bagnaia', status: 'missing' })]);
    });
    it('1871–1874: not in the State Archive series, ask the Comune', () => {
      expect(run({ comune: 'Calcata', year: 1872, event: 'death' }).rule?.id).toBe(
        'as-viterbo-stato-civile-1871-1874',
      );
    });
    it('Tarquinia: a comune-level override beats the province override', () => {
      expect(run({ comune: 'Tarquinia', year: 1900, event: 'marriage' }).rule?.id).toBe(
        'tribunale-civitavecchia-tarquinia-montalto',
      );
    });
    it('military classes up to 1920 at the State Archive, later ones nationally', () => {
      expect(run({ comune: 'Viterbo', year: 1890, event: 'military' }).rule).toMatchObject({
        id: 'as-viterbo-militare-classi-1876-1920',
        verified: true,
      });
      expect(run({ comune: 'Viterbo', year: 1922, event: 'military' }).rule?.id).toBe(
        'militare-esercito-nazionale',
      );
    });
  });

  it('unverified rules say so', () => {
    expect(run({ comune: 'Tarquinia', year: 1880, event: 'birth' }).notes.join(' ')).toMatch(
      /verified: false/,
    );
  });

  it('before a comune existed, its parent comune is used (Bassano in Teverina, part of Orte 1927–1958)', () => {
    const r = run({ comune: 'Bassano in Teverina', year: 1940, event: 'birth' });
    expect(r.notes.join(' ')).toMatch(/Orte/);
    expect(r.regime?.code).toBe('italian_civil');
  });
});
