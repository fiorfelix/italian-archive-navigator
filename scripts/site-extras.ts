/**
 * Builds the machine-readable copies of the information site from its HTML pages:
 *   - a Markdown copy of every indexable page (same path, .md), linked from the page's <head>;
 *   - llms.txt (summary and page list) and llms-full.txt (the full text of every page);
 *   - sitemap.xml.
 * Indexable pages are the .html files under site/ without <meta name="robots" content="noindex">.
 * Runs before every commit that touches site/ (.githooks/pre-commit).
 *
 *   npm run site:build           rewrite the files
 *   npm run site:build -- --check  report stale files and exit 1, without writing
 * The test in tests/site-extras.test.ts fails when the files are out of date.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { format, resolveConfig } from 'prettier';

export const BASE = 'https://archives.fiorfelix.com';
const SITE_DIR = 'site';

// ---------------------------------------------------------------------------------------------
// A small HTML parser for the site's own, well-formed pages (not a general-purpose parser).

interface El {
  tag: string;
  attrs: Record<string, string>;
  children: Node[];
}
type Node = El | string;

const VOID = new Set(['br', 'img', 'input', 'meta', 'link', 'hr', 'source', 'wbr']);

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|#39);/gi, (_m, e: string) => {
    const k = e.toLowerCase();
    if (k.startsWith('#x')) return String.fromCodePoint(parseInt(k.slice(2), 16));
    if (k.startsWith('#')) return String.fromCodePoint(parseInt(k.slice(1), 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[k] ?? '';
  });
}

function parseAttrs(s: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of s.matchAll(
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g,
  )) {
    attrs[m[1]!.toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

export function parseHtml(html: string): El {
  const root: El = { tag: '#root', attrs: {}, children: [] };
  const stack: El[] = [root];
  const re =
    /<!--[\s\S]*?-->|<!doctype[^>]*>|<script\b[^>]*>[\s\S]*?<\/script>|<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|[^<]+|</gi;
  for (const m of html.matchAll(re)) {
    const top = stack[stack.length - 1]!;
    const [whole, close, name, rest] = m;
    if (name === undefined) {
      if (!whole.startsWith('<!') && !/^<script/i.test(whole))
        top.children.push(decodeEntities(whole));
      continue;
    }
    const tag = name.toLowerCase();
    if (close) {
      const i = stack.map((e) => e.tag).lastIndexOf(tag);
      if (i > 0) stack.length = i;
      continue;
    }
    const el: El = { tag, attrs: parseAttrs(rest ?? ''), children: [] };
    top.children.push(el);
    if (!VOID.has(tag) && !/\/\s*$/.test(rest ?? '')) stack.push(el);
  }
  return root;
}

export function find(node: Node, test: (e: El) => boolean): El | undefined {
  if (typeof node === 'string') return undefined;
  if (test(node)) return node;
  for (const c of node.children) {
    const hit = find(c, test);
    if (hit) return hit;
  }
  return undefined;
}

const text = (node: Node): string =>
  typeof node === 'string' ? node : node.children.map(text).join('');

// ---------------------------------------------------------------------------------------------
// HTML -> Markdown for the page's <main>.

const SKIP = new Set(['button', 'img', 'input', 'nav', 'header', 'footer', 'form', 'svg', 'style']);
const BLOCK = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'p',
  'ul',
  'ol',
  'table',
  'div',
  'details',
  'section',
  'main',
  'fieldset',
  'blockquote',
]);

function absolute(href: string, pageUrl: string): string {
  if (/^[a-z]+:/i.test(href)) return href;
  if (href.startsWith('#')) return pageUrl + href;
  return new URL(href, pageUrl).toString();
}

function inline(node: Node, pageUrl: string): string {
  if (typeof node === 'string') return node.replace(/\s+/g, ' ');
  if (SKIP.has(node.tag)) return '';
  const inner = () => node.children.map((c) => inline(c, pageUrl)).join('');
  switch (node.tag) {
    case 'br':
      return '\n';
    case 'strong':
    case 'b': {
      const t = inner().trim();
      return t ? `**${t}**` : '';
    }
    case 'em':
    case 'i': {
      const t = inner().trim();
      return t ? `*${t}*` : '';
    }
    case 'code':
      return '`' + text(node).replace(/\s+/g, ' ').trim() + '`';
    case 'a': {
      const t = inner().trim();
      const href = node.attrs.href;
      return href ? `[${t}](${absolute(href, pageUrl)})` : t;
    }
    default:
      return inner();
  }
}

const tidy = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();

function blocks(node: El, pageUrl: string, indent = ''): string[] {
  const out: string[] = [];
  let run: Node[] = [];
  const flush = () => {
    const t = tidy(run.map((n) => inline(n, pageUrl)).join(''));
    if (t) out.push(t);
    run = [];
  };
  for (const c of node.children) {
    if (typeof c === 'string' || !BLOCK.has(c.tag)) {
      if (typeof c !== 'string' && SKIP.has(c.tag)) continue;
      run.push(c);
      continue;
    }
    flush();
    out.push(...block(c, pageUrl, indent));
  }
  flush();
  return out;
}

function block(el: El, pageUrl: string, indent: string): string[] {
  if (el.attrs.hidden !== undefined || el.attrs['aria-hidden'] === 'true') return [];
  switch (el.tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
      return ['#'.repeat(Number(el.tag[1])) + ' ' + tidy(inline(el, pageUrl))];
    case 'p': {
      const t = tidy(inline(el, pageUrl));
      return t ? [t] : [];
    }
    case 'ul':
    case 'ol': {
      const items = el.children.filter((c): c is El => typeof c !== 'string' && c.tag === 'li');
      const lines = items.map((li, i) => {
        const marker = el.tag === 'ol' ? `${i + 1}. ` : '- ';
        const parts = blocks(li, pageUrl, indent + '   ');
        const pad = ' '.repeat(marker.length);
        return parts
          .join('\n\n')
          .split('\n')
          .map((l, j) => (j === 0 ? indent + marker + l : l ? indent + pad + l : ''))
          .join('\n');
      });
      return [lines.join('\n')];
    }
    case 'table': {
      const rows: string[][] = [];
      const visit = (n: Node) => {
        if (typeof n === 'string') return;
        if (n.tag === 'tr') {
          rows.push(
            n.children
              .filter((c): c is El => typeof c !== 'string' && (c.tag === 'td' || c.tag === 'th'))
              .map((c) => tidy(inline(c, pageUrl)).replace(/\n/g, ' ').replace(/\|/g, '\\|')),
          );
        } else n.children.forEach(visit);
      };
      visit(el);
      if (rows.length === 0) return [];
      const [head, ...body] = rows;
      return [
        [
          `| ${head!.join(' | ')} |`,
          `| ${head!.map(() => '---').join(' | ')} |`,
          ...body.map((r) => `| ${r.join(' | ')} |`),
        ].join('\n'),
      ];
    }
    case 'details': {
      const summary = el.children.find(
        (c): c is El => typeof c !== 'string' && c.tag === 'summary',
      );
      const rest: El = { ...el, children: el.children.filter((c) => c !== summary) };
      return [
        ...(summary ? ['**' + tidy(inline(summary, pageUrl)) + '**'] : []),
        ...blocks(rest, pageUrl, indent),
      ];
    }
    default:
      return blocks(el, pageUrl, indent);
  }
}

export function htmlToMarkdown(html: string, pageUrl: string): string {
  const doc = parseHtml(html);
  const main = find(doc, (e) => e.tag === 'main');
  if (!main) throw new Error(`no <main> in ${pageUrl}`);
  return (
    blocks(main, pageUrl)
      .join('\n\n')
      .replace(/\n{3,}/g, '\n\n') + '\n'
  );
}

// ---------------------------------------------------------------------------------------------
// Pages

export interface Page {
  file: string; // e.g. site/guides/x.html
  path: string; // e.g. /guides/x
  url: string;
  mdPath: string; // e.g. /guides/x.md
  lang: string;
  title: string;
  description: string;
  html: string;
}

const meta = (doc: El, name: string) =>
  find(doc, (e) => e.tag === 'meta' && e.attrs.name === name)?.attrs.content ?? '';

export function pagePath(file: string): { path: string; mdPath: string } {
  const rel = relative(SITE_DIR, file)
    .split(sep)
    .join('/')
    .replace(/\.html$/, '');
  if (rel === 'index') return { path: '/', mdPath: '/index.md' };
  if (rel.endsWith('/index')) {
    const dir = rel.slice(0, -'index'.length);
    return { path: '/' + dir, mdPath: '/' + dir + 'index.md' };
  }
  return { path: '/' + rel, mdPath: '/' + rel + '.md' };
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return name.startsWith('.') ? [] : htmlFiles(p);
      return name.endsWith('.html') ? [p] : [];
    })
    .sort();
}

export function loadPages(siteDir = SITE_DIR): Page[] {
  return htmlFiles(siteDir)
    .map((file) => {
      const html = readFileSync(file, 'utf8');
      const doc = parseHtml(html);
      if (meta(doc, 'robots').includes('noindex') || file.endsWith(`${sep}404.html`)) return null;
      const { path, mdPath } = pagePath(file);
      return {
        file,
        path,
        url: BASE + path,
        mdPath,
        lang: find(doc, (e) => e.tag === 'html')?.attrs.lang ?? 'en',
        title: tidy(text(find(doc, (e) => e.tag === 'title') ?? '')),
        description: tidy(meta(doc, 'description')),
        html,
      };
    })
    .filter((p): p is Page => p !== null)
    .sort((a, b) => order(a) - order(b) || a.path.localeCompare(b.path));
}

/** English first, then Italian; within each, home, guides index, guides, then the rest. */
function order(p: Page): number {
  const lang = p.lang === 'en' ? 0 : 10;
  if (p.path === '/' || p.path === '/it/') return lang;
  if (p.path === '/guides' || p.path === '/it/guide') return lang + 1;
  if (p.path.startsWith('/guides/') || p.path.startsWith('/it/guide/')) return lang + 2;
  return lang + 3;
}

