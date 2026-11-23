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
  client.callTool({ name: 'resolve_comune_history', arguments: args });

describe('resolve_comune_history over MCP', () => {
  it('is listed as read-only with a title', async () => {
    const { tools } = await client.listTools();
    const t = tools.find((x) => x.name === 'resolve_comune_history');
    expect(t?.title).toBe('Resolve comune history');
    expect(t?.annotations?.readOnlyHint).toBe(true);
  });

  it('returns structured JSON for valid input', async () => {
    const r = await call({ name: 'Toscanella', province: 'VT', year: 1880 });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ match_quality: 'exact' });
  });

  it.each([
    [{}, /name/],
    [{ name: '' }, /name/],
    [{ name: 'x'.repeat(101) }, /name/],
    [{ name: 'Viterbo', year: 1861.5 }, /year/],
    [{ name: 'Viterbo', year: 3000 }, /year/],
  ])('rejects invalid input %j with an error naming the field', async (args, field) => {
    const r = await call(args);
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r.content)).toMatch(field);
  });
});

describe('without a database', () => {
  it('tells the user to run refresh-data', async () => {
    const bare = await startServer(0, { dbPath: '/nonexistent/db.sqlite' });
    const c = new Client({ name: 't', version: '0' });
    await c.connect(new StreamableHTTPClientTransport(new URL(bare.url)));
    const r = await c.callTool({ name: 'resolve_comune_history', arguments: { name: 'Viterbo' } });
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r.content)).toMatch(/npm run refresh-data/);
    await c.close();
    await bare.close();
  });
});
