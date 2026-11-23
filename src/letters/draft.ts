import type { Store } from '../data/store.js';
import { findArchiveContact } from '../resolve/archive-contact.js';
import { BORN_AFTER, RECENT_YEARS } from '../resolve/records.js';
import { loadTemplate, render, type Values } from './template.js';

export const REQUEST_TYPES = [
  'comune_copia_integrale',
  'archivio_di_stato_riproduzione',
  'parrocchia_ricerca',
  'militare_foglio_matricolare',
] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

/** For military requests: whom to write to. */
export const MILITARY_ADDRESSEES = [
  'ufficio_documentale_militare',
  'archivio_di_stato',
  'ministero_difesa',
] as const;

interface PersonDetails {
  given_names?: string | undefined;
  surname?: string | undefined;
  father?: string | undefined;
  mother?: string | undefined;
  birth_place?: string | undefined;
  birth_date?: string | undefined;
  death_place?: string | undefined;
  death_date?: string | undefined;
  occupation?: string | undefined;
  /** 'M' or 'F', for Italian agreement (nato/nata); otherwise nato/a. */
  sex?: 'M' | 'F' | undefined;
}

export interface LetterInput {
  request_type: RequestType;
  comune: string;
  province?: string | undefined;
  addressee?: (typeof MILITARY_ADDRESSEES)[number] | undefined;
  person: PersonDetails;
  event?:
    | {
        type?: 'birth' | 'marriage' | 'death' | undefined;
        date?: string | undefined;
        year?: number | undefined;
        place?: string | undefined;
      }
    | undefined;
  /** Parents of the person (kept for compatibility; person.father / person.mother also work). */
  parents?: { father?: string | undefined; mother?: string | undefined } | undefined;
  spouse?: PersonDetails | string | undefined;
  act?:
    | {
        number?: string | undefined;
        year?: number | undefined;
        series?: string | undefined;
        /** Marriage banns linked to the act. */
        banns?: { number?: string | undefined; date?: string | undefined } | undefined;
        /** Ask for the supporting papers (allegati). Default: yes for State Archive marriages. */
        supporting_papers?: boolean | undefined;
      }
    | undefined;
  military?:
    | {
        birth_class?: number | undefined;
        matricola?: string | undefined;
        register?: string | undefined;
        district?: string | undefined;
        /** "stato_di_servizio" for officers, "foglio_matricolare" otherwise. */
        document?: 'foglio_matricolare' | 'stato_di_servizio' | undefined;
        rank?: string | undefined;
        /** @deprecated use person.birth_date / person.birth_place */
        birth_date?: string | undefined;
        birth_place?: string | undefined;
      }
    | undefined;
  parish?: { name?: string | undefined } | undefined;
  /** Further facts to list in the letter (one bullet each). */
  details?: string[] | undefined;
  requester?:
    | {
        name?: string | undefined;
        relationship?: string | undefined;
        contact?: string | undefined;
        place?: string | undefined;
        residence?: string | undefined;
        birth_place?: string | undefined;
        birth_date?: string | undefined;
        sex?: 'M' | 'F' | undefined;
      }
    | undefined;
}

const LABELS: Record<string, string> = {
  mittente: 'mittente (nome, recapito)',
  destinatario: 'destinatario',
  richiedente: 'nome e cognome del richiedente',
  relazione: 'rapporto di parentela (es. pronipote)',
  persona: 'nome e cognome della persona',
  grado_persona: 'nome e cognome della persona',
  scheda_persona: 'nome e cognome della persona',
  evento: 'tipo di atto (nascita, matrimonio, morte)',
  evento_parrocchia: 'tipo di atto (battesimo, matrimonio, sepoltura)',
  data_o_anno: 'data o anno dell’evento',
  anno: 'anno dell’evento',
  comune_atto: 'comune dell’atto',
  serie: 'serie (Nati, Matrimoni, Morti)',
  classe: 'classe di leva (anno di nascita)',
  documento_militare: 'documento richiesto',
};

const EVENT_IT = { birth: 'nascita', marriage: 'matrimonio', death: 'morte' } as const;
const EVENT_PARISH = { birth: 'battesimo', marriage: 'matrimonio', death: 'sepoltura' } as const;
const SERIES_IT = { birth: 'Nati', marriage: 'Matrimoni', death: 'Morti' } as const;
const MONTHS = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
];