const yamlString = (s: string) => JSON.stringify(s);

export function markdownFor(page: Page, updated: string): string {
  return [
    '---',
    `title: ${yamlString(page.title)}`,
    `description: ${yamlString(page.description)}`,
    `url: ${page.url}`,
    `language: ${page.lang}`,
    `updated: ${updated}`,
    '---',
    '',
    htmlToMarkdown(page.html, page.url),
  ].join('\n');
}

/** Adds or refreshes <link rel="alternate" type="text/markdown"> in the page's <head>. */
export function withMarkdownLink(html: string, mdUrl: string): string {
  const tag = `<link rel="alternate" type="text/markdown" href="${mdUrl}" />`;
  // Remove every existing copy (in any formatting), then add exactly one.
  const cleaned = html.replace(
    /\n[ \t]*<link\s+rel="alternate"\s+type="text\/markdown"\s+href="[^"]*"\s*\/>/g,
    '',
  );
  const m = /\n([ \t]*)<link rel="icon"/.exec(cleaned);
  if (!m) throw new Error('no <link rel="icon"> to place the Markdown link before');
  return cleaned.slice(0, m.index) + `\n${m[1]}${tag}` + cleaned.slice(m.index);
}

// ---------------------------------------------------------------------------------------------
// Dates: the last commit that touched a page (UTC), or today if it has uncommitted changes.

