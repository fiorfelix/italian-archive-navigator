import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = new URL(
  '../plugin/skills/collect-register-pages/scripts/fetch-pages.sh',
  import.meta.url,
).pathname;

/** A local test site. `plan` maps a path to the responses it gives, in order (last repeats). */
async function site(plan: Record<string, ('img' | '403' | '429' | '429-noretry' | 'html')[]>) {
  const hits: { path: string; t: number; ua: string }[] = [];
  const count = new Map<string, number>();
  const server: Server = createServer((req, res) => {
    const path = req.url ?? '/';
    hits.push({ path, t: Date.now(), ua: String(req.headers['user-agent']) });
    const steps = plan[path] ?? ['img'];
    const i = count.get(path) ?? 0;
    count.set(path, i + 1);
    const step = steps[Math.min(i, steps.length - 1)];
    if (step === 'img') res.writeHead(200, { 'Content-Type': 'image/jpeg' }).end(`IMG ${path}`);
    else if (step === '403') res.writeHead(403).end();
    else if (step === '429') res.writeHead(429, { 'Retry-After': '1' }).end();
    else if (step === '429-noretry') res.writeHead(429).end();
    else res.writeHead(200, { 'Content-Type': 'text/html' }).end('<html>Please log in</html>');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  return { url: (p: string) => `http://127.0.0.1:${port}${p}`, hits, close: () => server.close() };
}

function run(list: string, dest: string, delay = '5') {
  return new Promise<{ code: number; out: string }>((resolve) => {
    const p = spawn('bash', [SCRIPT, list, dest, delay, 'test@example.org']);
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('close', (code) => resolve({ code: code ?? -1, out }));
  });
}

function setup(lines: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'fetch-'));
  const list = join(dir, 'list.tsv');
  writeFileSync(list, lines.join('\n') + '\n');
  return { list, dest: join(dir, 'pages') };
}

const gaps = (hits: { t: number }[]) => hits.slice(1).map((h, i) => h.t - hits[i]!.t);

describe.concurrent('fetch-pages.sh (collect-register-pages skill)', () => {
  it('saves pages one at a time, at least 5 s apart, logs them, and resumes', async () => {
    const s = await site({});
    const { list, dest } = setup([1, 2, 3].map((n) => `${s.url(`/p${n}.jpg`)}\tx_img${n}.jpg`));
    const r = await run(list, dest);
    expect(r.code).toBe(0);
    expect(
      readdirSync(dest)
        .filter((f) => f.endsWith('.jpg'))
        .sort(),
    ).toEqual(['x_img1.jpg', 'x_img2.jpg', 'x_img3.jpg']);
    for (const g of gaps(s.hits)) expect(g).toBeGreaterThanOrEqual(4900);
    expect(s.hits[0]!.ua).toMatch(/italian-archive-navigator.*contact: test@example\.org/);
    const log = readFileSync(join(dest, 'fetch-log.tsv'), 'utf8').trim().split('\n');
    expect(log).toHaveLength(4);
    expect(log[1]).toMatch(/\t200\t\d+\t[0-9a-f]{64}$/);
    const again = await run(list, dest);
    expect(again.code).toBe(0);
    expect(again.out).toMatch(/already saved: x_img3\.jpg/);
    expect(s.hits).toHaveLength(3);
    s.close();
  }, 60_000);

  it('waits as the site asks on 429, then continues', async () => {
    const s = await site({ '/busy.jpg': ['429', 'img'] });
    const { list, dest } = setup([`${s.url('/busy.jpg')}\tb.jpg`]);
    const r = await run(list, dest);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/site busy \(429\); waiting 1s/);
    expect(s.hits).toHaveLength(2);
    expect(gaps(s.hits)[0]).toBeGreaterThanOrEqual(4900);
    s.close();
  }, 60_000);

  it('stops for the day after three 429s in a row', async () => {
    const s = await site({ '/busy.jpg': ['429'] });
    const { list, dest } = setup([`${s.url('/busy.jpg')}\tb.jpg`, `${s.url('/next.jpg')}\tn.jpg`]);
    const r = await run(list, dest);
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/Stopping for today/);
    expect(s.hits.map((h) => h.path)).toEqual(['/busy.jpg', '/busy.jpg', '/busy.jpg']);
    s.close();
  }, 60_000);

  it('stops at once on 403 and does not try again', async () => {
    const s = await site({ '/no.jpg': ['403'] });
    const { list, dest } = setup([`${s.url('/no.jpg')}\tn.jpg`, `${s.url('/after.jpg')}\ta.jpg`]);
    const r = await run(list, dest);
    expect(r.code).toBe(3);
    expect(s.hits.map((h) => h.path)).toEqual(['/no.jpg']);
    s.close();
  }, 30_000);

  it('stops when a web page (login or CAPTCHA) comes back instead of an image', async () => {
    const s = await site({ '/login.jpg': ['html'] });
    const { list, dest } = setup([`${s.url('/login.jpg')}\tl.jpg`]);
    const r = await run(list, dest);
    expect(r.code).toBe(3);
    expect(r.out).toMatch(/login or CAPTCHA/);
    expect(readdirSync(dest).filter((f) => f.endsWith('.jpg'))).toEqual([]);
    s.close();
  }, 30_000);

  it('refuses a delay under 5 seconds and unsafe file names', async () => {
    const s = await site({});
    const { list, dest } = setup([`${s.url('/a.jpg')}\t../escape.jpg`]);
    expect((await run(list, dest, '2')).code).toBe(1);
    const r = await run(list, dest);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/bad file name/);
    expect(s.hits).toHaveLength(0);
    s.close();
  }, 30_000);

  it('checks the whole list first: odd characters or a name used twice stop it before any request', async () => {
    const s = await site({});
    for (const lines of [
      [`${s.url('/a.jpg')}\tok_img1.jpg`, `${s.url('/b.jpg')}\tx.jpg?v=1&y=2`],
      [`${s.url('/a.jpg')}\tsame_img1.jpg`, `${s.url('/b.jpg')}\tsame_img1.jpg`],
    ]) {
      const { list, dest } = setup(lines);
      const r = await run(list, dest);
      expect(r.code).toBe(1);
      expect(r.out).toMatch(/Nothing was downloaded/);
    }
    expect(s.hits).toHaveLength(0);
    s.close();
  }, 30_000);
});
