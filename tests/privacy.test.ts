import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { startServer, type RunningServer } from '../src/server.js';
import { buildFixtureDb } from './helpers/build-fixture-db.js';

let running: RunningServer;
let client: Client;
const logged: string[] = [];

beforeAll(async () => {
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
    logged.push(String(chunk));
    return true;
  });
  running = await startServer(0, { dbPath: buildFixtureDb() });
  client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(running.url)));
});
afterAll(async () => {
  await client.close();
  await running.close();
  vi.restoreAllMocks();
});

const SECRET_NAME = 'Zebedeo Quarantotti';
const SECRET_PLACE = 'Tarquinia';

describe('privacy and input limits (SPEC §2, M5)', () => {
  it('logs record tool name, timing and outcome only, never request content', async () => {
    await client.callTool({
      name: 'draft_request_letter',
      arguments: {
        request_type: 'comune_copia_integrale',
        comune: SECRET_PLACE,
        person: { given_names: 'Zebedeo', surname: 'Quarantotti' },
        requester: { name: SECRET_NAME, contact: 'zq@example.org' },
      },
    });
    await client.callTool({ name: 'resolve_comune_history', arguments: { name: SECRET_NAME } });
    await client.callTool({
      name: 'resolve_comune_history',
      arguments: { name: 'https://evil.example' },
    });
    const toolLines = logged.filter((l) => l.includes('"tool_call"'));
    expect(toolLines.length).toBeGreaterThanOrEqual(2);
    const all = logged.join('');
    for (const secret of [
      'Zebedeo',
      'Quarantotti',
      'zq@example.org',
      SECRET_PLACE,
      'evil.example',
    ]) {
      expect(all).not.toContain(secret);
    }
    for (const line of toolLines) {
      expect(Object.keys(JSON.parse(line)).sort()).toEqual(
        expect.arrayContaining(['event', 'ms', 'ok', 'tool', 'ts']),
      );
      expect(
        Object.keys(JSON.parse(line)).every((k) =>
          ['ts', 'event', 'tool', 'ms', 'ok', 'error_code'].includes(k),
        ),
      ).toBe(true);
    }
  });

  it.each([
    ['resolve_comune_history', { name: 'https://evil.example' }],
    ['find_archive_contact', { comune: 'www.example.it', office_type: 'stato_civile' }],
    [
      'which_records_exist',
      { comune: 'Tarquinia', province: 'evil.com', year: 1880, event: 'birth' },
    ],
    [
      'draft_request_letter',
      {
        request_type: 'parrocchia_ricerca',
        comune: 'Tarquinia',
        person: { surname: 'http://x.y' },
      },
    ],
    ['cite_source', { archive: 'see archive.example.org', seen_as: 'index_entry' }],
  ])('%s rejects a web address in a name field', async (name, args) => {
    const r = await client.callTool({ name, arguments: args });
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r.content)).toMatch(/enter a name only/);
  });

  it('rejects over-long input', async () => {
    const r = await client.callTool({
      name: 'resolve_comune_history',
      arguments: { name: 'a'.repeat(101) },
    });
    expect(r.isError).toBe(true);
  });
});
