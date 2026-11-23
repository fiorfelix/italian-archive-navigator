import { request } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { startServer, type RunningServer } from '../src/server.js';

let running: RunningServer;

beforeAll(async () => {
  running = await startServer(0); // ephemeral port so tests never clash with a dev server
});
afterAll(async () => {
  await running.close();
});

async function connect(): Promise<Client> {
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(running.url)));
  return client;
}

describe('MCP server (M0)', () => {
  it('listens on 127.0.0.1 only', () => {
    expect(running.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
  });

  it('lists the health tool with read-only annotations', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const health = tools.find((t) => t.name === 'health');
    expect(health).toBeDefined();
    expect(health?.title).toBe('Server health');
    expect(health?.annotations?.readOnlyHint).toBe(true);
    expect(health?.annotations?.destructiveHint).toBe(false);
    await client.close();
  });

  it('calls the health tool and returns structured output', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'health', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      status: 'ok',
      server: 'italian-archive-navigator',
    });
    await client.close();
  });

  it('rejects a non-localhost Host header (DNS rebinding protection)', async () => {
    // fetch() overrides Host, so send the raw request with node:http.
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const status = await new Promise<number>((resolve, reject) => {
      const req = request(
        {
          host: '127.0.0.1',
          port: running.port,
          path: '/mcp',
          method: 'POST',
          headers: {
            Host: 'evil.example.com',
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        },
      );
      req.on('error', reject);
      req.end(body);
    });
    expect(status).toBe(403);
  });

  it('rejects an oversized request with a short JSON-RPC error', async () => {
    const res = await fetch(running.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        pad: 'x'.repeat(200_000),
      }),
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ error: { message: 'Request too large.' } });
  });

  it('rejects a non-localhost Origin header', async () => {
    const res = await fetch(running.url, {
      method: 'POST',
      headers: {
        Origin: 'https://evil.example.com',
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(res.status).toBe(403);
  });
});
