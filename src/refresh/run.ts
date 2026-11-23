import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { readSheet } from 'read-excel-file/node';
import { DATA_DIR, DB_PATH, SERVER_NAME, SERVER_VERSION } from '../config.js';
import { loadAliases, toAlias } from '../curated/aliases.js';
import { loadOffices } from '../curated/offices.js';
import { normalizeName } from '../data/normalize.js';
import type { ComuneEvent, ProvinceEvent } from '../data/store.js';
import { buildDatabase, type SourceRecord } from './build.js';
import {
  checkIndicePaMetadata,
  matchComuneContacts,
  parseComuneContacts,
  parseComuneOffices,
  parseStateOffices,
} from './indicepa.js';
import { parseDelimited } from './csv.js';
import {
  checkSituasMetadata,
  parseIstatComuni,
  parseLocalita,
  situasRowsFromCsv,
  situasRowsFromJson,
  toComuneEvents,
  toProvinceEvents,
  type SituasRow,
} from './parse.js';
import {
  ISTAT_COMUNI,
  ISTAT_LICENCE,
  INDICEPA_AOO,
  INDICEPA_API,
  INDICEPA_ENTI,
  INDICEPA_LICENCE_ID,
  INDICEPA_UO,
  ISTAT_LOCALITA,
  type IndicePaDef,
  SITUAS_API_DOCS,
  SITUAS_REPORTS,
  situasUrls,
  type SituasReportDef,
} from './sources.js';
import { writeSourcesMd } from './sources-md.js';

const USER_AGENT = `${SERVER_NAME}/${SERVER_VERSION} (open-data refresh)`;
const TIMEOUT_MS = 180_000;
const MANUAL_DIR = `${DATA_DIR}/manual`;
const RAW_DIR = `${DATA_DIR}/raw`;

const sha256 = (buf: Uint8Array) => createHash('sha256').update(buf).digest('hex');

/** Waits before the 2nd and 3rd attempt after a dropped connection, 429 or 5xx. */
export const RETRY_WAITS_MS = [15_000, 60_000];
const MAX_RETRY_AFTER_MS = 300_000;

const isRetryable = (status: number) => status === 429 || status >= 500;

/**
 * Downloads a URL. A dropped connection, 429 or 5xx is tried again up to twice, after a
 * pause (the site's Retry-After when it gives one, up to 5 minutes); other errors fail at once.
 */
export async function httpGet(
  url: string,
  doFetch: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<Uint8Array> {
  for (let attempt = 0; ; attempt++) {
    const last = attempt >= RETRY_WAITS_MS.length;
    let wait = RETRY_WAITS_MS[attempt] ?? 0;
    let res: Response;
    try {
      res = await doFetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      if (!last) {
        console.log(`  network error, trying again in ${wait / 1000} s`);
        await sleep(wait);
        continue;
      }
      const cause =
        err instanceof Error && err.cause instanceof Error ? ` (${err.cause.message})` : '';
      throw new Error(
        `Network error fetching ${url}: ${err instanceof Error ? err.message : err}${cause}. Check the connection and re-run.`,
        { cause: err },
      );
    }
    if (res.ok) return new Uint8Array(await res.arrayBuffer());
    if (!isRetryable(res.status) || last) throw new Error(`HTTP ${res.status} for ${url}`);
    const retryAfter = Number(res.headers.get('retry-after'));
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      wait = Math.min(retryAfter * 1000, MAX_RETRY_AFTER_MS);
    }
    console.log(`  HTTP ${res.status}, trying again in ${wait / 1000} s`);
    await sleep(wait);
  }
}

async function checkLicence(): Promise<void> {
  const html = new TextDecoder().decode(await httpGet(ISTAT_LICENCE.url));
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|\u00a0/g, ' ')
    .replace(/\s+/g, ' ');
  if (!text.includes(ISTAT_LICENCE.marker) || !/Creative Commons/.test(text)) {
    throw new Error(
      `The licence statement on ${ISTAT_LICENCE.url} has changed. Read the page, update ISTAT_LICENCE in src/refresh/sources.ts, then re-run.`,
    );
  }
}

/** Fetches a URL and parses it as JSON. Injected so tests can run without a network. */
export type JsonGetter = (url: string) => Promise<{ bytes: Uint8Array; json: unknown }>;

