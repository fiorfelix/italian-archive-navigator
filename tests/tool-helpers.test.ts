import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { REGISTER_GUIDE_PATH } from '../src/config.js';
import { loadRegisterGuide } from '../src/rules/register-guide.js';
import { startServer, type RunningServer } from '../src/server.js';
import { buildFixtureDb } from './helpers/build-fixture-db.js';

let running: RunningServer;
let client: Client;
beforeAll(async () => {
  running = await startServer(0, { dbPath: buildFixtureDb() });
  client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(running.url)));
});
afterAll(async () => {
  await client.close();
  await running.close();
});

type Guide = {
  regime: { code: string } | null;
  routed_to_comune?: boolean;
  layout: { notes: { text: string; verified: boolean; source_url?: string }[] } | null;
  reading_steps: string[];
};
const guide = async (args: Record<string, unknown>) => {
  const r = await client.callTool({ name: 'register_guide', arguments: args });
  expect(r.isError).toBeFalsy();
  return r.structuredContent as Guide;
};

describe('register_guide', () => {
  it('Italian civil registers: sourced notes on numbering, margins and the annual index', async () => {
    const g = await guide({ comune: 'Tarquinia', year: 1880, event: 'birth' });
    expect(g.regime?.code).toBe('italian_civil');
    const text = g.layout!.notes.map((n) => n.text).join(' ');
    expect(text).toMatch(/running number in the margin/);
    expect(text).toMatch(/alphabetical index by surname/);
    const verified = g.layout!.notes.filter((n) => n.verified);
    expect(verified.length).toBeGreaterThanOrEqual(5);
    for (const n of verified) expect(n.source_url).toMatch(/^https:\/\//);
    expect(g.reading_steps.join(' ')).toMatch(/index/);
  });

  it('parish-only period: typical notes, clearly marked unverified', async () => {
    const g = await guide({ comune: 'Tarquinia', year: 1840, event: 'birth' });
    expect(g.regime?.code).toBe('parish_only');
    expect(g.layout!.notes.every((n) => !n.verified)).toBe(true);
  });

  it('recent events are still routed to the Comune', async () => {
    const g = await guide({ comune: 'Viterbo', year: 1990, event: 'death' });
    expect(g.routed_to_comune).toBe(true);
  });

  it('a verified note without a source is refused when the guide loads', () => {
    expect(loadRegisterGuide(REGISTER_GUIDE_PATH).regimes.italian_civil).toBeDefined();
    const dir = mkdtempSync(join(tmpdir(), 'guide-'));
    const bad = join(dir, 'g.yaml');
    writeFileSync(
      bad,
      'version: 1\nregimes:\n  napoleonic:\n    title: X\n    notes:\n      - text: Y\n        verified: true\n',
    );
    expect(() => loadRegisterGuide(bad)).toThrow(/needs source_url and quote/);
  });
});

describe('match_surnames', () => {
  it('returns matches with scores and reasons, and counts the rest', async () => {
    const r = await client.callTool({
      name: 'match_surnames',
      arguments: { candidates: ['Rosi', 'Verdi', 'Fiorentina'], surnames: ['Rossi', 'Fiorentini'] },
    });
    expect(r.isError).toBeFalsy();
    const s = r.structuredContent as {
      results: { candidate: string; matches: { surname: string; reason: string }[] }[];
      unmatched: number;
    };
    expect(s.results.map((x) => x.candidate)).toEqual(['Rosi', 'Fiorentina']);
    expect(s.results[1]!.matches[0]).toMatchObject({
      surname: 'Fiorentini',
      reason: 'different_ending',
    });
    expect(s.unmatched).toBe(1);
  });

  it('rejects web addresses and oversized lists', async () => {
    const url = await client.callTool({
      name: 'match_surnames',
      arguments: { candidates: ['see www.example.org'], surnames: ['Rossi'] },
    });
    expect(url.isError).toBe(true);
    const big = await client.callTool({
      name: 'match_surnames',
      arguments: { candidates: ['Rossi'], surnames: Array.from({ length: 31 }, (_, i) => `N${i}`) },
    });
    expect(big.isError).toBe(true);
  });
});
