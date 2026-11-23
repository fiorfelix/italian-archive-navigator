import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SqliteStore } from '../../src/data/sqlite-store.js';
import { findArchiveContact } from '../../src/resolve/archive-contact.js';
import { ComuneInputError } from '../../src/resolve/comune-input.js';
import {
  checkIndicePaMetadata,
  isRoleAddress,
  parseComuneContacts,
} from '../../src/refresh/indicepa.js';
import { obtainIndicePa, type JsonGetter } from '../../src/refresh/run.js';
import { INDICEPA_AOO, INDICEPA_ENTI, INDICEPA_UO } from '../../src/refresh/sources.js';
import { buildFixtureDb, fx } from '../helpers/build-fixture-db.js';

let store: SqliteStore;
beforeAll(() => {
  store = new SqliteStore(buildFixtureDb());
});
afterAll(() => store.close());

type Contact = {
  role: string;
  name: string;
  pec: string[];
  email?: string[];
  verified: boolean;
  address: string;
  note?: string;
};
const find = (
  comune: string,
  office_type: Parameters<typeof findArchiveContact>[1]['office_type'],
  province?: string,
) => {
  const r = findArchiveContact(store, { comune, office_type, province });
  return { ...r, contacts: r.contacts as unknown as Contact[] };
};
const meta = (n: string) =>
  JSON.parse(
    readFileSync(fx(`indicepa/metadata_${n}.json`), 'utf8').replace(/^\uFEFF/, ''),
  ) as unknown;

describe('find_archive_contact', () => {
  describe('stato_civile (IndicePA)', () => {
    it('a known Comune returns its PEC', () => {
      const r = find('Tarquinia', 'stato_civile');
      expect(r.comune).toMatchObject({ istat_code: '056050', province: 'VT' });
      const main = r.contacts[0]!;
      expect(main.name).toBe('Comune di Tarquinia');
      expect(main.pec[0]).toMatch(/@/);
      expect(main.verified).toBe(true);
      expect(r.verified).toBe(true);
    });
    it('accepts the ISTAT code', () => {
      expect(find('056059', 'stato_civile').comune.name).toBe('Viterbo');
    });
    it('accepts a former name or a frazione, and says how it was understood', () => {
      const r = find('Corneto', 'stato_civile');
      expect(r.comune.name).toBe('Tarquinia');
      expect(r.resolved_from).toMatch(/Corneto/);
      expect(find('Calcata Vecchia', 'stato_civile').comune.name).toBe('Calcata');
    });
    it('lists the civil-registry office when IndicePA has one', () => {
      const offices = find('Tarquinia', 'stato_civile').contacts.filter((c) =>
        c.role.startsWith('Ufficio'),
      );
      expect(offices[0]?.name).toMatch(/STATO CIVILE/i);
    });
    it('keeps only PEC addresses for the Comune itself (no personal mailboxes)', () => {
      const rows = JSON.parse(readFileSync(fx('indicepa/enti_rows.json'), 'utf8')) as unknown[][];
      const h = rows[0] as string[];
      rows.push(
        h.map((c) =>
          c === 'Codice_Categoria'
            ? 'L6'
            : c === 'Codice_IPA'
              ? 'c_z999'
              : c === 'Denominazione_ente'
                ? 'Comune di Prova'
                : c === 'Codice_comune_ISTAT'
                  ? '999999'
                  : c === 'Mail1'
                    ? 'mayor.name@example.org'
                    : c === 'Tipo_Mail1'
                      ? 'Altro'
                      : c === 'Mail2'
                        ? 'protocollo@pec.example.org'
                        : c === 'Tipo_Mail2'
                          ? 'Pec'
                          : null,
        ),
      );
      const c = parseComuneContacts(INDICEPA_ENTI, rows).find((x) => x.ipa_code === 'c_z999')!;
      expect(c.pec).toEqual(['protocollo@pec.example.org']);
    });
  });

  describe('archivio_di_stato', () => {
    it('returns the State Archive of the province, verified, from IndicePA', () => {
      const r = find('Calcata', 'archivio_di_stato');
      expect(r.contacts[0]).toMatchObject({ name: 'Archivio di Stato di Viterbo', verified: true });
      expect(r.contacts[0]!.pec[0]).toMatch(/@pec\.cultura\.gov\.it$/);
    });
    it('adds the archive of an earlier province, unverified (Tarquinia was in RM until 1928)', () => {
      const extra = find('Tarquinia', 'archivio_di_stato').contacts.find(
        (c) => c.name === 'Archivio di Stato di Roma',
      );
      expect(extra).toMatchObject({ verified: false });
      expect(extra!.note).toMatch(/1928-12-30/);
    });
    it('falls back to the State Archive in the same province when not curated', () => {
      expect(find('Castro', 'archivio_di_stato', 'LE').contacts[0]!.name).toBe(
        'Archivio di Stato di Lecce',
      );
    });
  });

  describe('office types without confirmed entries return an unverified pointer', () => {
    it('diocesi', () => {
      const r = find('Viterbo', 'diocesi');
      expect(r.verified).toBe(false);
      expect(r.directory).toMatchObject({ url: 'https://example.org/diocesi', verified: false });
      expect(r.contacts).toHaveLength(0);
    });
    it('ufficio_documentale_militare with a confirmed office for the province: that office, no directory', () => {
      const r = find('Viterbo', 'ufficio_documentale_militare');
      expect(r.verified).toBe(true);
      expect(r.directory).toBeUndefined();
      expect(r.contacts).toHaveLength(1);
      expect(r.contacts[0]).toMatchObject({
        name: 'Ufficio Documentale di prova',
        pec: ['prova@postacert.example.org'],
        source_url: 'https://example.org/ufficio',
        note: 'Test note.',
      });
    });
    it('ufficio_documentale_militare elsewhere: rule, directory and verified central offices', () => {
      const r = find('Castro', 'ufficio_documentale_militare', 'LE');
      expect(r.verified).toBe(false);
      expect(r.directory).toMatchObject({
        verified: false,
        rule_source_url: 'https://example.org/rule',
      });
      expect(r.contacts.map((c) => c.pec[0])).toEqual(
        expect.arrayContaining(['udocei@postacert.difesa.it', 'persomil@postacert.difesa.it']),
      );
      expect(r.notes.join(' ')).toMatch(/place of birth/);
    });
  });

  describe('input errors are actionable', () => {
    it('a current name outranks a former name held by another comune', () => {
      // "Castro" is the current name in BG and LE, and a former name of Castro dei Volsci (FR).
      expect(() => find('Castro', 'stato_civile')).toThrow(/matches 2 comuni today/);
      expect(find('Castro', 'stato_civile', 'BG').comune.istat_code).toBe('016065');
    });
    it('ambiguous name lists the candidates', () => {
      expect(() => find('Castro', 'stato_civile')).toThrow(ComuneInputError);
      expect(() => find('Castro', 'stato_civile')).toThrow(
        /Castro \(BG, ISTAT 016065\).*Give the province/,
      );
    });
    it('a spelling-variant match does not hide places spelled exactly as given', () => {
      expect(find('Bagnaja', 'archivio_di_stato').comune.name).toBe('Viterbo');
      expect(find('Bagnaia', 'archivio_di_stato', 'VT').comune.name).toBe('Viterbo');
    });
    it('unknown name and unknown code', () => {
      expect(() => find('Qwertyville', 'stato_civile')).toThrow(/No comune or locality called/);
      expect(() => find('999998', 'stato_civile')).toThrow(
        /No current comune has ISTAT code 999998/,
      );
    });
  });
});