const getJson: JsonGetter = async (url) => {
  const bytes = await httpGet(url);
  return { bytes, json: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
};

export function findManualFile(def: SituasReportDef, manualDir: string): string | undefined {
  let files: string[];
  try {
    files = readdirSync(manualDir);
  } catch {
    return undefined;
  }
  const prefixes = [normalizeName(def.title), normalizeName(`situas_${def.report_id}`)];
  return files
    .filter(
      (f) =>
        f.toLowerCase().endsWith('.csv') &&
        prefixes.some((p) => normalizeName(f.replace(/\.csv$/i, '')).startsWith(p)),
    )
    .map((f) => `${manualDir}/${f}`)
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

export type SituasResult =
  | {
      route: 'api' | 'manual';
      bytes: Uint8Array;
      rows: SituasRow[];
      fileName: string;
      downloadedAt: string;
      warning?: string;
    }
  | { failure: string };

const firstLine = (err: unknown) =>
  err instanceof Error ? err.message.split('\n')[0]! : String(err);

/**
 * Gets one SITUAS report from the documented public service: checks the published column
 * list, downloads the rows and compares them with the published row count. If anything
 * fails, uses a CSV the user exported by hand into `manualDir`; with neither, returns a
 * failure so the caller can ask the user for a manual download.
 */
export async function obtainSituas(
  def: SituasReportDef,
  get: JsonGetter,
  manualDir: string,
): Promise<SituasResult> {
  const urls = situasUrls(def);
  let apiError: string;
  try {
    checkSituasMetadata(def, (await get(urls.metadata)).json);
    const { bytes, json } = await get(urls.data);
    const rows = situasRowsFromJson(def, json);
    const count = (await get(urls.count)).json as { resultset?: { NUM_ROWS?: number }[] };
    const expected = count.resultset?.[0]?.NUM_ROWS;
    if (expected !== rows.length) {
      throw new Error(`row count ${rows.length} differs from the published count ${expected}`);
    }
    return {
      route: 'api',
      bytes,
      rows,
      fileName: `situas_${def.report_id}.json`,
      downloadedAt: new Date().toISOString(),
    };
  } catch (err) {
    apiError = firstLine(err);
  }
  const manual = findManualFile(def, manualDir);
  if (!manual) return { failure: `API failed (${apiError}) and no CSV in ${manualDir}` };
  const bytes = new Uint8Array(readFileSync(manual));
  let rows: SituasRow[];
  try {
    rows = situasRowsFromCsv(def, parseDelimited(new TextDecoder().decode(bytes)));
  } catch (err) {
    return {
      failure: `API failed (${apiError}); the manual file ${manual} has unexpected columns: ${firstLine(err)}`,
    };
  }
  const savedAt = statSync(manual).mtime.toISOString();
  return {
    route: 'manual',
    bytes,
    rows,
    fileName: manual.split('/').at(-1)!,
    downloadedAt: savedAt,
    warning: `API failed (${apiError}). Using MANUAL file ${manual} (saved ${savedAt}).`,
  };
}

export function manualInstructions(
  failed: { def: SituasReportDef; reason: string }[],
  manualDir: string,
): string {
  const lines = [
    '',
    '================ MANUAL DOWNLOAD NEEDED ================',
    'The SITUAS service could not be used for the report(s) below. Please export them by hand:',
    '',
  ];
  failed.forEach(({ def, reason }, i) => {
    lines.push(
      `${i + 1}. SITUAS report ${def.report_id}: ${def.title}`,
      `   Problem: ${reason}`,
      '   Open https://situas.istat.it/web/#/variazioni, choose this report, set the period',
      '   from 17/03/1861 to today, export as CSV, and save the file unchanged into:',
      `   ${manualDir}/`,
      `   (name it situas_${def.report_id}.csv, or keep a name starting with "${def.title}")`,
      '',
    );
  });
  lines.push('Then run "npm run refresh-data" again. The previous database was kept.');
  lines.push('========================================================');
  return lines.join('\n');
}

interface CkanPackage {
  success?: boolean;
  result?: {
    license_id?: string;
    license_title?: string;
    license_url?: string;
    resources?: { format?: string; name?: string; url?: string }[];
  };
}

/**
 * Downloads one IndicePA dataset via the CKAN API: checks the licence and the published data
 * dictionary, then returns the data file as table rows.
 */
export async function obtainIndicePa(
  def: IndicePaDef,
  get: JsonGetter,
  download: (url: string) => Promise<Uint8Array>,
): Promise<{ rows: unknown[][]; bytes: Uint8Array; record: SourceRecord }> {
  const pkg = (await get(`${INDICEPA_API}${def.package_id}`)).json as CkanPackage;
  const r = pkg.result;
  if (!pkg.success || !r) throw new Error(`IndicePA package "${def.package_id}" not found.`);
  if (r.license_id !== INDICEPA_LICENCE_ID) {
    throw new Error(
      `${def.title}: licence is now "${r.license_id}" (${r.license_title}); expected ${INDICEPA_LICENCE_ID}. Review before using it.`,
    );
  }
  const resources = r.resources ?? [];
  const data = resources.find((x) => x.format === def.data_format);
  const meta = resources.find((x) => x.format === 'JSON' && /metadata/i.test(x.name ?? ''));
  if (!data?.url || !meta?.url) {
    throw new Error(`${def.title}: data or metadata resource missing from ${def.page_url}.`);
  }
  checkIndicePaMetadata(def, (await get(meta.url)).json);
  const bytes = await download(data.url);
  const rows =
    def.data_format === 'XLSX'
      ? ((await readSheet(Buffer.from(bytes))) as unknown[][])
      : parseDelimited(new TextDecoder().decode(bytes), '\t');
  return {
    rows,
    bytes,
    record: {
      id: def.id,
      title: def.title,
      page_url: def.page_url,
      download_url: data.url,
      metadata_url: meta.url,
      route: 'download',
      file_name: `${def.id}.${def.data_format.toLowerCase()}`,
      sha256: sha256(bytes),
      rows: rows.length - 1,
      downloaded_at: new Date().toISOString(),
      licence: r.license_title ?? 'Creative Commons Attribution 4.0',
      licence_url: r.license_url ?? 'https://creativecommons.org/licenses/by/4.0/',
    },
  };
}

export async function refreshData(): Promise<void> {
  console.log(`refresh-data started ${new Date().toISOString()}`);

  console.log('- checking ISTAT licence statement');
  await checkLicence();

  const sources: SourceRecord[] = [];
  const raw: { name: string; bytes: Uint8Array }[] = [];

  console.log('- downloading ISTAT comuni list');
  const xlsx = await httpGet(ISTAT_COMUNI.download_url);
  const comuni = parseIstatComuni(
    ISTAT_COMUNI,
    (await readSheet(Buffer.from(xlsx))) as unknown[][],
  );
  sources.push({
    id: ISTAT_COMUNI.id,
    title: ISTAT_COMUNI.title,
    page_url: ISTAT_COMUNI.page_url,
    download_url: ISTAT_COMUNI.download_url,
    route: 'download',
    file_name: 'istat_comuni.xlsx',
    sha256: sha256(xlsx),
    rows: comuni.length,
    downloaded_at: new Date().toISOString(),
    licence: ISTAT_LICENCE.name,
    licence_url: ISTAT_LICENCE.url,
  });
  raw.push({ name: 'istat_comuni.xlsx', bytes: xlsx });

  console.log('- downloading ISTAT 2021 census localities');
  const zip = await httpGet(ISTAT_LOCALITA.download_url);
  const entries = unzipSync(zip, {
    filter: (f) => f.name.endsWith(ISTAT_LOCALITA.zip_entry_suffix),
  });
  const csvBytes = Object.values(entries)[0];
  if (!csvBytes) {
    throw new Error(
      `${ISTAT_LOCALITA.zip_entry_suffix} not found in ${ISTAT_LOCALITA.download_url}; the archive layout changed.`,
    );
  }
  const localities = parseLocalita(
    ISTAT_LOCALITA,
    parseDelimited(new TextDecoder('windows-1252').decode(csvBytes), '\t'),
  );
  sources.push({
    id: ISTAT_LOCALITA.id,
    title: ISTAT_LOCALITA.title,
    page_url: ISTAT_LOCALITA.page_url,
    download_url: ISTAT_LOCALITA.download_url,
    metadata_url: ISTAT_LOCALITA.docs_url,
    route: 'download',
    file_name: 'istat_localita_2021.zip',
    sha256: sha256(zip),
    rows: localities.length,
    downloaded_at: new Date().toISOString(),
    licence: ISTAT_LICENCE.name,
    licence_url: ISTAT_LICENCE.url,
  });
  raw.push({ name: 'istat_localita_2021.zip', bytes: zip });

  const comuneEvents: ComuneEvent[] = [];
  const provinceEvents: ProvinceEvent[] = [];
  const failed: { def: SituasReportDef; reason: string }[] = [];
  for (const def of SITUAS_REPORTS) {
    console.log(`- SITUAS report ${def.report_id}: ${def.title}`);
    const got = await obtainSituas(def, getJson, MANUAL_DIR);
    if ('failure' in got) {
      failed.push({ def, reason: got.failure });
      continue;
    }
    if (got.warning) console.warn(`  !! ${got.warning}`);
    if (def.level === 'comune') comuneEvents.push(...toComuneEvents(def, got.rows));
    else provinceEvents.push(...toProvinceEvents(def, got.rows));
    const urls = situasUrls(def);
    sources.push({
      id: def.id,
      title: `ISTAT SITUAS – ${def.title} (report ${def.report_id}, dal 17/03/1861)`,
      page_url: SITUAS_API_DOCS,
      download_url: got.route === 'api' ? urls.data : 'https://situas.istat.it/web/#/variazioni',
      metadata_url: urls.metadata,
      route: got.route,
      file_name: got.fileName,
      sha256: sha256(got.bytes),
      rows: got.rows.length,
      downloaded_at: got.downloadedAt,
      licence: ISTAT_LICENCE.name,
      licence_url: ISTAT_LICENCE.url,
    });
    raw.push({ name: got.fileName, bytes: got.bytes });
  }
  if (failed.length) {
    console.error(manualInstructions(failed, MANUAL_DIR));
    process.exitCode = 1;
    return;
  }

  const ipa: Record<string, unknown[][]> = {};
  for (const def of [INDICEPA_ENTI, INDICEPA_AOO, INDICEPA_UO]) {
    console.log(`- ${def.title}`);
    const got = await obtainIndicePa(def, getJson, httpGet);
    ipa[def.id] = got.rows;
    sources.push(got.record);
    raw.push({ name: got.record.file_name, bytes: got.bytes });
  }
  const comuneContacts = matchComuneContacts(
    comuni,
    parseComuneContacts(INDICEPA_ENTI, ipa[INDICEPA_ENTI.id]!),
  );
  const comuneOffices = parseComuneOffices(INDICEPA_UO, ipa[INDICEPA_UO.id]!);
  const stateOffices = parseStateOffices(INDICEPA_AOO, ipa[INDICEPA_AOO.id]!);

  console.log('- loading data/curated/offices.yaml');
  const offices = loadOffices(`${DATA_DIR}/curated/offices.yaml`);

  console.log('- loading data/curated/aliases.yaml');
  const aliases = loadAliases(`${DATA_DIR}/curated/aliases.yaml`).map((e) => ({
    ...toAlias(e),
    comune: e.comune,
  }));

  console.log('- building database');
  const refreshedAt = new Date().toISOString();
  const report = buildDatabase(DB_PATH, {
    comuni,
    comuneEvents,
    provinceEvents,
    localities,
    comuneContacts,
    comuneOffices,
    stateOffices,
    offices,
    aliases,
    sources,
    refreshedAt,
  });

  mkdirSync(RAW_DIR, { recursive: true });
  for (const f of raw) writeFileSync(`${RAW_DIR}/${f.name}`, f.bytes);
  writeSourcesMd(`${DATA_DIR}/SOURCES.md`, sources, refreshedAt);

  console.log(
    `done: ${report.comuni} comuni, ${report.comune_events} comune events, ${report.province_events} province events, ${report.localities} localities, ${report.comune_contacts} comune contacts, ${report.comune_offices} civil-registry offices, ${report.state_offices} state offices, ${report.names} searchable names, ${report.aliases} aliases`,
  );
}
