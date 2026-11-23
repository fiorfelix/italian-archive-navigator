import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DB_PATH, RULES_DIR } from '../../src/config.js';
import { loadRules } from '../../src/rules/loader.js';
import { SqliteStore } from '../../src/data/sqlite-store.js';
import { findArchiveContact } from '../../src/resolve/archive-contact.js';
import { resolveComuneHistory } from '../../src/resolve/comune-history.js';
import { resolveComuneInput } from '../../src/resolve/comune-input.js';

// Runs only after `npm run refresh-data` has built the real database.
describe.skipIf(!existsSync(DB_PATH))('real database smoke test', () => {
  it('has the full comuni list and the curated aliases', () => {
    const store = new SqliteStore(DB_PATH);
    const names = (n: string, p?: string) =>
      (
        resolveComuneHistory(store, { name: n, province: p }).matches as {
          current_comuni: { name: string }[];
        }[]
      ).flatMap((m) => m.current_comuni.map((c) => c.name));
    expect(names('Corneto')).toContain('Tarquinia');
    expect(names('Bagnaja')).toContain('Viterbo');
    expect(names('Bassano in Teverina', 'VT')).toEqual(['Bassano in Teverina']);
    expect(names('Castro', 'LE')).toEqual(['Castro']);
    expect(names('Calcata Vecchia')).toEqual(['Calcata']);
    store.close();
  });

  it('has an IndicePA PEC for Comuni and a State Archive for every target-region province', () => {
    const store = new SqliteStore(DB_PATH);
    for (const comune of ['Roma', 'Viterbo', 'Perugia', 'Firenze', 'Ancona', 'Caines']) {
      const r = findArchiveContact(store, { comune, office_type: 'stato_civile' });
      expect((r.contacts[0] as { pec: string[] }).pec.length).toBeGreaterThan(0);
    }
    for (const p of [
      'RM',
      'VT',
      'RI',
      'LT',
      'FR',
      'PG',
      'TR',
      'FI',
      'AR',
      'GR',
      'LI',
      'LU',
      'MS',
      'PI',
      'PT',
      'PO',
      'SI',
      'AN',
      'AP',
      'FM',
      'MC',
      'PU',
    ]) {
      expect(store.archiveForProvince(p)).toMatchObject({ verified: true, basis: 'curated' });
    }
    store.close();
  });

  it('every ISTAT code named in a rule is a comune today', () => {
    const store = new SqliteStore(DB_PATH);
    const codes = loadRules(RULES_DIR).flatMap((r) => r.territory.comuni ?? []);
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.filter((c) => !store.getComune(c))).toEqual([]);
    store.close();
  });

  it('names a renamed comune that once had the asked name, not temporary mergers', () => {
    const store = new SqliteStore(DB_PATH);
    const r = resolveComuneInput(store, { comune: 'Calliano' });
    expect(r.comune.province_abbr).toBe('TN');
    expect(r.also_means?.join(' ')).toMatch(/Calliano Monferrato \(AT/);
    expect(resolveComuneInput(store, { comune: 'Bairo' }).also_means).toBeUndefined();
    expect(resolveComuneInput(store, { comune: 'Tarquinia' }).also_means).toBeUndefined();
    store.close();
  });
});
