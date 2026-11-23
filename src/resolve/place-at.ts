import type { ComuneEvent, Store } from '../data/store.js';
import { currentOf, lineageAt, statusAtYear, TODAY, type Lineage } from './comune-history.js';

/** Where a comune (identified by today's ISTAT code) stood in a given year. */
export interface PlaceAt {
  /** The comune whose history applies in that year: itself, or the comune it was created from. */
  istat_code_today: string;
  status: Record<string, unknown>;
  /** Name and province abbreviation in force in that year, when known. */
  name_at: string | null;
  province_at: string | null;
  /** Province at the first recorded date (1861, or the date it joined Italy). */
  first_province: string | null;
  /** Date the territory joined the Kingdom of Italy, per ISTAT (null = already in 1861). */
  joined_italy: string | null;
  /** Set when the comune did not exist yet and its parent comune is used instead. */
  via_parent?: { name: string; created: string; parent_name: string | null };
}

const year = (d: string) => Number(d.slice(0, 4));

function firstProvince(events: ComuneEvent[], fallback: string | null): string | null {
  const life = events.filter((e) => e.report !== 103);
  const first = life[0];
  if (!first) return fallback;
  // A creation or annexation event records the province at that moment; any other event
  // records the province held before it.
  return first.province_abbr ?? fallback;
}

const dayBefore = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** Where the comune with today's code `istatCode` stood in year `y`. */
export function placeAt(store: Store, istatCode: string, y: number): PlaceAt {
  return placeOfLineage(store, lineageAt(store, istatCode, TODAY), istatCode, y, 0);
}

function placeOfLineage(
  store: Store,
  lin: Lineage,
  istatCodeToday: string,
  y: number,
  depth: number,
): PlaceAt {
  const today = store.getComune(istatCodeToday);
  const { comuni } = currentOf(store, lin);
  const status = statusAtYear(store, lin.events, comuni, y);
  const annexed = lin.events.find((e) => e.report === 100 && e.type === 'AN');
  const created = lin.events.find((e) => e.report === 100 && e.type === 'CS');

  // Before a comune was created, its territory belonged to the comune it came from: follow
  // that comune's own history as it stood the day before (not its successor today).
  if (created && y < year(created.event_date) && created.rel_code && depth < 10) {
    const parent = lineageAt(store, created.rel_code, dayBefore(created.event_date));
    const p = placeOfLineage(store, parent, istatCodeToday, y, depth + 1);
    return {
      ...p,
      via_parent: p.via_parent ?? {
        name: created.name,
        created: created.event_date,
        parent_name: created.rel_name,
      },
    };
  }

  return {
    istat_code_today: istatCodeToday,
    status,
    name_at: typeof status.name === 'string' ? status.name : null,
    province_at:
      typeof status.province === 'string' ? status.province : (today?.province_abbr ?? null),
    first_province: firstProvince(lin.events, today?.province_abbr ?? null),
    joined_italy: annexed ? annexed.event_date : null,
  };
}
