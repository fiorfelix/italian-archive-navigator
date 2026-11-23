/**
 * Usage summary from the server's log lines: calls per tool, error codes, response times,
 * rate limiting and HTTP errors. The logs hold no request contents and no addresses, so
 * neither does this summary.
 *
 *   npm run usage-summary -- server.log      # a saved log file
 *   npm run usage-summary < server.log       # or standard input
 *
 * Lines that aren't JSON log events (for example a hosting service's own prefix or other
 * output) are skipped; a prefix before the JSON object is tolerated.
 */
import { readFileSync } from 'node:fs';

interface Event {
  ts?: string;
  event?: string;
  tool?: string;
  ms?: number;
  ok?: boolean;
  error_code?: string;
  scope?: string;
  status?: number;
}

export function parseLines(text: string): Event[] {
  const out: Event[] = [];
  for (const line of text.split('\n')) {
    const i = line.indexOf('{"');
    if (i < 0) continue;
    try {
      const e = JSON.parse(line.slice(i)) as Event;
      if (typeof e.event === 'string') out.push(e);
    } catch {
      // not a log event
    }
  }
  return out;
}

const pct = (sorted: number[], p: number) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]! : 0;

export function summarise(events: Event[]): string {
  const calls = events.filter((e) => e.event === 'tool_call' && typeof e.tool === 'string');
  const times = events
    .map((e) => e.ts)
    .filter((t): t is string => !!t)
    .sort();
  const lines: string[] = [];
  lines.push(
    `Period: ${times[0] ?? '-'} to ${times.at(-1) ?? '-'}`,
    `Tool calls: ${calls.length}`,
    '',
  );

  const byTool = new Map<string, Event[]>();
  for (const c of calls) byTool.set(c.tool!, [...(byTool.get(c.tool!) ?? []), c]);
  lines.push('Tool                      calls  errors  p50 ms  p95 ms  max ms');
  for (const [tool, list] of [...byTool].sort((a, b) => b[1].length - a[1].length)) {
    const ms = list.map((c) => c.ms ?? 0).sort((a, b) => a - b);
    const errors = list.filter((c) => c.ok === false).length;
    lines.push(
      `${tool.padEnd(24)} ${String(list.length).padStart(6)} ${String(errors).padStart(7)} ` +
        `${String(pct(ms, 50)).padStart(7)} ${String(pct(ms, 95)).padStart(7)} ${String(ms.at(-1) ?? 0).padStart(7)}`,
    );
  }

  const codes = new Map<string, number>();
  for (const c of calls.filter((c) => c.ok === false)) {
    const k = `${c.tool}: ${c.error_code ?? 'unknown'}`;
    codes.set(k, (codes.get(k) ?? 0) + 1);
  }
  lines.push('', 'Error codes:');
  if (!codes.size) lines.push('  none');
  for (const [k, n] of [...codes].sort((a, b) => b[1] - a[1])) lines.push(`  ${k}  ${n}`);

  const limited = events.filter((e) => e.event === 'rate_limited');
  const http = events.filter((e) => e.event === 'http_error');
  const restarts = events.filter((e) => e.event === 'server_started').length;
  lines.push(
    '',
    `Rate limited: ${limited.length} (global ${limited.filter((e) => e.scope === 'global').length}, per client ${limited.filter((e) => e.scope === 'client').length})`,
    `HTTP errors: ${http.length}${http.length ? ` (${[...new Set(http.map((e) => `${e.status} ${e.error_code}`))].join(', ')})` : ''}`,
    `Server starts: ${restarts}`,
  );
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  const text = file ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8');
  process.stdout.write(summarise(parseLines(text)) + '\n');
}
