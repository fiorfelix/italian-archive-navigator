import type { PlaceAt } from '../resolve/place-at.js';
import { REGIMES, type EventType, type Rule } from './schema.js';

export interface PlaceFacts extends PlaceAt {
  province_today: string;
  region_today: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/** How specific a rule's territory is; the most specific matching rule wins. */
export function specificity(r: Rule): number {
  const t = r.territory;
  let s = 0;
  if (t.comuni) s = Math.max(s, 100);
  if (t.provinces) s = Math.max(s, 50);
  if (t.first_provinces) s = Math.max(s, 40);
  if (t.joined_italy) s = Math.max(s, 30);
  if (t.regions) s = Math.max(s, 20);
  return s + (r.override ? 1000 : 0);
}

function territoryMatches(r: Rule, p: PlaceFacts): boolean {
  const t = r.territory;
  if (t.comuni && !t.comuni.includes(p.istat_code_today)) return false;
  if (t.provinces && !t.provinces.includes(p.province_today)) return false;
  if (t.regions && !t.regions.some((x) => norm(x) === norm(p.region_today))) return false;
  if (t.first_provinces && !(p.first_province && t.first_provinces.includes(p.first_province))) {
    return false;
  }
  if (t.joined_italy) {
    const j = t.joined_italy;
    if (j.in_1861 === true && p.joined_italy !== null) return false;
    if (j.in_1861 === false && p.joined_italy === null) return false;
    if ((j.from || j.to) && p.joined_italy === null) return false;
    if (j.from && p.joined_italy! < j.from) return false;
    if (j.to && p.joined_italy! > j.to) return false;
  }
  return true;
}

export interface RuleMatch {
  rule: Rule;
  /** The rule's period starts or ends inside the requested year. */
  boundary_year: boolean;
}

/** Rules matching place, year and event, most specific first. */
export function matchRules(
  rules: Rule[],
  place: PlaceFacts,
  y: number,
  event: EventType,
): RuleMatch[] {
  const start = `${y}-01-01`;
  const end = `${y}-12-31`;
  return rules
    .filter((r) => r.events.includes(event))
    .filter((r) => r.period.from <= end && r.period.to >= start)
    .filter((r) => territoryMatches(r, place))
    .map((rule) => ({
      rule,
      boundary_year:
        (rule.period.from > start && rule.period.from <= end) ||
        (rule.period.to >= start && rule.period.to < end),
    }))
    .sort((a, b) => specificity(b.rule) - specificity(a.rule));
}

export const regimeLabel = (r: Rule) => REGIMES[r.regime];
