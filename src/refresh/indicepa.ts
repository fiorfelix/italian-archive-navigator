import type { ComuneContact, ComuneOffice, StateOffice } from '../data/store.js';
import { SchemaChangedError } from './parse.js';
import type { IndicePaDef } from './sources.js';

const clean = (v: unknown): string =>
  v === null || v === undefined || v === 'null' ? '' : String(v).replace(/\s+/g, ' ').trim();
const opt = (v: string) => (v ? v : null);

/** Checks the published data dictionary (metadata_*.json) against the expected columns. */
export function checkIndicePaMetadata(def: IndicePaDef, metadata: unknown): void {
  const got = Array.isArray(metadata)
    ? metadata.map((c) => String((c as { COLUMN_NAME?: string }).COLUMN_NAME))
    : [];
  if (got.join('|') !== def.columns.join('|')) {
    throw new SchemaChangedError(
      `Columns changed in ${def.title} (${def.page_url}).\n` +
        `  expected: ${JSON.stringify(def.columns)}\n  published: ${JSON.stringify(got)}\n` +
        'Review the data dictionary, then update src/refresh/sources.ts.',
    );
  }
}

/** Returns a row accessor after checking the file's header row against the expected columns. */
function table(def: IndicePaDef, rows: unknown[][]) {
  const header = (rows[0] ?? []).map(clean);
  if (header.join('|') !== def.columns.join('|')) {
    throw new SchemaChangedError(
      `Header of ${def.title} does not match its data dictionary.\n  got: ${JSON.stringify(header)}`,
    );
  }
  const ix = new Map(def.columns.map((c, i) => [c, i]));
  return {
    data: rows.slice(1),
    get: (r: unknown[], col: string) => clean(r[ix.get(col)!]),
  };
}

const isPec = (type: string) => type.toLowerCase() === 'pec';

/**
 * Candidate Comune entries: category L6 ("Comuni e loro Consorzi e Associazioni"), keeping
 * entries coded c_<cadastral code> (IndicePA's code for a Comune) or named "Comune …".
 * Only PEC addresses are kept: other addresses can be personal mailboxes of office holders.
 */
export function parseComuneContacts(def: IndicePaDef, rows: unknown[][]): ComuneContact[] {
  const t = table(def, rows);
  const out: ComuneContact[] = [];
  for (const r of t.data) {
    if (t.get(r, 'Codice_Categoria') !== 'L6') continue;
    const name = t.get(r, 'Denominazione_ente');
    const ipaCode = t.get(r, 'Codice_IPA');
    if (!/^c_[a-z]\d{3}$/.test(ipaCode) && !/^comune\b/i.test(name)) continue;
    const pec: string[] = [];
    for (const n of [1, 2, 3, 4, 5]) {
      const mail = t.get(r, `Mail${n}`);
      if (mail && isPec(t.get(r, `Tipo_Mail${n}`))) pec.push(mail);
    }
    out.push({
      istat_code: t.get(r, 'Codice_comune_ISTAT'),
      ipa_code: ipaCode,
      name,
      address: opt(t.get(r, 'Indirizzo')),
      cap: opt(t.get(r, 'CAP')),
      pec,
      website: opt(t.get(r, 'Sito_istituzionale')),
      updated: opt(t.get(r, 'Data_aggiornamento')),
    });
  }
  return out;
}

/**
 * Assigns one IndicePA entry to each current comune: first the entry coded
 * c_<ISTAT cadastral code>, else an entry named "Comune …" with the same ISTAT code.
 * (The IPA-code join also survives errors in IndicePA's own ISTAT code field.)
 */
export function matchComuneContacts(
  comuni: { istat_code: string; cadastral_code: string }[],
  candidates: ComuneContact[],
): ComuneContact[] {
  const byIpa = new Map(candidates.map((c) => [c.ipa_code, c]));
  const byIstat = new Map<string, ComuneContact>();
  for (const c of candidates) if (/^comune\b/i.test(c.name)) byIstat.set(c.istat_code, c);
  const out: ComuneContact[] = [];
  for (const k of comuni) {
    const c = byIpa.get(`c_${k.cadastral_code.toLowerCase()}`) ?? byIstat.get(k.istat_code);
    if (c) out.push({ ...c, istat_code: k.istat_code });
  }
  return out;
}

const CIVIL_REGISTRY_OFFICE = /stato civile|demografic|anagrafe/i;

