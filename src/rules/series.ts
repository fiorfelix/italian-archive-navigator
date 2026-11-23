import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import * as z from 'zod/v4';
import { RulesError } from './loader.js';

const year = z.number().int().min(1500).max(2100);

const seriesFile = z.object({
  version: z.number().int().positive(),
  archive: z.string().min(1),
  fonds: z.string().min(1),
  source_url: z.url(),
  source_date: z.string().optional(),
  read_on: z.string(),
  verified: z.boolean(),
  notes: z.array(z.string()).optional(),
  series: z.array(
    z.object({
      name: z.string().min(1),
      istat_code_today: z
        .string()
        .regex(/^\d{6}$/)
        .nullable(),
      comune_today: z.string().nullable(),
      from: year,
      to: year,
      missing_years: z.array(year).optional(),
      single_register_years: z.array(year).optional(),
      inventory_note: z.string().optional(),
    }),
  ),
});
export type SeriesFile = z.infer<typeof seriesFile>;

/** Year coverage of State Archive series by comune (data/curated/archive-series/<country>/). */
export function loadSeries(dir: string): SeriesFile[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.yaml'));
  } catch {
    return [];
  }
  return files.sort().map((f) => {
    const r = seriesFile.safeParse(parse(readFileSync(join(dir, f), 'utf8')) as unknown);
    if (!r.success) throw new RulesError(`Invalid series file ${f}:\n${z.prettifyError(r.error)}`);
    return r.data;
  });
}

/** What the State Archive series say about one comune (today's code) in one year. */
export function seriesCoverage(files: SeriesFile[], istatCode: string, y: number) {
  return files.flatMap((f) =>
    f.series
      .filter((s) => s.istat_code_today === istatCode)
      .map((s) => {
        let status: 'present' | 'outside_range' | 'missing' | 'single_register';
        let text: string;
        const label = s.name === s.comune_today ? s.name : `${s.name} (today ${s.comune_today})`;
        if (y < s.from || y > s.to) {
          status = 'outside_range';
          text = `${f.archive}: the series for ${label} covers ${s.from}–${s.to}; ${y} is outside it, so ask the Comune.`;
        } else if (s.missing_years?.includes(y)) {
          status = 'missing';
          text = `${f.archive}: ${y} is missing from the series for ${label}; ask the Comune for the first original.`;
        } else if (s.single_register_years?.includes(y)) {
          status = 'single_register';
          text = `${f.archive}: for ${y} only one register survives in the series for ${label}, so some act types may be missing.`;
        } else {
          status = 'present';
          text = `${f.archive}: ${y} is listed in the series for ${label} (${s.from}–${s.to}).`;
        }
        return {
          archive: f.archive,
          series: s.name,
          from: s.from,
          to: s.to,
          year: y,
          status,
          text,
          source_url: f.source_url,
          verified: f.verified,
        };
      }),
  );
}
