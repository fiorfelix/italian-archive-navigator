import { describe, expect, it } from 'vitest';
import { parseLines, summarise } from '../../scripts/usage-summary.js';

const LOG = [
  '2026-11-20T10:00:00Z {"ts":"2026-11-20T10:00:00.000Z","event":"server_started","host":"0.0.0.0","port":10000,"path":"/mcp","mode":"public"}',
  '{"ts":"2026-11-20T10:01:00.000Z","event":"tool_call","tool":"which_records_exist","ms":12,"ok":true}',
  '{"ts":"2026-11-20T10:02:00.000Z","event":"tool_call","tool":"which_records_exist","ms":30,"ok":false,"error_code":"comune_not_found"}',
  '{"ts":"2026-11-20T10:03:00.000Z","event":"tool_call","tool":"resolve_comune_history","ms":90,"ok":true}',
  '{"ts":"2026-11-20T10:04:00.000Z","event":"rate_limited","scope":"client"}',
  '{"ts":"2026-11-20T10:05:00.000Z","event":"http_error","status":413,"error_code":"entity.too.large"}',
  'MCP endpoint: something that is not JSON',
  '{"broken json',
].join('\n');

describe('usage summary', () => {
  it('counts calls, errors and limits from log lines, skipping non-events', () => {
    const events = parseLines(LOG);
    expect(events).toHaveLength(6);
    const text = summarise(events);
    expect(text).toMatch(/Tool calls: 3/);
    expect(text).toMatch(/which_records_exist\s+2\s+1\s/);
    expect(text).toMatch(/which_records_exist: comune_not_found {2}1/);
    expect(text).toMatch(/Rate limited: 1 \(global 0, per client 1\)/);
    expect(text).toMatch(/HTTP errors: 1 \(413 entity\.too\.large\)/);
    expect(text).toMatch(/Server starts: 1/);
    expect(text).toMatch(/Period: 2026-11-20T10:00:00.000Z to 2026-11-20T10:05:00.000Z/);
  });
});
