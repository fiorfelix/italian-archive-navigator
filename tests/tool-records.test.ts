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
const call = (args: Record<string, unknown>) =>
  client.callTool({ name: 'which_records_exist', arguments: args });

describe('which_records_exist over MCP', () => {
  it('is listed as read-only with a title', async () => {
    const t = (await client.listTools()).tools.find((x) => x.name === 'which_records_exist');
    expect(t?.title).toBe('Which records exist');
    expect(t?.annotations?.readOnlyHint).toBe(true);
  });
  it('answers a valid request', async () => {
    const r = await call({ comune: 'Tarquinia', year: 1850, event: 'birth' });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ regime: { code: 'parish_only' } });
  });
  it.each([
    [{ comune: 'Tarquinia', year: 1850, event: 'baptism' }, /event/],
    [{ comune: 'Tarquinia', year: 3000, event: 'birth' }, /year/],
    [{ comune: 'Tarquinia', event: 'birth' }, /year/],
    [{ comune: 'Qwertyville', year: 1850, event: 'birth' }, /No comune or locality/],
  ])('rejects %j with a clear error', async (args, msg) => {
    const r = await call(args);
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r.content)).toMatch(msg);
  });
});
