import type { Comune, StateOffice, Store } from '../data/store.js';
import { lineageAt, TODAY } from './comune-history.js';
import { resolveComuneInput } from './comune-input.js';

export const OFFICE_TYPES = [
  'stato_civile',
  'archivio_di_stato',
  'ufficio_documentale_militare',
  'diocesi',
] as const;
export type OfficeType = (typeof OFFICE_TYPES)[number];

const ENTI_URL = 'https://indicepa.gov.it/ipa-dati/dataset/enti';
const UO_URL = 'https://indicepa.gov.it/ipa-dati/dataset/unita-organizzative';
const AOO_URL = 'https://indicepa.gov.it/ipa-dati/dataset/aoo';

const OFFICE_LABEL: Record<OfficeType, string> = {
  stato_civile: 'Ufficio di stato civile del Comune (civil registry office)',
  archivio_di_stato: 'Archivio di Stato (State Archive)',
  ufficio_documentale_militare: 'Ufficio documentale militare (military records office)',
  diocesi: 'Diocesi / archivio diocesano (diocese / diocesan archive)',
};

const address = (street: string | null, cap: string | null, place: string | null) =>
  [street, [cap, place].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null;

function stateContact(
  o: StateOffice,
  role: string,
  verified: boolean,
  extra: Record<string, unknown> = {},
) {
  return {
    role,
    name: o.name,
    address: address(o.address, o.cap, o.comune),
    pec: o.pec,
    source: `IndicePA, AOO ${o.aoo_code}`,
    source_url: AOO_URL,
    verified,
    ...extra,
  };
}

/** Provinces the comune belonged to before today's, from its dated history. */
function earlierProvinces(store: Store, comune: Comune) {
  const events = lineageAt(store, comune.istat_code, TODAY).events;
  const out = new Map<string, string>();
  for (const e of events) {
    if (e.report === 105 && e.province_abbr && e.province_abbr !== comune.province_abbr) {
      out.set(e.province_abbr, e.event_date);
    }
  }
  return [...out.entries()].map(([abbr, until]) => ({ abbr, until }));
}

export function findArchiveContact(
  store: Store,
  input: { comune: string; province?: string | undefined; office_type: OfficeType },
) {
  const { comune, resolved_from, also_means } = resolveComuneInput(store, input);
  const contacts: Record<string, unknown>[] = [];
  const notes: string[] = [];
  let directory: Record<string, unknown> | undefined;

  if (input.office_type === 'stato_civile') {
    const c = store.comuneContact(comune.istat_code);
    if (c) {
      contacts.push({
        role: 'Comune – protocollo generale (main address of the Comune)',
        name: c.name,
        address: address(c.address, c.cap, comune.name),
        pec: c.pec,
        website: c.website,
        source: `IndicePA, ente ${c.ipa_code}`,
        source_url: ENTI_URL,
        data_updated: c.updated,
        verified: true,
      });
    }
    for (const o of store.comuneOffices(comune.istat_code)) {
      contacts.push({
        role: 'Ufficio del Comune (servizi demografici / stato civile)',
        name: o.name,
        address: address(o.address, o.cap, comune.name),
        pec: o.emails.filter((e) => e.pec).map((e) => e.address),
        email: o.emails.filter((e) => !e.pec).map((e) => e.address),
        source: `IndicePA, unità organizzativa ${o.uo_code}`,
        source_url: UO_URL,
        data_updated: o.updated,
        verified: true,
      });
    }
    if (!contacts.length) {
      directory = {
        url: 'https://www.indicepa.gov.it/',
        note: 'No IndicePA entry found for this Comune; search the IndicePA portal.',
        verified: false,
      };
    } else {
      notes.push(
        'Requests can go to the Comune PEC; when a civil-registry office is listed, mention it in the subject.',
      );
    }
  }

  if (input.office_type === 'archivio_di_stato') {
    const map = store.archiveForProvince(comune.province_abbr);
    const office = map?.aoo_code ? store.stateOffice(map.aoo_code) : undefined;
    if (office && map) {
      contacts.push(
        stateContact(
          office,
          `Archivio di Stato for the province of ${comune.province_name} today`,
          map.verified,
          {
            ...(map.note ? { note: map.note } : {}),
          },
        ),
      );
    } else {
      directory = {
        url: 'https://indicepa.gov.it/ipa-dati/dataset/aoo',
        note: map?.note ?? 'No Archivio di Stato is mapped for this province.',
        verified: false,
      };
    }
    for (const p of earlierProvinces(store, comune)) {
      const m = store.archiveForProvince(p.abbr);
      const o = m?.aoo_code ? store.stateOffice(m.aoo_code) : undefined;
      if (o && o.aoo_code !== office?.aoo_code) {
        contacts.push(
          stateContact(o, `Archivio di Stato of an earlier province (${p.abbr})`, false, {
            note: `${comune.name} was in this province until ${p.until}. Series created before then may be held here; confirm with the archive.`,
          }),
        );
      }
    }
    notes.push(
      'Some State Archives have branch sections (sezioni) closer to the comune; these are not in IndicePA. Which series the archive holds for this comune is answered by which_records_exist.',
    );
  }

  if (input.office_type === 'ufficio_documentale_militare' || input.office_type === 'diocesi') {
    const p = store.pointer(input.office_type) as {
      title: string;
      rule: string;
      rule_source_url?: string;
      directory_url: string;
      directory_note: string;
      offices: string[];
      by_province?: {
        provinces: string[];
        name: string;
        address: string;
        pec: string;
        source_url: string;
        quote: string;
        note?: string;
        verified: boolean;
      }[];
    };
    // Curated offices whose own page states which provinces they cover.
    const local = (p.by_province ?? []).filter((o) => o.provinces.includes(comune.province_abbr));
    for (const o of local) {
      contacts.push({
        role: o.verified
          ? `Office for the province ${comune.province_abbr} (stated on its own page)`
          : `Probable office for the province ${comune.province_abbr} (not stated on its page)`,
        name: o.name,
        address: o.address,
        pec: [o.pec],
        source: o.quote,
        source_url: o.source_url,
        verified: o.verified,
        ...(o.note ? { note: o.note } : {}),
      });
    }
    const confirmed = local.some((o) => o.verified);
    if (confirmed) {
      // The office is known; keep the rule (who holds what) as a note.
      notes.push(p.rule);
    } else {
      directory = {
        title: p.title,
        rule: p.rule,
        ...(p.rule_source_url ? { rule_source_url: p.rule_source_url } : {}),
        url: p.directory_url,
        note: p.directory_note,
        verified: false,
      };
    }
    for (const code of confirmed ? [] : p.offices) {
      const o = store.stateOffice(code);
      if (o)
        contacts.push(
          stateContact(
            o,
            'Central office (contact verified; competence for this comune not confirmed)',
            true,
          ),
        );
    }
    if (input.office_type === 'ufficio_documentale_militare') {
      notes.push(
        `For enlisted men, the comune is taken as the place of birth: ${comune.name} (${comune.province_abbr}).`,
      );
    }
  }

  return {
    comune: {
      istat_code: comune.istat_code,
      name: comune.name,
      province: comune.province_abbr,
      region: comune.region_name,
    },
    ...(resolved_from ? { resolved_from } : {}),
    ...(also_means ? { also_means } : {}),
    office_type: OFFICE_LABEL[input.office_type],
    contacts,
    ...(directory ? { directory } : {}),
    verified: contacts.length > 0 && contacts.every((c) => c.verified === true) && !directory,
    notes,
    data: {
      refreshed_at: store.refreshedAt(),
      indicepa_downloaded: store.sourceDate('indicepa_enti') ?? null,
      attribution: 'Contains IndicePA (AgID) and ISTAT data, licensed under CC BY 4.0.',
    },
  };
}