/** "1880-03-05" → "5 marzo 1880"; other text is returned as given. */
export function italianDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  const day = Number(m[3]);
  return `${day === 1 ? '1°' : day} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

const yearOf = (d: string | undefined) =>
  d && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : undefined;
const join = (sep: string, ...parts: (string | undefined | false)[]) =>
  parts.filter(Boolean).join(sep) || undefined;
const block = (lines: (string | null | undefined)[]) => lines.filter(Boolean).join('\n');

/** nato / nata / nato/a, by sex when known. */
const agree = (stem: string, sex: 'M' | 'F' | undefined) =>
  sex === 'M' ? `${stem}o` : sex === 'F' ? `${stem}a` : `${stem}o/a`;
/** "il 5 marzo 1880", or "nel 1880" for a year alone. */
const onDate = (d: string | undefined) =>
  d && (/^\d{4}$/.test(d) ? `nel ${d}` : `il ${italianDate(d)}`);

/** "del 5 marzo 1880", "dell’11 marzo 1891" (elision before 8 and 11). */
export const delDate = (d: string) => {
  const it = italianDate(d) ?? d;
  return /^(8|11)\b/.test(it) ? `dell’${it}` : `del ${it}`;
};

/** "a Roma", "ad Arezzo" (euphonic d before a). */
const at = (place: string | undefined) =>
  place && (/^a/i.test(place) ? `ad ${place}` : `a ${place}`);
/** "di Luigi", "del fu Giovanni" when written "fu Giovanni". */
const ofParent = (name: string, mother = false) =>
  /^fu\s/i.test(name) ? `${mother ? 'della' : 'del'} ${name}` : `di ${name}`;

/** "Giuseppe ROSSI" (for prose). */
const fullName = (p: PersonDetails) => join(' ', p.given_names, p.surname?.toUpperCase());

/** "ROSSI Giuseppe (di Luigi e di Maria Bianchi, nato a Tarquinia il 5 marzo 1880)" (for lists). */
export function personCard(p: PersonDetails | undefined): string | undefined {
  if (!p) return undefined;
  const name = join(' ', p.surname?.toUpperCase(), p.given_names);
  if (!name) return undefined;
  const parents =
    p.father || p.mother
      ? join(' e ', p.father && ofParent(p.father), p.mother && ofParent(p.mother, true))
      : undefined;
  const born =
    p.birth_place || p.birth_date
      ? join(' ', agree('nat', p.sex), at(p.birth_place), onDate(p.birth_date))
      : undefined;
  const died =
    p.death_place || p.death_date
      ? join(' ', agree('mort', p.sex), at(p.death_place), onDate(p.death_date))
      : undefined;
  const extra = join(', ', parents, born, died, p.occupation);
  return extra ? `${name} (${extra})` : name;
}

type Contact = { name: string; address: string | null; pec?: string[]; email?: string[] };

const ATTACHMENTS: Record<RequestType, { it: string; en: string }[]> = {
  comune_copia_integrale: [
    { it: 'Copia di un documento di identità valido', en: 'Copy of a valid ID document' },
    {
      it: 'Documenti che attestano il rapporto di parentela (se richiesti dall’ufficio)',
      en: 'Documents proving descent (if the office asks for them)',
    },
  ],
  archivio_di_stato_riproduzione: [
    {
      it: 'Copia di un documento di identità (se richiesta)',
      en: 'Copy of an ID document (if asked)',
    },
  ],
  parrocchia_ricerca: [{ it: 'Nessun allegato obbligatorio', en: 'No mandatory attachments' }],
  militare_foglio_matricolare: [
    { it: 'Copia di un documento di identità valido', en: 'Copy of a valid ID document' },
    {
      it: 'Il modello di istanza per i privati dell’ufficio, compilato e firmato, con l’informativa privacy',
      en: 'The office’s application form for private individuals, filled in and signed, with the privacy notice',
    },
    {
      it: 'Se il decesso risale a meno di 50 anni: l’assenso degli eredi, se richiesto',
      en: 'If the death was less than 50 years ago: the heirs’ consent, if required',
    },
  ],
};

const GLOSS: Record<RequestType, string> = {
  comune_copia_integrale:
    'Request to the Comune civil registry for a full copy (copia integrale) of a birth, marriage or death act, for family-history research as a person with an interest (DPR 396/2000, art. 107). Lists the act and the people as known, asks for any fees, payment method and timing, a PDF by e-mail if possible, and where the act is if another office holds it. Attaches an ID copy and, if relevant, proof of the relationship.',
  archivio_di_stato_riproduzione:
    'Request to the State Archive to search for and digitally copy an act in its holdings, with its supporting papers (allegati) and the banns file when asked, and to state costs and payment method. Asks where the supporting papers are if the archive does not hold them.',
  parrocchia_ricerca:
    'Polite request to the parish priest to search the parish registers for a baptism, marriage or burial, asking for a copy or extract and whether the registers were moved to the diocesan archive. Offers to cover costs or make a donation, without stating an amount.',
  militare_foglio_matricolare:
    'Request for a copy of a soldier’s service record (foglio matricolare or, for officers, stato di servizio) and any other service documents, for family-history research. Lists the soldier’s details and what is already known, notes when the death was more than 50 years ago (heirs’ consent not needed), asks to be told if another office holds the record, and asks for a PDF by e-mail.',
};

export function draftRequestLetter(
  store: Store,
  input: LetterInput,
  templatesDir: string,
  now = new Date(),
) {
  const notes: string[] = [];
  const ev = input.event ?? {};
  const person: PersonDetails = {
    ...input.person,
    father: input.person.father ?? input.parents?.father,
    mother: input.person.mother ?? input.parents?.mother,
    birth_date: input.person.birth_date ?? input.military?.birth_date,
    birth_place: input.person.birth_place ?? input.military?.birth_place,
  };
  const spouse: PersonDetails | undefined =
    typeof input.spouse === 'string' ? { given_names: input.spouse } : input.spouse;
  const eventYear = ev.year ?? yearOf(ev.date) ?? input.act?.year;
  const birthClass = input.military?.birth_class ?? yearOf(person.birth_date);
  const isMilitary = input.request_type === 'militare_foglio_matricolare';

  // Recipient, from the contact lookup.
  const officeType =
    input.request_type === 'comune_copia_integrale'
      ? 'stato_civile'
      : input.request_type === 'archivio_di_stato_riproduzione'
        ? 'archivio_di_stato'
        : input.request_type === 'parrocchia_ricerca'
          ? 'diocesi'
          : input.addressee === 'archivio_di_stato'
            ? 'archivio_di_stato'
            : 'ufficio_documentale_militare';
  const contact = findArchiveContact(store, {
    comune: input.comune,
    province: input.province,
    office_type: officeType,
  });
  const comuneToday = contact.comune.name;
  const contacts = contact.contacts as unknown as (Contact & { note?: string })[];
  const first = contacts[0];
  // "Corneto (oggi Tarquinia)" for a former name; "Civita, comune di Bagnoregio"
  // for a frazione or locality.
  const isPart = /\((frazione|locality|historical_alias)\)/.test(contact.resolved_from ?? '');
  const comuneAtto = !contact.resolved_from
    ? comuneToday
    : isPart
      ? `${input.comune}, comune di ${comuneToday}`
      : `${input.comune} (oggi ${comuneToday})`;
  notes.push(...((contact as { also_means?: string[] }).also_means ?? []));
  const mail = (c: Contact | undefined) =>
    c?.pec?.[0] ? `PEC: ${c.pec[0]}` : c?.email?.[0] ? `E-mail: ${c.email[0]}` : undefined;

  let recipient: string;
  if (input.request_type === 'parrocchia_ricerca') {
    recipient = block([
      'Al Reverendo Parroco',
      `Parrocchia ${input.parish?.name ?? '[DA COMPLETARE: nome della parrocchia]'}`,
      comuneAtto,
    ]);
    notes.push(
      `The parish address is not in our data. Find the parish and diocese in the official directory: ${String((contact.directory as { url?: string } | undefined)?.url ?? '')}`,
    );
  } else if (isMilitary && input.addressee === 'ministero_difesa') {
    notes.push(
      'Per the Army table (Persomil, "Guida matricolare"), PERSOMIL holds records of career officers from the 10th year after death (20th for generals). Reserve officers (di complemento), NCOs and enlisted men are at the documentation office of the place of birth. Source: https://www.difesa.it/assets/allegati/24820/tabella_sito_ei_2be_.2024.03.08.10.31.48.830.pdf',
    );
    const persomil = contacts.find((c) => /personale militare/i.test(c.name));
    recipient = block([
      'Spett.le Ministero della Difesa',
      'Direzione Generale per il Personale Militare (PERSOMIL)',
      '6ª Divisione – Servizio Documentazione Esercito',
      persomil?.address ?? null,
      mail(persomil) ?? null,
    ]);
  } else if (
    officeType === 'ufficio_documentale_militare' &&
    contacts[0] &&
    /^(Office|Probable office) for the province/.test((contacts[0] as { role?: string }).role ?? '')
  ) {
    const o = contacts[0];
    recipient = block([`Spett.le ${o.name}`, o.address, mail(o) ?? null]);
    if (!(o as { verified?: boolean }).verified) {
      notes.push(
        `The office for ${comuneToday} is inferred, not stated by the Army: check ${(o as { source_url?: string }).source_url ?? ''} before sending.`,
      );
    }
    const n = (o as { note?: string }).note;
    if (n) notes.push(n);
  } else if (officeType === 'ufficio_documentale_militare') {
    recipient = block([
      'All’Ufficio documentale dell’Esercito competente per il luogo di nascita',
      '[DA COMPLETARE: indirizzo e PEC dall’elenco ufficiale degli uffici documentali]',
    ]);
    notes.push(
      `Which Army documentation office covers ${comuneToday} is not in our data: see ${String((contact.directory as { url?: string } | undefined)?.url ?? '')}. For older birth classes the State Archive may hold the record instead (addressee "archivio_di_stato", or which_records_exist); for career officers from the 10th year after death (20th for generals), PERSOMIL (addressee "ministero_difesa"). Reserve officers (di complemento), NCOs and enlisted men: the documentation office of the place of birth.`,
    );
  } else if (first) {
    recipient = block([
      officeType === 'stato_civile'
        ? /^comune\b/i.test(first.name)
          ? `Al ${first.name}`
          : `Al Comune di ${comuneToday}`
        : `All’${first.name}`,
      officeType === 'stato_civile' ? 'Ufficio di stato civile' : null,
      first.address,
      mail(first) ?? null,
    ]);
  } else {
    recipient = `[DA COMPLETARE: ${LABELS.destinatario}]`;
  }

  const req = input.requester ?? {};
  const sender = req.name
    ? block([
        req.name,
        req.birth_place || req.birth_date
          ? join(' ', agree('nat', req.sex), at(req.birth_place), onDate(req.birth_date))
          : null,
        req.residence ?? null,
        req.contact ?? null,
      ])
    : undefined;

  const actRef = input.act?.number
    ? join('', `n. ${input.act.number}`, input.act.year && !eventYear ? ` (${input.act.year})` : '')
    : undefined;
  const banns = input.act?.banns?.number
    ? join(
        ' ',
        `registro delle pubblicazioni ${eventYear ?? ''}`.trim() + ',',
        `atto n. ${input.act.banns.number}`,
        input.act.banns.date && delDate(input.act.banns.date),
      )
    : undefined;
  const supportingPapers =
    input.act?.supporting_papers ??
    (input.request_type === 'archivio_di_stato_riproduzione' && ev.type === 'marriage');

  const deathYear = yearOf(person.death_date);
  let deathClause: string | undefined;
  if (isMilitary && deathYear !== undefined) {
    deathClause =
      deathYear <= now.getFullYear() - 50
        ? 'Essendo il decesso avvenuto da più di cinquant’anni, ritengo che non occorra l’assenso degli eredi; qualora fosse necessario, posso produrlo.'
        : 'Il decesso è avvenuto da meno di cinquant’anni: allego, se richiesto, l’assenso degli eredi.';
  }
  const militaryDoc =
    input.military?.document === 'stato_di_servizio' || input.addressee === 'ministero_difesa'
      ? 'dello stato di servizio'
      : 'del foglio matricolare';

  const values: Values = {
    mittente: sender,
    destinatario: recipient,
    richiedente: req.name,
    sottoscritto:
      req.sex === 'M'
        ? 'Il sottoscritto'
        : req.sex === 'F'
          ? 'La sottoscritta'
          : 'Il/La sottoscritto/a',
    relazione: req.relationship,
    persona: fullName(person),
    grado_persona: input.military?.rank
      ? `${/^[aeiou]/i.test(input.military.rank) ? 'dell’' : 'del '}${input.military.rank} ${fullName(person) ?? ''}`.trim()
      : `di ${fullName(person) ?? `[DA COMPLETARE: ${LABELS.persona}]`}`,
    intestazione_dati:
      militaryDoc === 'dello stato di servizio' ? 'Dati dell’ufficiale' : 'Dati del militare',
    scheda_persona: personCard(person),
    scheda_coniuge: personCard(spouse),
    evento: ev.type ? EVENT_IT[ev.type] : undefined,
    evento_parrocchia: ev.type ? EVENT_PARISH[ev.type] : undefined,
    serie: input.act?.series ?? (ev.type ? SERIES_IT[ev.type] : undefined),
    del_data_evento: ev.date && /^\d{4}-\d{2}-\d{2}$/.test(ev.date) ? delDate(ev.date) : undefined,
    data_o_anno: italianDate(ev.date) ?? (eventYear ? String(eventYear) : undefined),
    anno: eventYear ? String(eventYear) : undefined,
    comune_atto: comuneAtto,
    luogo_parrocchia: ev.place ?? comuneAtto,
    estremi_atto: actRef,
    allegati: supportingPapers ? 'sì' : undefined,
    pubblicazioni: banns,
    dettagli: input.details?.length ? input.details.map((d) => `• ${d}`).join('\n') : undefined,
    allega_discendenza: req.relationship ? 'sì' : undefined,
    classe: birthClass ? String(birthClass) : undefined,
    distretto: input.military?.district,
    matricola: input.military?.matricola
      ? join(
          ', ',
          input.military.matricola,
          input.military.register && `registro ${input.military.register}`,
        )
      : undefined,
    documento_militare: militaryDoc,
    clausola_decesso: deathClause,
    allega_modulo: isMilitary ? 'sì' : undefined,
    ringraziamento:
      input.request_type === 'parrocchia_ricerca'
        ? 'La ringrazio per l’attenzione.'
        : 'Vi ringrazio per l’attenzione.',
    luogo_data: req.place
      ? `${req.place}, ${italianDate(now.toISOString().slice(0, 10))}`
      : '______________________________',
  };

  const template = [
    loadTemplate(templatesDir, '_intestazione'),
    loadTemplate(templatesDir, input.request_type),
    loadTemplate(templatesDir, '_chiusura'),
  ].join('');
  const rendered = render(template, values, LABELS);
  const text = rendered.text.replace(/\n{3,}/g, '\n\n').trimEnd();
  const { missing } = rendered;
  const missingAll = [
    ...new Set([...missing, ...(recipient.includes('[DA COMPLETARE') ? ['destinatario'] : [])]),
  ];

  // An earlier province's archive (e.g. Roma for Tarquinia before 1928) may hold that year.
  for (const c of contacts.slice(1)) {
    const until = /until (\d{4})-/.exec(c.note ?? '')?.[1];
    if (
      input.request_type === 'archivio_di_stato_riproduzione' &&
      until &&
      eventYear &&
      eventYear <= Number(until)
    ) {
      notes.push(
        `${comuneToday} was in another province until ${until}; for ${eventYear} the record may be at the ${c.name} instead (${mail(c) ?? 'see find_archive_contact'}). Unconfirmed: check which_records_exist for this comune and year before writing.`,
      );
    }
  }
  // SPEC §2: recent events or people born after 1940 — the office decides access.
  const recentYear = isMilitary ? birthClass : eventYear;
  if (
    (recentYear !== undefined && recentYear > now.getFullYear() - RECENT_YEARS) ||
    (birthClass !== undefined && birthClass > BORN_AFTER)
  ) {
    notes.push(
      'The record may concern a living person or a recent event: the office decides whether and what it can release.',
    );
  }
  notes.push(
    'Fees and response times are not stated: the letter asks the office to give them.',
    'Check every detail before sending; this service does not send the letter.',
  );

  return {
    request_type: input.request_type,
    comune: contact.comune,
    ...(contact.resolved_from ? { resolved_from: contact.resolved_from } : {}),
    recipient: {
      text: recipient,
      verified: contact.verified,
      source: first ? (first as { source?: string }).source : null,
    },
    letter_it: text,
    gloss_en: GLOSS[input.request_type],
    attachments: ATTACHMENTS[input.request_type],
    missing_fields: missingAll.map((k) => ({ field: k, label: LABELS[k] ?? k })),
    notes,
  };
}