export function lastUpdated(file: string, today: string): string {
  try {
    const dirty = execFileSync('git', ['status', '--porcelain', '--', file], { encoding: 'utf8' });
    if (dirty.trim()) return today;
    const d = execFileSync(
      'git',
      ['log', '-1', '--format=%cd', '--date=format-local:%Y-%m-%d', '--', file],
      { encoding: 'utf8', env: { ...process.env, TZ: 'UTC' } },
    ).trim();
    return d || today;
  } catch {
    return today;
  }
}

// ---------------------------------------------------------------------------------------------
// Outputs

export function sitemap(pages: Page[], dates: Map<string, string>): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...pages.map(
      (p) =>
        `    <url>\n        <loc>${p.url}</loc>\n        <lastmod>${dates.get(p.file)}</lastmod>\n    </url>`,
    ),
    '</urlset>',
    '',
  ].join('\n');
}

const LLMS_INTRO = `# Italian Archive Navigator

> A free, read-only MCP connector for Claude for Italian family-history research. Given a place, a year and an event, it finds what the place was called and which comune it belonged to, which records exist (civil registration, parish registers, military records) and which office holds each copy today, the office's address and certified e-mail (PEC), drafts a request letter in Italian, and formats a citation. Published by fiorfelix.

- Connector address (Streamable HTTP, no sign-in): https://archives-mcp.fiorfelix.com/mcp
- To add it in Claude: Settings, Connectors, add a custom connector with the address above.
- Claude Code: \`claude mcp add --transport http italian-archive-navigator https://archives-mcp.fiorfelix.com/mcp\`
- Coverage is deepest for Lazio, Umbria, Toscana and Marche; place history and office contacts cover all of Italy.
- It does not search Portale Antenati or FamilySearch, does not look up living people, never sends anything on the user's behalf, and does not store request contents.
- Sources: ISTAT and IndicePA open data (CC BY 4.0), the Guida generale degli Archivi di Stato italiani, archive inventories and Italian law on Normattiva. Every rule cites its source; unconfirmed rules are marked unverified.
- Every page below is also available as Markdown at the linked address. The full text of all pages is in ${BASE}/llms-full.txt.
`;

