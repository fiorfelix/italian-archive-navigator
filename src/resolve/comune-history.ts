import { editDistance, normalizeName, variantKey } from '../data/normalize.js';
import type { Comune, ComuneEvent, NameHit, NameKind, Store } from '../data/store.js';
import { VARIATION_CODES } from '../refresh/sources.js';

export interface ResolveInput {
  name: string;
  province?: string | undefined;
  year?: number | undefined;
}

const MATCH_LABEL: Record<NameKind, string> = {
  current: 'current_name',
  current_other_language: 'current_name_other_language',
  historical: 'historical_name',
  alias: 'alias',
  locality: 'locality',
};

const LOCALITY_TYPE = {
  1: 'centro abitato (built-up centre)',
  2: 'nucleo abitato (hamlet)',
} as const;
const LOCALITY_LIMIT = 10;

const FRAZIONE = 'frazione (hamlet / locality within a comune)';
const TIMELINE_LIMIT = 40;
/** Above this many comune matches, timelines are left out to keep the answer short. */
const TIMELINE_MAX_MATCHES = 3;
const year = (date: string) => Number(date.slice(0, 4));

export interface CurrentRef {
  istat_code: string;
  name: string;
  province: string;
  province_name: string;
  region: string;
}

const ref = (c: Comune): CurrentRef => ({
  istat_code: c.istat_code,
  name: c.name,
  province: c.province_abbr,
  province_name: c.province_name,
  region: c.region_name,
});

const dedupe = (list: CurrentRef[]) => [...new Map(list.map((c) => [c.istat_code, c])).values()];

export const TODAY = '9999-12-31';
const START = '0000-01-01';

interface Segment {
  code: string;
  from: string;
  to: string;
}

/** One comune through time: the codes it held, with dates, and its events. */
export interface Lineage {
  key: string;
  segments: Segment[];
  events: ComuneEvent[];
}

const isCodeChange = (e: ComuneEvent) => e.report === 105 && !!e.rel_code;

/**
 * The comune that held `code` on `date`, followed backwards and forwards through its code
 * changes (report 105). ISTAT has reused codes for different comuni, so each step is
 * date-bound: going back, a code's period starts at the change that brought the comune to
 * it, and stops where an earlier holder of the code moved away from it.
 */
