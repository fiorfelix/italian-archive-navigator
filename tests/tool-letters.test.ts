import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
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

describe('all tools over MCP', () => {
  it('are listed, each with a title and readOnlyHint', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'cite_source',
      'draft_request_letter',
      'find_archive_contact',
      'health',
      'match_surnames',
      'register_guide',
      'resolve_comune_history',
      'which_records_exist',
    ]);
    for (const t of tools) {
      expect(t.title).toBeTruthy();
      expect(t.annotations?.readOnlyHint).toBe(true);
    }
  });

  it('draft_request_letter answers a valid request', async () => {
    const r = await client.callTool({
      name: 'draft_request_letter',
      arguments: {
        request_type: 'comune_copia_integrale',
        comune: 'Tarquinia',
        person: { given_names: 'Giuseppe', surname: 'Rossi' },
        event: { type: 'birth', year: 1880 },
      },
    });
    expect(r.isError).toBeFalsy();
    expect((r.structuredContent as { letter_it: string }).letter_it).toMatch(/ROSSI Giuseppe/);
  });

  it('accepts act numbers sent as numbers', async () => {
    const r = await client.callTool({
      name: 'cite_source',
      arguments: {
        archive: 'Archivio di Stato di Viterbo',
        year: 1880,
        record_type: 'birth',
        act_number: 45,
        seen_as: 'index_entry',
      },
    });
    expect(r.isError).toBeFalsy();
    expect((r.structuredContent as { citation: string }).citation).toMatch(
      /atto di nascita n\. 45/,
    );
  });

  it.each([
    [
      'draft_request_letter',
      { request_type: 'email_the_mayor', comune: 'Tarquinia', person: {} },
      /request_type/,
    ],
    [
      'draft_request_letter',
      {
        request_type: 'comune_copia_integrale',
        comune: 'Tarquinia',
        person: {},
        event: { date: '05/03/1880' },
      },
      /yyyy-mm-dd/,
    ],
    [
      'draft_request_letter',
      {
        request_type: 'comune_copia_integrale',
        comune: 'Tarquinia',
        person: {},
        details: ['see www.example.org'],
      },
      /enter a name only/,
    ],
    [
      'draft_request_letter',
      {
        request_type: 'comune_copia_integrale',
        comune: 'Tarquinia',
        person: {},
        details: Array.from({ length: 9 }, (_, i) => `fatto ${i}`),
      },
      /details/,
    ],
    [
      'draft_request_letter',
      { request_type: 'comune_copia_integrale', comune: 'Tarquinia', person: { sex: 'X' } },
      /sex/,
    ],
    [
      'draft_request_letter',
      {
        request_type: 'comune_copia_integrale',
        comune: 'Tarquinia',
        person: {},
        event: { date: '1880-13-45' },
      },
      /not a real date/,
    ],
    [
      'draft_request_letter',
      {
        request_type: 'comune_copia_integrale',
        comune: 'Tarquinia',
        person: { birth_date: '2099-01-01' },
      },
      /in the future/,
    ],
    [
      'cite_source',
      { archive: 'X', seen_as: 'index_entry', accessed: '2026-02-30' },
      /not a real date/,
    ],
    ['cite_source', { archive: 'X', seen_as: 'rumour' }, /seen_as/],
    [
      'cite_source',
      { archive: 'X', seen_as: 'original_record', url: 'javascript:alert(1)' },
      /url/,
    ],
  ])('%s rejects %j', async (name, args, msg) => {
    const r = await client.callTool({ name, arguments: args });
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r.content)).toMatch(msg);
  });
});