// Personal addresses below are invented (same shapes as real ones), not taken from IndicePA.
describe('office addresses: role mailboxes only', () => {
  it.each([
    ['anagrafe.comuneanzio@pec.it', 'Comune di Anzio', true],
    ['s.civile@pec.comune.alghero.ss.it', 'Comune di Alghero', true],
    ['albettone.vi@cert.ip-veneto.net', 'Comune di Albettone', true],
    ['ufficioanagrafecasale@virgilio.it', 'Comune di Casale', true],
    ['demografici@comune.tarquinia.vt.it', 'Comune di Tarquinia', true],
    ['demog.terranovadasibari@asmepec.it', 'Comune di Terranova da Sibari', true],
    ['giulia.martini@comune.esempio.it', 'Comune di Esempio', false],
    ['mrossi.esempio@ruparpiemonte.it', 'Comune di Esempio', false],
    ['a.colombo@esempio.org', 'Comune di Esempio', false],
    ['luca.romano@gmail.com', 'Comune di Esempio', false],
    ['m.gentile@comune.esempio.it', 'Comune di Esempio', false],
    ['a.protti@comune.esempio.it', 'Comune di Esempio', false],
    ['s.demonte@comune.esempio.it', 'Comune di Esempio', false],
  ])('%s → %s', (address, comune, expected) => {
    expect(isRoleAddress(address, comune)).toBe(expected);
  });
});

describe('IndicePA source checks', () => {
  it('accepts the published data dictionaries', () => {
    expect(() => checkIndicePaMetadata(INDICEPA_ENTI, meta('enti'))).not.toThrow();
    expect(() => checkIndicePaMetadata(INDICEPA_AOO, meta('aoo'))).not.toThrow();
    expect(() => checkIndicePaMetadata(INDICEPA_UO, meta('unita_organizzative'))).not.toThrow();
  });
  it('rejects a changed data dictionary', () => {
    const m = meta('aoo') as { COLUMN_NAME: string }[];
    m[2]!.COLUMN_NAME = 'descrizione';
    expect(() => checkIndicePaMetadata(INDICEPA_AOO, m)).toThrow(/Columns changed in IndicePA/);
  });
  it('refuses a dataset whose licence changed', async () => {
    const get: JsonGetter = async () => ({
      bytes: new Uint8Array(),
      json: {
        success: true,
        result: { license_id: 'other-closed', license_title: 'Closed', resources: [] },
      },
    });
    await expect(obtainIndicePa(INDICEPA_AOO, get, async () => new Uint8Array())).rejects.toThrow(
      /licence is now "other-closed"/,
    );
  });
});
