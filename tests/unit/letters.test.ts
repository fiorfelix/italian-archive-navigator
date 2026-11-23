import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEMPLATES_DIR } from '../../src/config.js';
import { SqliteStore } from '../../src/data/sqlite-store.js';
import { citeSource, EVIDENCE_LABELS, SEEN_AS } from '../../src/letters/cite.js';
import {
  delDate,
  draftRequestLetter,
  italianDate,
  REQUEST_TYPES,
  type LetterInput,
} from '../../src/letters/draft.js';
import { render } from '../../src/letters/template.js';
import { buildFixtureDb } from '../helpers/build-fixture-db.js';

let store: SqliteStore;
beforeAll(() => {
  store = new SqliteStore(buildFixtureDb());
});
afterAll(() => store.close());

const NOW = new Date('2026-11-19T12:00:00Z');
const requester = {
  name: 'Anna Esempio',
  relationship: 'pronipote',
  contact: 'anna@example.org',
  place: 'Boston',
};
const draft = (input: Partial<LetterInput> & Pick<LetterInput, 'request_type'>) =>
  draftRequestLetter(
    store,
    {
      comune: 'Tarquinia',
      person: { given_names: 'Giuseppe', surname: 'Rossi' },
      requester,
      ...input,
    } as LetterInput,
    TEMPLATES_DIR,
    NOW,
  );

describe('template renderer', () => {
  it('fills values, drops empty optional blocks, marks missing required fields', () => {
    const r = render('A {{x}}{{#y}} Y={{y}}{{/y}} B {{z}}', { x: '1' }, { z: 'zeta' });
    expect(r.text).toBe('A 1 B [DA COMPLETARE: zeta]');
    expect(r.missing).toEqual(['z']);
  });
  it('formats ISO dates in Italian', () => {
    expect(italianDate('1880-03-05')).toBe('5 marzo 1880');
    expect(italianDate('circa 1880')).toBe('circa 1880');
    expect(delDate('1891-03-11')).toBe('dell’11 marzo 1891');
    expect(delDate('1891-03-08')).toBe('dell’8 marzo 1891');
    expect(delDate('1891-03-01')).toBe('del 1° marzo 1891');
  });
});

