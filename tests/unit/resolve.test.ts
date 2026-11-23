import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SqliteStore } from '../../src/data/sqlite-store.js';
import { resolveComuneHistory } from '../../src/resolve/comune-history.js';
import { buildFixtureDb } from '../helpers/build-fixture-db.js';

let store: SqliteStore;
beforeAll(() => {
  store = new SqliteStore(buildFixtureDb());
});
afterAll(() => store.close());

type Match = {
  match: string;
  matched_name: string;
  current_comuni: { istat_code: string; name: string; province: string }[];
  at_year?: Record<string, unknown>;
  timeline?: Record<string, unknown>[];
  [k: string]: unknown;
};
const run = (name: string, extra: { province?: string; year?: number } = {}) => {
  const r = resolveComuneHistory(store, { name, ...extra });
  return { ...r, matches: r.matches as Match[] };
};
const first = (name: string, extra: { province?: string; year?: number } = {}) =>
  run(name, extra).matches[0]!;

describe('resolve_comune_history', () => {
  describe('renamed comune: Corneto → Corneto Tarquinia (1872) → Tarquinia (1922)', () => {
    it('finds today’s comune from the old name', () => {
      const m = first('Corneto');
      expect(m.match).toBe('historical_name');
      expect(m.current_comuni[0]).toMatchObject({ istat_code: '056050', name: 'Tarquinia' });
      expect(m.names_used).toEqual(
        expect.arrayContaining(['Corneto', 'Corneto Tarquinia', 'Tarquinia']),
      );
    });
    it('gives the name in force in a given year', () => {
      expect(first('Tarquinia', { year: 1870 }).at_year).toMatchObject({
        status: 'not_yet_part_of_italy',
      });
      expect(first('Tarquinia', { year: 1872 }).at_year).toMatchObject({
        status: 'changed_that_year',
        before_change: { name: 'Corneto' },
      });
      expect(first('Tarquinia', { year: 1900 }).at_year).toMatchObject({
        name: 'Corneto Tarquinia',
      });
      expect(first('Corneto', { year: 1925 }).at_year).toMatchObject({ name: 'Tarquinia' });
    });
    it('lists dated renames in the timeline', () => {
      const t = first('Tarquinia').timeline!;
      expect(t).toContainEqual(
        expect.objectContaining({ date: '1872-10-18', new_name: 'Corneto Tarquinia' }),
      );
      expect(t).toContainEqual(
        expect.objectContaining({ date: '1922-06-10', new_name: 'Tarquinia' }),
      );
    });
  });

  it('province move: Tarquinia in Roma until 1928, then Viterbo', () => {
    expect(first('Tarquinia', { year: 1925 }).at_year).toMatchObject({
      province: 'RM',
      province_name: 'Roma',
    });
    expect(first('Tarquinia', { year: 1930 }).at_year).toMatchObject({
      province: 'VT',
      istat_code: '056050',
    });
  });

  describe('suppressed/merged comune: Bagnaja → Viterbo (1928)', () => {
    it('separate comune before, merged after, flagged in the year of change', () => {
      expect(first('Bagnaja', { year: 1910 }).at_year).toMatchObject({
        status: 'comune',
        name: 'Bagnaja',
      });
      expect(first('Bagnaja', { year: 1950 }).at_year).toMatchObject({
        status: 'merged_into_another_comune',
      });
      expect(first('Bagnaja', { year: 1928 }).at_year).toMatchObject({
        status: 'changed_that_year',
      });
      expect(first('Bagnaja').current_comuni[0]!.name).toBe('Viterbo');
    });
    it('modern spelling Bagnaia finds it', () => {
      const r = run('Bagnaia');
      expect(r.match_quality).toBe('spelling_variant');
      expect(r.matches[0]!.matched_name).toBe('Bagnaja');
    });
  });

  it('re-established comune: Bassano in Teverina (merged into Orte 1927, back 1958)', () => {
    const at = (y: number) => first('Bassano in Teverina', { year: y }).at_year!;
    expect(at(1865).status).toBe('not_yet_part_of_italy');
    expect(at(1900)).toMatchObject({ status: 'comune', province: 'RM' });
    expect(at(1940)).toMatchObject({ status: 'merged_into_another_comune' });
    expect(at(1940).explanation).toMatch(/Orte.*again on 1958-10-25/);
    expect(at(1960)).toMatchObject({ status: 'comune', province: 'VT' });
  });

  describe('reused ISTAT codes (Udine renumbering, 6 April 1968)', () => {
    // Andreis left code 030004 for Pordenone; the same day Aquileia moved from 030005 to
    // 030004 and Arta Terme from 030006 to 030005.
    it('keeps comuni that shared a code apart', () => {
      const aq = run('Aquileia');
      expect(aq.matches).toHaveLength(1);
      expect(aq.matches[0]!.current_comuni.map((c) => c.name)).toEqual(['Aquileia']);
      expect(first('Andreis').current_comuni.map((c) => c.name)).toEqual(['Andreis']);
    });
    it('gives each comune its own code in 1960', () => {
      expect(first('Aquileia', { year: 1960 }).at_year).toMatchObject({ istat_code: '030005' });
      expect(first('Andreis', { year: 1960 }).at_year).toMatchObject({ istat_code: '030004' });
    });
  });

  it('split comune: Grotte Santo Stefano went to Graffignano and Viterbo', () => {
    const m = run('Grotte Santo Stefano').matches.find((x) => x.match === 'historical_name')!;
    expect(m.current_comuni.map((c) => c.name).sort()).toEqual(['Graffignano', 'Viterbo']);
  });

  it('ambiguous name in two provinces: Castro (BG, LE), narrowed by province', () => {
    const r = run('Castro');
    expect(r.confidence_note).toMatch(/Ambiguous/);
    expect(r.matches.map((m) => m.current_comuni[0]!.province)).toEqual(
      expect.arrayContaining(['BG', 'LE']),
    );
    expect(
      run('Castro', { province: 'LE' }).matches.map((m) => m.current_comuni[0]!.istat_code),
    ).toEqual(['075096']);
    expect(first('Castro', { province: 'Bergamo' }).current_comuni[0]!.province).toBe('BG');
  });

  it('frazione alias: Calcata Vecchia → Calcata', () => {
    const m = first('Calcata Vecchia');
    expect(m.match).toBe('frazione');
    expect(m.current_comuni[0]).toMatchObject({ istat_code: '056010', name: 'Calcata' });
    expect(m.alias).toMatchObject({ verified: false });
  });

  describe('2021 census localities', () => {
    it('finds a locality with no curated alias: Morgi → Calcata', () => {
      const m = first('Morgi');
      expect(m.match).toBe('locality');
      expect(m.current_comuni[0]!.name).toBe('Calcata');
      expect(m.locality).toMatchObject({
        type: 'nucleo abitato (hamlet)',
        verified: true,
      });
    });
    it('gives the comune’s status in a year, with a boundary caveat', () => {
      const m = first('Tobia', { year: 1900 });
      expect(m.comune_at_year).toMatchObject({ status: 'comune', name: 'Viterbo', province: 'RM' });
      expect(m.locality_note).toMatch(/boundaries may have differed/);
    });
    it('does not repeat a locality already covered by a curated alias', () => {
      const r = run('Calcata Vecchia');
      expect(r.matches).toHaveLength(1);
      expect(r.matches[0]!.match).toBe('frazione');
    });
    it('lists same-named localities next to a comune match', () => {
      const r = run('Grotte Santo Stefano') as ReturnType<typeof run> & {
        also_localities?: { shown: { comune: string }[] };
      };
      expect(r.matches.some((m) => m.match === 'historical_name')).toBe(true);
      expect(r.also_localities?.shown[0]!.comune).toBe('Viterbo (VT)');
    });
  });

  it('comune ceded abroad: Briga Marittima (1947)', () => {
    const m = first('Briga Marittima', { year: 1950 });
    expect(m.ceded_abroad).toBe(true);
    expect(m.at_year).toMatchObject({ status: 'abroad' });
  });

  it('annexation date: Bozen not yet Italian in 1915', () => {
    const m = first('Bozen', { year: 1915 });
    expect(m.match).toBe('current_name_other_language');
    expect(m.at_year).toMatchObject({ status: 'not_yet_part_of_italy' });
  });

  it('province at the time is accepted as a filter (Corneto was in RM)', () => {
    expect(run('Corneto', { province: 'RM' }).notes.join(' ')).not.toMatch(/No match in province/);
    expect(run('Corneto', { province: 'Roma' }).matches).toHaveLength(1);
  });

  it('fuzzy match is flagged as uncertain', () => {
    const r = run('Toscanela');
    expect(r.match_quality).not.toBe('exact');
    expect(r.confidence_note).toMatch(/Confirm before relying/);
  });

  it('falls back to spelling variants when the province rules out exact matches', () => {
    const r = run('Bagnaia', { province: 'VT' });
    expect(r.matches[0]!.matched_name).toBe('Bagnaja');
    expect(r.matches[0]!.current_comuni[0]!.name).toBe('Viterbo');
  });

  it('does not fuzzy-match very short names', () => {
    expect(run('Zzzzzz').matches).toHaveLength(0);
  });

  it('no match gives advice', () => {
    const r = run('Qwertyville');
    expect(r.matches).toHaveLength(0);
    expect(r.confidence_note).toMatch(/No match/);
  });

  it('notes the limits for years before 1861', () => {
    expect(run('Viterbo', { year: 1800 }).notes.join(' ')).toMatch(/17 March 1861/);
  });
});

describe('the similar-name search runs only when needed (performance)', () => {
  it('is skipped for an exact match and used for a misspelling', () => {
    const spy = vi.spyOn(store, 'allVariants');
    expect(first('Tarquinia').current_comuni[0]!.name).toBe('Tarquinia');
    expect(spy).not.toHaveBeenCalled();
    const r = run('Taquinia');
    expect(r.match_quality).toBe('fuzzy');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