export function lineageAt(store: Store, code: string, date: string): Lineage {
  const segments: Segment[] = [];
  // Backwards.
  let cur = code;
  let t = date;
  for (let guard = 0; guard < 50; guard++) {
    // From the anchor date, a change into the code on that very day counts. Once we have
    // stepped back through a change at date t, another comune moving into the code on the
    // same day t is a renumbering cascade (e.g. Udine, 6 April 1968), not a predecessor.
    const into = store
      .eventsRelatedTo([cur])
      .filter(
        (e) =>
          isCodeChange(e) && e.code !== cur && (guard === 0 ? e.event_date <= t : e.event_date < t),
      )
      .at(-1);
    const out = store
      .eventsOf([cur])
      .filter((e) => isCodeChange(e) && e.rel_code !== cur && e.event_date < t)
      .at(-1);
    if (into && (!out || into.event_date >= out.event_date)) {
      segments.unshift({ code: cur, from: into.event_date, to: '' });
      cur = into.code;
      t = into.event_date;
      continue;
    }
    segments.unshift({ code: cur, from: out ? out.event_date : START, to: '' });
    break;
  }
  // Forwards from the starting code.
  const first = segments.at(-1)!;
  cur = code;
  t = date;
  for (let guard = 0; guard < 50; guard++) {
    const out = store
      .eventsOf([cur])
      .filter((e) => isCodeChange(e) && e.rel_code !== cur && e.event_date > t)
      .at(0);
    const seg = cur === code ? first : segments.at(-1)!;
    if (!out) {
      seg.to = TODAY;
      break;
    }
    seg.to = out.event_date;
    cur = out.rel_code!;
    t = out.event_date;
    segments.push({ code: cur, from: t, to: '' });
  }
  // Earlier segments end where the next one starts.
  for (let i = 0; i < segments.length - 1; i++) {
    if (!segments[i]!.to) segments[i]!.to = segments[i + 1]!.from;
  }
  const seen = new Set<string>();
  const events = segments
    .flatMap((sg) =>
      store.eventsOf([sg.code]).filter((e) => e.event_date >= sg.from && e.event_date <= sg.to),
    )
    .filter((e) => {
      const k = JSON.stringify(e);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((x, y) => (x.event_date < y.event_date ? -1 : x.event_date > y.event_date ? 1 : 0));
  return { key: segments.map((sg) => `${sg.code}@${sg.from}`).join('>'), segments, events };
}

/** Today's comune(s) for a lineage: itself if it still exists, else whoever absorbed it. */
export function currentOf(
  store: Store,
  lin: Lineage,
  seen = new Set<string>(),
): { comuni: CurrentRef[]; abroad: boolean } {
  if (seen.has(lin.key)) return { comuni: [], abroad: false };
  seen.add(lin.key);
  const life = lin.events.filter((e) => e.report === 98 || e.report === 100);
  const ended = life.at(-1)?.report === 98;
  const last = lin.segments.at(-1)!;
  const today = last.to === TODAY ? store.getComune(last.code) : undefined;
  if (today && !ended) return { comuni: [ref(today)], abroad: false };
  const ends = lin.events.filter((e) => e.report === 98);
  const lastDate = ends.at(-1)?.event_date;
  const out: CurrentRef[] = [];
  let abroad = false;
  for (const e of ends.filter((x) => x.event_date === lastDate)) {
    if (e.type === 'AS') abroad = true;
    else if (e.rel_code) {
      const next = currentOf(store, lineageAt(store, e.rel_code, e.event_date), seen);
      out.push(...next.comuni);
      abroad ||= next.abroad;
    }
  }
  return { comuni: dedupe(out), abroad };
}

function provinceNameAt(store: Store, code: string | null, y: number): string | undefined {
  if (!code) return undefined;
  const events = store.provinceEvents(code);
  const rename = events.find((e) => e.report === 114 && e.code === code && year(e.event_date) > y);
  if (rename) return rename.name;
  return (
    store.currentProvinceName(code) ??
    events.filter((e) => e.code === code).at(-1)?.name ??
    events.filter((e) => e.rel_code === code).at(-1)?.rel_name ??
    undefined
  );
}

function describe(e: ComuneEvent) {
  const out: Record<string, unknown> = {
    date: e.event_date,
    change: `${e.type} – ${VARIATION_CODES[e.type] ?? 'unknown code'}`,
    comune: e.name,
    istat_code: e.code,
    province: e.province_abbr,
  };
  if (e.report === 104) out.new_name = e.rel_name;
  else if (e.report === 105) {
    out.new_code = e.rel_code;
    out.new_province = e.rel_province_abbr;
    if (e.rel_name && e.rel_name !== e.name) out.new_name = e.rel_name;
  } else if (e.rel_name) {
    out.other_comune = e.rel_province_abbr ? `${e.rel_name} (${e.rel_province_abbr})` : e.rel_name;
  }
  if (e.report === 98 && e.flag === '1') out.split = 'territory divided between several comuni';
  return out;
}

interface Snapshot {
  name: string;
  province_abbr: string | null;
  province_code: string | null;
  istat_code: string;
}

const before = (e: ComuneEvent): Snapshot => ({
  name: e.name,
  province_abbr: e.province_abbr,
  province_code: e.province_code,
  istat_code: e.code,
});

/** Name, code and province of a comune lineage in a given year, from its dated events. */
export function statusAtYear(
  store: Store,
  events: ComuneEvent[],
  today: CurrentRef[],
  y: number,
): Record<string, unknown> {
  const life = events.filter((e) => e.report !== 103);
  const sameYear = life.filter((e) => year(e.event_date) === y);
  const next = life.find((e) => year(e.event_date) > y);
  const prev = life.filter((e) => year(e.event_date) < y).at(-1);
  const withProvince = (s: Snapshot) => ({
    name: s.name,
    istat_code: s.istat_code,
    province: s.province_abbr,
    province_name: provinceNameAt(store, s.province_code, y),
  });

  if (sameYear.length) {
    return {
      year: y,
      status: 'changed_that_year',
      before_change: withProvince(before(sameYear[0]!)),
      changes: sameYear.map(describe),
      explanation: `The comune changed during ${y}; records from that year may be filed under either situation. Check both.`,
    };
  }
  if (prev?.report === 98 && (!next || next.report === 100)) {
    const into = life.filter((e) => e.report === 98 && e.event_date === prev.event_date);
    return {
      year: y,
      status: prev.type === 'AS' ? 'abroad' : 'merged_into_another_comune',
      explanation:
        prev.type === 'AS'
          ? `${prev.name} was ceded to a foreign state on ${prev.event_date}.`
          : `In ${y} ${prev.name} was not a comune: on ${prev.event_date} it was merged into ${into.map((e) => e.rel_name).join(', ')}.` +
            (next ? ` It became a comune again on ${next.event_date}.` : ''),
      ...(prev.type === 'AS'
        ? {}
        : {
            part_of: into.map((e) => ({
              name: e.rel_name,
              istat_code: e.rel_code,
              province: e.rel_province_abbr,
            })),
          }),
    };
  }
  if (next?.report === 100) {
    return {
      year: y,
      status: next.type === 'AN' ? 'not_yet_part_of_italy' : 'not_yet_a_comune',
      explanation:
        next.type === 'AN'
          ? `In ${y} ${next.name} was not yet part of the Kingdom of Italy; it was annexed on ${next.event_date}.`
          : `In ${y} ${next.name} was not yet a separate comune; it was created on ${next.event_date}` +
            (next.rel_name ? ` from territory of ${next.rel_name}.` : '.'),
    };
  }
  if (next) {
    return { year: y, status: 'comune', ...withProvince(before(next)) };
  }
  const c = today[0];
  if (c && today.length === 1) {
    const cur = store.getComune(c.istat_code)!;
    return {
      year: y,
      status: 'comune',
      name: cur.name,
      istat_code: cur.istat_code,
      province: cur.province_abbr,
      province_name: provinceNameAt(store, cur.province_code, y) ?? cur.province_name,
    };
  }
  return { year: y, status: 'unknown', explanation: 'No dated record covers this year.' };
}

function provinceMatches(store: Store, wanted: string, today: CurrentRef[], events: ComuneEvent[]) {
  const w = normalizeName(wanted);
  const names = new Set<string>();
  for (const c of today) names.add(c.province).add(c.province_name);
  for (const e of events) {
    if (e.province_abbr) names.add(e.province_abbr);
    if (e.province_code) {
      const n = provinceNameAt(store, e.province_code, year(e.event_date));
      if (n) names.add(n);
    }
  }
  return [...names].some((n) => normalizeName(n) === w);
}

type Tier = { hits: NameHit[]; quality: string };
/** A tier computed only when the search reaches it (the fuzzy tier scans every name). */
type LazyTier = () => Tier | null;

/**
 * Candidate name matches, from most to least certain. Each tier is tried in turn until one
 * yields a match (after the province filter): exact; exact plus spelling variants of comune
 * names (so "Bagnaia" also finds the old comune "Bagnaja" when only same-named localities
 * match exactly); spelling variants; similar-looking names. The last tier is returned as a
 * function: it compares the name with every searchable name, so it runs only when no
 * earlier tier fits.
 */
function hitTiers(store: Store, name: string): (Tier | LazyTier)[] {
  const exact = store.findNamesByNorm(normalizeName(name));
  const v = variantKey(name);
  const variant = store.findNamesByVariant(v);
  const tiers: (Tier | LazyTier)[] = [];
  if (exact.length) tiers.push({ hits: exact, quality: 'exact' });
  const variantComuni = variant.filter(
    (h) => h.kind !== 'locality' && !exact.some((e) => e.name === h.name && e.ref === h.ref),
  );
  if (exact.length && !exact.some((h) => h.kind !== 'locality') && variantComuni.length) {
    tiers.push({ hits: [...exact, ...variantComuni], quality: 'exact_and_spelling_variant' });
  }
  if (variant.length) tiers.push({ hits: variant, quality: 'spelling_variant' });
  // Very short keys (e.g. "zzzz" folds to "z") would match almost anything.
  if (v.length >= 4) {
    tiers.push(() => {
      const max = v.length <= 6 ? 1 : 2;
      const fuzzy = store
        .allVariants()
        .map((x) => ({ x, d: editDistance(v, x.variant, max) }))
        .filter((r) => r.d <= max)
        .sort((a, b) => a.d - b.d)
        .slice(0, 10)
        .map((r) => ({ name: r.x.name, kind: r.x.kind, ref: r.x.ref, ref_date: r.x.ref_date }));
      return fuzzy.length ? { hits: fuzzy, quality: 'fuzzy' } : null;
    });
  }
  return tiers;
}

function localityEntries(
  store: Store,
  hits: NameHit[],
  input: ResolveInput,
  aliasKeys: Set<string>,
) {
  const out: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    for (const loc of store.localitiesByNorm(normalizeName(hit.name))) {
      if (loc.istat_code !== hit.ref || seen.has(loc.loc_id)) continue;
      seen.add(loc.loc_id);
      const lin = lineageAt(store, loc.istat_code, '2021-12-31');
      const { comuni } = currentOf(store, lin);
      if (comuni.some((c) => aliasKeys.has(`${normalizeName(loc.name)}|${c.istat_code}`))) continue;
      const events = lin.events;
      if (input.province && !provinceMatches(store, input.province, comuni, events)) continue;
      const entry: Record<string, unknown> = {
        matched_name: loc.name,
        match: 'locality',
        locality: {
          type: LOCALITY_TYPE[loc.type],
          source: 'ISTAT census 2021 (Basi territoriali)',
          istat_locality_id: loc.loc_id,
          verified: true,
        },
        current_comuni: comuni,
      };
      if (input.year !== undefined) {
        entry.comune_at_year = statusAtYear(store, events, comuni, input.year);
        entry.locality_note = `The locality belonged to this comune in the 2021 census; in ${input.year} boundaries may have differed.`;
      }
      out.push(entry);
    }
  }
  return out;
}

export function resolveComuneHistory(store: Store, input: ResolveInput) {
  const tiers = hitTiers(store, input.name);
  let first: ReturnType<typeof resolveWith> | undefined;
  for (const [i, entry] of tiers.entries()) {
    const tier = typeof entry === 'function' ? entry() : entry;
    if (!tier) continue;
    const result = resolveWith(store, input, tier.hits, tier.quality);
    first ??= result;
    const provinceMiss = result.notes.some((n) => n.startsWith('No match in province'));
    if (!result.matches.length || provinceMiss) continue;
    // When exact hits are only localities, prefer the tier that adds variant comune names.
    const next = tiers[i + 1];
    if (
      tier.quality === 'exact' &&
      typeof next !== 'function' &&
      next?.quality === 'exact_and_spelling_variant'
    ) {
      continue;
    }
    return result;
  }
  // Nothing fits the province: show the most certain tier with its "no match" note.
  return first ?? resolveWith(store, input, [], 'none');
}

function resolveWith(store: Store, input: ResolveInput, allHits: NameHit[], quality: string) {
  const hits = allHits.filter((h) => h.kind !== 'locality');
  const localityHits = allHits.filter((h) => h.kind === 'locality');
  const notes: string[] = [];

  // Group hits by comune lineage: one match per comune, however many names matched.
  const groups = new Map<string, { hits: NameHit[]; lin: Lineage }>();
  for (const hit of hits) {
    const lin = lineageAt(store, hit.ref, hit.ref_date);
    const key = `${hit.kind === 'alias' ? 'alias:' : ''}${lin.key}`;
    const g = groups.get(key) ?? { hits: [], lin };
    g.hits.push(hit);
    groups.set(key, g);
  }

  let candidates = [...groups.values()].map((g) => {
    const { comuni, abroad } = currentOf(store, g.lin);
    return { hits: g.hits, events: g.lin.events, current: comuni, abroad };
  });

  if (input.province) {
    const filtered = candidates.filter((c) =>
      provinceMatches(store, input.province!, c.current, c.events),
    );
    if (filtered.length) candidates = filtered;
    else if (candidates.length) {
      notes.push(`No match in province "${input.province}"; showing matches in other provinces.`);
    }
  }

  const withTimeline = candidates.length <= TIMELINE_MAX_MATCHES;
  if (!withTimeline) {
    notes.push(
      `${candidates.length} comuni match, so timelines are left out. Give the province or the exact name to see a comune's history.`,
    );
  }
  const matches = candidates.map((c) => {
    const hit = c.hits[0]!;
    const alias =
      hit.kind === 'alias'
        ? store.aliasesByNorm(normalizeName(hit.name)).find((a) => a.istat_code === hit.ref)
        : undefined;
    const names = [
      ...new Set(
        c.events
          .filter((e) => e.report !== 103)
          .flatMap((e) => [e.name, e.report === 104 ? e.rel_name : null]),
      ),
    ].filter((n): n is string => !!n);
    const entry: Record<string, unknown> = {
      matched_name: hit.name,
      match: alias ? alias.kind : MATCH_LABEL[hit.kind],
      current_comuni: c.current,
    };
    if (c.abroad) entry.ceded_abroad = true;
    if (alias) {
      entry.alias = {
        type: alias.kind === 'frazione' ? FRAZIONE : 'historical alias',
        note: alias.note,
        source_url: alias.source_url,
        verified: alias.verified,
      };
    } else {
      if (names.length) entry.names_used = names;
      if (input.year !== undefined)
        entry.at_year = statusAtYear(store, c.events, c.current, input.year);
      const timeline = c.events.map(describe);
      if (withTimeline) {
        entry.timeline = timeline.slice(-TIMELINE_LIMIT);
        if (timeline.length > TIMELINE_LIMIT) {
          entry.timeline_note = `Showing the latest ${TIMELINE_LIMIT} of ${timeline.length} recorded changes.`;
        }
        if (!timeline.length) entry.timeline_note = 'No recorded changes since 17/03/1861.';
      } else entry.recorded_changes = timeline.length;
    }
    return entry;
  });

  const aliasKeys = new Set(
    matches
      .filter((m) => m.match === 'frazione' || m.match === 'historical_alias')
      .flatMap((m) =>
        (m.current_comuni as CurrentRef[]).map(
          (c) => `${normalizeName(m.matched_name as string)}|${c.istat_code}`,
        ),
      ),
  );
  const localities = localityEntries(store, localityHits, input, aliasKeys);
  const comuneMatchCount = matches.filter(
    (m) => m.match !== 'frazione' && m.match !== 'historical_alias',
  ).length;
  let otherLocalities: Record<string, unknown> | undefined;
  if (comuneMatchCount === 0) {
    matches.push(...localities.slice(0, LOCALITY_LIMIT));
    if (localities.length > LOCALITY_LIMIT) {
      notes.push(
        `${localities.length} localities match; showing ${LOCALITY_LIMIT}. Give the province to narrow it down.`,
      );
    }
  } else if (localities.length) {
    otherLocalities = {
      note: 'Localities (frazioni, hamlets) with the same name, from the 2021 census.',
      total: localities.length,
      shown: localities.slice(0, LOCALITY_LIMIT).map((l) => ({
        name: l.matched_name,
        type: (l.locality as { type: string }).type,
        comune: (l.current_comuni as CurrentRef[])
          .map((c) => `${c.name} (${c.province})`)
          .join(', '),
      })),
    };
  }

  let confidence: string;
  if (!matches.length) {
    confidence = 'No match. Check the spelling, or give the province.';
  } else if (quality === 'spelling_variant' || quality === 'fuzzy') {
    confidence = `No exact match; these are ${quality === 'fuzzy' ? 'similar-looking names' : 'spelling variants (j/i, double letters)'}. Confirm before relying on them.`;
  } else {
    const targets = new Set(
      matches.flatMap((m) => (m.current_comuni as CurrentRef[]).map((x) => x.istat_code)),
    );
    confidence =
      targets.size > 1
        ? `Ambiguous: "${input.name}" matches places in ${targets.size} different comuni today. Give the province to narrow it down.`
        : 'Single match.';
  }

  if (input.year !== undefined && input.year < 1861) {
    notes.push(
      'ISTAT records start on 17 March 1861 (Unification). For earlier years the status shown is the earliest recorded one; boundaries and names may have differed.',
    );
  }
  notes.push(
    'Province codes for 1861–1947 follow ISTAT convention: the abbreviation of the corresponding province as of 1948.',
  );

  return {
    query: { name: input.name, province: input.province ?? null, year: input.year ?? null },
    match_quality: matches.length ? quality : 'none',
    confidence_note: confidence,
    matches,
    ...(otherLocalities ? { also_localities: otherLocalities } : {}),
    notes,
    data: {
      refreshed_at: store.refreshedAt(),
      attribution: 'Contains ISTAT data, licensed under CC BY 4.0.',
      sources: [...new Set(store.sources().map((s) => s.page_url))],
    },
  };
}
