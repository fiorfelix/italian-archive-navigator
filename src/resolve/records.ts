import type { Store } from '../data/store.js';
import { matchRules, regimeLabel, type PlaceFacts } from '../rules/engine.js';
import type { EventType, Rule } from '../rules/schema.js';
import { seriesCoverage, type SeriesFile } from '../rules/series.js';
import { variantKey } from '../data/normalize.js';
import { resolveComuneInput } from './comune-input.js';
import { placeAt } from './place-at.js';

/** SPEC §2: events less than this many years ago are routed to the Comune. */
export const RECENT_YEARS = 100;
/** SPEC §2: people born after this year are routed to the Comune. */
export const BORN_AFTER = 1940;

const EVENT_LABEL: Record<EventType, { it: string; en: string }> = {
  birth: { it: 'nascita', en: 'birth' },
  marriage: { it: 'matrimonio', en: 'marriage' },
  death: { it: 'morte', en: 'death' },
  military: { it: 'servizio militare (classe di nascita)', en: 'military service (birth class)' },
};

const ACCESS_SOURCE =
  'https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:2000-11-03;396~art107';

export interface RecordsInput {
  comune: string;
  province?: string | undefined;
  year: number;
  event: EventType;
  person_birth_year?: number | undefined;
}

function ruleOut(r: Rule) {
  return {
    id: r.id,
    title: r.title,
    file: `data/rules/it/${r.override ? 'overrides/' : ''}${r.file}`,
    version: r.version,
    source_url: r.source_url,
    verified: r.verified,
    reviewed_for: r.reviewed_for,
  };
}

export function whichRecordsExist(
  store: Store,
  rules: Rule[],
  input: RecordsInput,
  now = new Date(),
  series: SeriesFile[] = [],
) {
  const { comune, resolved_from, also_means } = resolveComuneInput(store, input);
  const place = placeAt(store, comune.istat_code, input.year);
  const facts: PlaceFacts = {
    ...place,
    province_today: comune.province_abbr,
    region_today: comune.region_name,
  };
  const notes: string[] = [...(also_means ?? [])];
  if (place.via_parent) {
    notes.push(
      `${place.via_parent.name} became a comune on ${place.via_parent.created}; for ${input.year} its territory belonged to ${place.via_parent.parent_name ?? 'another comune'}, whose records apply.`,
    );
  }

  const currentYear = now.getFullYear();
  const birthYear = input.event === 'military' ? input.year : input.person_birth_year;
  const recent = input.year > currentYear - RECENT_YEARS;
  const bornLate = birthYear !== undefined && birthYear > BORN_AFTER;

  const matches = matchRules(rules, facts, input.year, input.event);
  const best = matches[0];
  const base = {
    comune: {
      istat_code: comune.istat_code,
      name_today: comune.name,
      province_today: comune.province_abbr,
      region_today: comune.region_name,
      in_that_year: {
        name: place.name_at,
        province: place.province_at,
        status: place.status.status,
        ...(place.joined_italy ? { joined_kingdom_of_italy: place.joined_italy } : {}),
      },
    },
    ...(resolved_from ? { resolved_from } : {}),
    event: { type: input.event, ...EVENT_LABEL[input.event], year: input.year },
  };

  if (recent || bornLate) {
    return {
      ...base,
      routed_to_comune: true,
      access_note:
        `${recent ? `The event is less than ${RECENT_YEARS} years old` : `The person was born after ${BORN_AFTER}`}, so the record may concern a living person. ` +
        'Ask the Comune (Ufficio di stato civile): the office decides whether and what it can release. ' +
        'This routing is a policy of this service; by law (DPR 396/2000, art. 107) a full copy (copia integrale) is issued to whoever shows an interest, without a fixed time limit.',
      access_source_url: ACCESS_SOURCE,
      holders: [
        {
          what: {
            it: 'Atto presso l’Ufficio di stato civile del Comune',
            en: 'Record at the Comune civil registry office',
          },
          office_type: 'stato_civile',
        },
      ],
      ...(best
        ? {
            regime: { code: best.rule.regime, ...regimeLabel(best.rule) },
            rule: ruleOut(best.rule),
          }
        : {}),
      notes,
    };
  }

  if (!best) {
    return {
      ...base,
      regime: null,
      notes: [
        ...notes,
        'No rule covers this place, year and event yet. Try the parish (registri parrocchiali) and the diocesan archive.',
      ],
    };
  }

  const r = best.rule;
  const reviewed = r.reviewed_for.some((x) => x.toLowerCase() === comune.region_name.toLowerCase());
  if (!reviewed) {
    notes.push(
      `This rule has not yet been reviewed for ${comune.region_name}; treat it as a general guide.`,
    );
  }
  if (!r.verified)
    notes.push('This rule is not yet confirmed from an official source (verified: false).');
  if (best.boundary_year) {
    notes.push(`The regime changed during ${input.year}; check the alternatives below as well.`);
  }
  // Archive-specific overrides already say where the records are; the generic hint could contradict them.
  if (
    !r.override &&
    r.holders.some((h) => h.office_type === 'archivio_di_stato') &&
    place.province_at
  ) {
    notes.push(
      `In ${input.year} the comune was in the province ${place.province_at}; the Archivio di Stato of that province is the first place to ask (find_archive_contact gives today's contacts).`,
    );
  }

  // Year-level coverage of State Archive series (e.g. missing years), when the archive is a holder.
  const coverage =
    input.event !== 'military' && r.holders.some((h) => h.office_type === 'archivio_di_stato')
      ? seriesCoverage(series, place.istat_code_today, input.year)
      : [];
  // When the question names one of several series of the same comune today (e.g. Bagnaia,
  // now part of Viterbo), show only that one.
  const asked = variantKey(input.comune);
  const named = coverage.filter((c) => variantKey(c.series) === asked);
  const shownCoverage = named.length ? named : coverage;

  const alternatives = matches
    .slice(1)
    // National defaults are only worth showing when the regime changes during the year.
    .filter((m) => !m.rule.territory.national || best.boundary_year || m.boundary_year)
    .filter((m) => best.boundary_year || m.boundary_year || m.rule.regime !== r.regime)
    .slice(0, 3)
    .map((m) => ({
      regime: { code: m.rule.regime, ...regimeLabel(m.rule) },
      rule: ruleOut(m.rule),
      boundary_year: m.boundary_year,
    }));

  return {
    ...base,
    routed_to_comune: false,
    regime: { code: r.regime, ...regimeLabel(r) },
    records: r.records,
    holders: r.holders,
    fallbacks: r.fallbacks,
    ...(r.notes?.length ? { rule_notes: r.notes } : {}),
    rule: { ...ruleOut(r), reviewed_for_this_region: reviewed },
    ...(shownCoverage.length ? { archive_series: shownCoverage } : {}),
    ...(alternatives.length ? { also_consider: alternatives } : {}),
    notes,
  };
}