export function llmsTxt(pages: Page[]): string {
  const line = (p: Page) => `- [${p.title.split(' · ')[0]}](${BASE}${p.mdPath}): ${p.description}`;
  const en = pages.filter((p) => p.lang === 'en');
  const it = pages.filter((p) => p.lang === 'it');
  return [
    LLMS_INTRO,
    '## Pages (English)',
    '',
    ...en.map(line),
    '',
    '## Pagine (italiano)',
    '',
    ...it.map(line),
    '',
    '## Optional',
    '',
    `- [Contact form](${BASE}/contact)`,
    '- [Source code (MIT)](https://github.com/fiorfelix/italian-archive-navigator)',
    '',
  ].join('\n');
}

export function llmsFullTxt(pages: Page[], markdown: Map<string, string>): string {
  const body = pages
    .map((p) => markdown.get(p.file)!.replace(/^---\n[\s\S]*?\n---\n\n/, ''))
    .map((md, i) => `<!-- ${pages[i]!.url} -->\n\n${md.trim()}\n`);
  return [LLMS_INTRO.trim(), '', ...body].join('\n\n---\n\n').replace(/\n{3,}/g, '\n\n') + '';
}

/** Formats HTML the same way `npm run format` does, so the two never disagree. */
async function prettierHtml(html: string, file: string): Promise<string> {
  const options = (await resolveConfig(file)) ?? {};
  return format(html, { ...options, filepath: file });
}

/** Everything the build writes: path -> content. */
export async function buildAll(siteDir = SITE_DIR, today = new Date().toISOString().slice(0, 10)) {
  const pages = loadPages(siteDir);
  const files = new Map<string, string>();
  const dates = new Map<string, string>();
  const markdown = new Map<string, string>();
  for (const p of pages) {
    const html = await prettierHtml(withMarkdownLink(p.html, BASE + p.mdPath), p.file);
    files.set(p.file, html);
    p.html = html;
    dates.set(p.file, lastUpdated(p.file, today));
  }
  for (const p of pages) {
    const md = markdownFor(p, dates.get(p.file)!);
    markdown.set(p.file, md);
    files.set(join(siteDir, p.mdPath.slice(1)), md);
  }
  files.set(join(siteDir, 'sitemap.xml'), sitemap(pages, dates));
  files.set(join(siteDir, 'llms.txt'), llmsTxt(pages));
  files.set(join(siteDir, 'llms-full.txt'), llmsFullTxt(pages, markdown));
  return files;
}

async function main() {
  const check = process.argv.includes('--check');
  const stale: string[] = [];
  for (const [file, content] of await buildAll()) {
    const current = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (current === content) continue;
    stale.push(file);
    if (!check) writeFileSync(file, content);
  }
  if (check && stale.length) {
    console.error(`Out of date (run npm run site:build):\n  ${stale.join('\n  ')}`);
    process.exit(1);
  }
  if (process.argv.includes('--print-written')) {
    for (const f of stale) console.log(f);
    return;
  }
  console.log(
    check ? 'Site extras are up to date.' : `Site extras: ${stale.length} file(s) written.`,
  );
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