describe('draft_request_letter', () => {
  it.each(REQUEST_TYPES)(
    '%s: produces a letter, an English gloss and attachments',
    (request_type) => {
      const r = draft({
        request_type,
        event: { type: 'birth', date: '1880-03-05' },
        military: { birth_date: '1880-03-05' },
      });
      expect(r.letter_it).toMatch(/ROSSI Giuseppe/);
      expect(r.letter_it).toMatch(/^Anna Esempio\nanna@example\.org\n\n/);
      expect(r.letter_it).toMatch(/Distinti saluti[\s\S]*\(Anna Esempio\)$/);
      expect(r.gloss_en.length).toBeGreaterThan(50);
      expect(r.attachments.length).toBeGreaterThan(0);
    },
  );

  it.each(REQUEST_TYPES)(
    '%s: never states a fee or a response time, asks for them instead',
    (request_type) => {
      const r = draft({ request_type, event: { type: 'birth', year: 1880 } });
      expect(r.letter_it).not.toMatch(/€|\beuro\b|\d+\s*giorni/i);
      expect(r.letter_it).toMatch(/costi|tariffe|spese/);
      expect(r.notes.join(' ')).toMatch(/Fees and response times are not stated/);
    },
  );

  it('Comune: recipient from IndicePA, former name explained, DPR 396/2000 art. 107 cited', () => {
    const r = draft({
      request_type: 'comune_copia_integrale',
      comune: 'Corneto',
      event: { type: 'birth', date: '1880-03-05' },
      parents: { father: 'Luigi Rossi', mother: 'Maria Bianchi' },
      act: { number: '45', year: 1880 },
    });
    expect(r.recipient.text).toMatch(/^Al Comune di Tarquinia\nUfficio di stato civile/);
    expect(r.recipient.text).toMatch(/PEC: /);
    expect(r.letter_it).toMatch(
      /Atto di nascita, Corneto \(oggi Tarquinia\), 5 marzo 1880, n\. 45/,
    );
    expect(r.letter_it).toMatch(/ROSSI Giuseppe \(di Luigi Rossi e di Maria Bianchi\)/);
    expect(r.letter_it).toMatch(/pronipote di Giuseppe ROSSI/);
    expect(r.letter_it).toMatch(/art\. 107 del D\.P\.R\. 3 novembre 2000, n\. 396/);
    expect(r.missing_fields).toEqual([]);
  });

  it('lists every missing field and marks it in the letter', () => {
    const r = draftRequestLetter(
      store,
      { request_type: 'comune_copia_integrale', comune: 'Tarquinia', person: { surname: 'Rossi' } },
      TEMPLATES_DIR,
      NOW,
    );
    const fields = r.missing_fields.map((m) => m.field);
    expect(fields).toEqual(
      expect.arrayContaining(['mittente', 'richiedente', 'relazione', 'evento', 'data_o_anno']),
    );
    for (const f of fields)
      expect(r.letter_it).toContain(
        `[DA COMPLETARE: ${r.missing_fields.find((m) => m.field === f)!.label}]`,
      );
    expect(r.letter_it).toMatch(/Luogo e data: _{10,}/);
  });

  it('State Archive: earlier-province archive is mentioned for years before the move (Tarquinia, RM until 1928)', () => {
    const r = draft({
      request_type: 'archivio_di_stato_riproduzione',
      event: { type: 'marriage', year: 1905 },
    });
    expect(r.recipient.text).toMatch(/Archivio di Stato di Viterbo/);
    expect(r.notes.join(' ')).toMatch(/Archivio di Stato di Roma.*Unconfirmed/);
    expect(r.letter_it).toMatch(/Stato civile italiano, Comune di Tarquinia, Matrimoni 1905/);
    expect(r.letter_it).toMatch(/allegati a questo atto/);
  });

  it('parish: addressed to the parish priest of the frazione, parish name left to complete', () => {
    const r = draft({
      request_type: 'parrocchia_ricerca',
      comune: 'Calcata Vecchia',
      event: { type: 'birth', year: 1850 },
    });
    expect(r.recipient.text).toMatch(/Reverendo Parroco[\s\S]*Calcata Vecchia, comune di Calcata/);
    expect(r.letter_it).toMatch(/atto di battesimo/);
    expect(r.missing_fields.map((m) => m.field)).toContain('destinatario');
    expect(r.recipient.verified).toBe(false);
  });

  it('military: the documentation office for the province is the recipient when known', () => {
    const r = draft({ request_type: 'militare_foglio_matricolare', comune: 'Viterbo' });
    expect(r.recipient.text).toMatch(/^Spett\.le Ufficio Documentale di prova\nVia di Prova 1/);
    expect(r.recipient.text).toMatch(/PEC: prova@postacert\.example\.org/);
    expect(r.missing_fields.map((m) => m.field)).not.toContain('destinatario');
    expect(r.notes).toContain('Test note.');
  });

  it('military: birth class from the birth date; office to complete from the official list', () => {
    const r = draft({
      request_type: 'militare_foglio_matricolare',
      comune: 'Castro',
      province: 'LE',
      military: { birth_date: '1895-07-12' },
    });
    expect(r.letter_it).toMatch(/classe di leva: 1895/);
    expect(r.letter_it).toMatch(/nato\/a il 12 luglio 1895/);
    expect(r.letter_it).toMatch(/copia del foglio matricolare/);
    expect(r.letter_it).toMatch(/modello di istanza/);
    expect(r.notes.join(' ')).toMatch(/not in our data/);
  });

  it('military to the State Archive when asked', () => {
    const r = draft({
      request_type: 'militare_foglio_matricolare',
      addressee: 'archivio_di_stato',
      military: { birth_class: 1880 },
    });
    expect(r.recipient.text).toMatch(/Archivio di Stato di Viterbo/);
  });

  it('Italian agreement, banns, details and the 50-year clause', () => {
    const r = draft({
      request_type: 'archivio_di_stato_riproduzione',
      person: {
        given_names: 'Giuseppe',
        surname: 'Rossi',
        sex: 'M',
        father: 'Luigi',
        mother: 'Maria Bianchi',
        birth_place: 'Tarquinia',
      },
      spouse: { given_names: 'Rosa', surname: 'Verdi', sex: 'F', birth_place: 'Tuscania' },
      event: { type: 'marriage', date: '1883-02-10' },
      act: { number: '7', banns: { number: '3', date: '1883-01-21' } },
      details: ['Nota a margine da verificare'],
    });
    expect(r.letter_it).toMatch(
      /• Atto n\. 7 del 10 febbraio 1883: ROSSI Giuseppe \(di Luigi e di Maria Bianchi, nato a Tarquinia\) e VERDI Rosa \(nata a Tuscania\)\./,
    );
    expect(r.letter_it).toMatch(
      /registro delle pubblicazioni 1883, atto n\. 3 del 21 gennaio 1883/,
    );
    expect(r.letter_it).toMatch(/• Nota a margine da verificare/);
    const m = draft({
      request_type: 'militare_foglio_matricolare',
      addressee: 'ministero_difesa',
      requester: { ...requester, sex: 'F' },
      person: {
        given_names: 'Giuseppe',
        surname: 'Rossi',
        birth_date: '1880-03-05',
        death_date: '1950-01-01',
      },
    });
    expect(m.letter_it).toMatch(/La sottoscritta Anna Esempio/);
    expect(m.letter_it).toMatch(/copia dello stato di servizio/);
    expect(m.letter_it).toMatch(/più di cinquant’anni/);
    expect(m.recipient.text).toMatch(/PERSOMIL/);
    expect(m.notes.join(' ')).toMatch(/Reserve officers \(di complemento\).*place of birth/);
  });

  it('mother "fu", spouse as plain text, military subject without a name', () => {
    const r = draft({
      request_type: 'comune_copia_integrale',
      person: { surname: 'Rossi', father: 'fu Luigi', mother: 'fu Maria' },
      spouse: 'Rosa Verdi',
      event: { type: 'marriage', year: 1900 },
    });
    expect(r.letter_it).toMatch(/ROSSI \(del fu Luigi e della fu Maria\)/);
    expect(r.letter_it).toMatch(/• Rosa Verdi\n/);
    const m = draft({ request_type: 'militare_foglio_matricolare', person: {} });
    expect(m.letter_it).toMatch(
      /foglio matricolare di \[DA COMPLETARE: nome e cognome della persona\]/,
    );
  });

  it('recent events carry the access note (SPEC §2)', () => {
    const r = draft({
      request_type: 'comune_copia_integrale',
      event: { type: 'death', year: 1990 },
    });
    expect(r.notes.join(' ')).toMatch(/office decides/);
  });
});