/** Short office abbreviations: must be a whole part of the address. */
const ROLE_ABBREVIATION = new Set([
  'anag',
  'demo',
  'demog',
  'prot',
  'segret',
  'aagg',
  'uff',
  'info',
  'urp',
  'leva',
  'area',
  'pec',
  'posta',
  'mail',
  'stato',
  'civile',
  'affari',
  'settore',
  'generale',
  'sportello',
  'municipio',
]);
/** Office words: a part must start with one (e.g. "servizidemografici", "comuneanzio"). */
const ROLE_PREFIX =
  /^(anagrafe|demografic|statocivile|servizi|servizio|elettoral|protocollo|comune|segreteria|ufficio|cimiter|istituzional|amministrativ)/;

/**
 * True when an office address is a role mailbox rather than a named person's: every part of
 * the local part (split on . _ -) is an office word, the comune's own name, a short code or a
 * number. "anagrafe.comuneanzio@…" passes; "mario.rossi@comune…" does not.
 */
export function isRoleAddress(address: string, comuneName: string): boolean {
  const local = address.split('@')[0]?.toLowerCase() ?? '';
  const town = comuneName
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/^comune\s+(di\s+)?/, '')
    .replace(/[^a-z]/g, '');
  const tokens = local.split(/[._-]+/).filter(Boolean);
  return (
    tokens.length > 0 &&
    tokens.every(
      (t) =>
        t.length <= 3 ||
        /^\d+$/.test(t) ||
        ROLE_ABBREVIATION.has(t) ||
        ROLE_PREFIX.test(t) ||
        (town.length >= 4 && (t.includes(town) || (t.length >= 4 && town.includes(t)))),
    )
  );
}

/** Comune offices that handle civil registration (Servizi demografici, Stato civile, Anagrafe). */
export function parseComuneOffices(def: IndicePaDef, rows: unknown[][]): ComuneOffice[] {
  const t = table(def, rows);
  const out: ComuneOffice[] = [];
  for (const r of t.data) {
    if (!/^c_[a-z]\d{3}$/.test(t.get(r, 'Codice_IPA'))) continue;
    const name = t.get(r, 'Descrizione_uo');
    const code = t.get(r, 'Codice_comune_ISTAT');
    if (!CIVIL_REGISTRY_OFFICE.test(name) || !/^\d{6}$/.test(code)) continue;
    const ente = t.get(r, 'Denominazione_ente');
    const emails = [1, 2, 3]
      .map((n) => ({ address: t.get(r, `Mail${n}`), pec: isPec(t.get(r, `Tipo_Mail${n}`)) }))
      .filter((e) => e.address && isRoleAddress(e.address, ente));
    if (!emails.length) continue;
    out.push({
      istat_code: code,
      uo_code: t.get(r, 'Codice_uni_uo'),
      name,
      address: opt(t.get(r, 'Indirizzo')),
      cap: opt(t.get(r, 'CAP')),
      emails,
      updated: opt(t.get(r, 'Data_aggiornamento')),
    });
  }
  return out;
}

/** Defence offices relevant to service records (Army documentation offices, Persomil). */
const DEFENCE_AOO = new Set(['EUDOCEI', 'E26597', 'GMIL']);

/** Archivi di Stato and Soprintendenze archivistiche (Ministero della Cultura), Defence offices. */
export function parseStateOffices(def: IndicePaDef, rows: unknown[][]): StateOffice[] {
  const t = table(def, rows);
  const out: StateOffice[] = [];
  for (const r of t.data) {
    const amm = t.get(r, 'cod_amm');
    const aoo = t.get(r, 'cod_aoo');
    const name = t.get(r, 'des_aoo');
    let kind: StateOffice['kind'] | undefined;
    if (amm === 'm_bac' && /^archivio di stato/i.test(name)) kind = 'archivio_di_stato';
    else if (amm === 'm_bac' && /^soprintendenza archivistica/i.test(name)) {
      kind = /archivio di stato/i.test(name) ? 'archivio_di_stato' : 'soprintendenza_archivistica';
    } else if (amm === 'm_d' && DEFENCE_AOO.has(aoo)) kind = 'difesa';
    if (!kind) continue;
    const pec = [1, 2, 3]
      .filter((n) => isPec(t.get(r, `tipo_mail${n}`)))
      .map((n) => t.get(r, `mail${n}`))
      .filter(Boolean);
    out.push({
      aoo_code: aoo,
      kind,
      name,
      address: opt(t.get(r, 'Indirizzo')),
      cap: opt(t.get(r, 'Cap')),
      comune: opt(t.get(r, 'Comune')),
      province_abbr: opt(t.get(r, 'Provincia')),
      pec,
    });
  }
  return out;
}