describe('cite_source', () => {
  it('maps every way of knowing to one of the five evidence labels', () => {
    expect(new Set(Object.values(SEEN_AS))).toEqual(new Set(EVIDENCE_LABELS));
  });
  it('formats a full citation consistently', () => {
    const r = citeSource({
      archive: 'Archivio di Stato di Viterbo',
      fonds: 'Stato civile italiano',
      series: 'Nati',
      comune: 'Tarquinia',
      year: 1880,
      record_type: 'birth',
      act_number: '45',
      url: 'https://example.org/register/45',
      accessed: '2026-11-19',
      seen_as: 'original_record',
    });
    expect(r.citation).toBe(
      'Archivio di Stato di Viterbo, Stato civile italiano, Nati, Tarquinia, 1880, atto di nascita n. 45, https://example.org/register/45 (consultato il 19 novembre 2026).',
    );
    expect(r.evidence.label).toBe('VERIFIED');
    expect(r).not.toHaveProperty('missing_for_a_complete_citation');
  });
  it('leaves out unknown parts and says what is missing', () => {
    const r = citeSource({
      archive: 'Parrocchia di San Pietro',
      record_type: 'baptism',
      seen_as: 'family_account',
    });
    expect(r.citation).toBe('Parrocchia di San Pietro, atto di battesimo.');
    expect(r.evidence.label).toBe('FAMILY_ACCOUNT');
    expect(r.missing_for_a_complete_citation).toEqual(['fonds or series', 'year', 'act number']);
  });
});
