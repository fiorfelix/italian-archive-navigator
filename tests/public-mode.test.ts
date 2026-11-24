import { request } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { publicConfig } from '../src/config.js';
import { rateLimit } from '../src/http/rate-limit.js';
import { startServer, type RunningServer } from '../src/server.js';
import { buildFixtureDb } from './helpers/build-fixture-db.js';

const PUBLIC = 'mcp.example.org';

/** Raw HTTP request with a chosen Host header (fetch() overrides Host). */
function send(
  port: number,
  opts: { method: 'GET' | 'POST'; path: string; host: string; body?: unknown },
): Promise<{ status: number; headers: Record<string, unknown>; text: string }> {
  const body = opts.body === undefined ? undefined : JSON.stringify(opts.body);
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path: opts.path,
        method: opts.method,
        headers: {
          Host: opts.host,
          Accept: 'application/json, text/event-stream',
          ...(body
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
            : {}),
        },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => (text += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, text }));
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

const listTools = { jsonrpc: '2.0', id: 1, method: 'tools/list' };

describe('publicConfig (PUBLIC_HOST and rate-limit settings)', () => {
  it('is off unless PUBLIC_HOST is set', () => {
    expect(publicConfig({})).toBeNull();
    expect(publicConfig({ PUBLIC_HOST: '' })).toBeNull();
  });
  it('accepts a host name, lowercases it, and adds the hosting service name', () => {
    expect(
      publicConfig({ PUBLIC_HOST: 'MCP.Example.org', RENDER_EXTERNAL_HOSTNAME: 'x.onrender.com' }),
    ).toEqual({
      allowedHosts: ['mcp.example.org', 'x.onrender.com'],
      globalPerMinute: 600,
      clientPerMinute: 120,
      clientIpHeader: null,
    });
    expect(
      publicConfig({ PUBLIC_HOST: PUBLIC, CLIENT_IP_HEADER: 'CF-Connecting-IP' })?.clientIpHeader,
    ).toBe('cf-connecting-ip');
    expect(() => publicConfig({ PUBLIC_HOST: PUBLIC, CLIENT_IP_HEADER: 'x: y' })).toThrow(
      /CLIENT_IP_HEADER/,
    );
  });
  it.each(['https://mcp.example.org', 'mcp.example.org:443', 'localhost', 'mcp example.org'])(
    'refuses a malformed PUBLIC_HOST (%s) instead of running open',
    (value) => {
      expect(() => publicConfig({ PUBLIC_HOST: value })).toThrow(/Invalid PUBLIC_HOST/);
    },
  );
  it('refuses malformed rate limits', () => {
    expect(() => publicConfig({ PUBLIC_HOST: PUBLIC, RATE_LIMIT_CLIENT_PER_MINUTE: '0' })).toThrow(
      /RATE_LIMIT_CLIENT_PER_MINUTE/,
    );
    expect(() =>
      publicConfig({ PUBLIC_HOST: PUBLIC, RATE_LIMIT_GLOBAL_PER_MINUTE: 'lots' }),
    ).toThrow(/RATE_LIMIT_GLOBAL_PER_MINUTE/);
  });
});

describe('rateLimit (fixed one-minute windows)', () => {
  function run(limiter: ReturnType<typeof rateLimit>, ip: string, header?: string) {
    let status = 200;
    let headers: Record<string, string> = {};
    const res = {
      status(s: number) {
        status = s;
        return this;
      },
      set(k: string, v: string) {
        headers = { ...headers, [k]: v };
        return this;
      },
      json() {
        return this;
      },
    };
    let passed = false;
    const req = { ip, get: (h: string) => (h === 'cf-connecting-ip' ? header : undefined) };
    limiter(req as never, res as never, () => {
      passed = true;
    });
    return { passed, status, headers };
  }

  it('limits per client, then globally, and resets each minute', () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    let t = 1_800_000_000_000 + 20_000; // 20 s into a minute (1.8e12 is a whole minute)
    const limiter = rateLimit({ globalPerMinute: 3, clientPerMinute: 2, now: () => t });
    expect(run(limiter, 'a').passed).toBe(true);
    expect(run(limiter, 'a').passed).toBe(true);
    const third = run(limiter, 'a');
    expect(third).toMatchObject({ passed: false, status: 429 });
    expect(third.headers['Retry-After']).toBe('40');
    expect(run(limiter, 'b').passed).toBe(true); // global count is now 3
    expect(run(limiter, 'c')).toMatchObject({ passed: false, status: 429 });
    t += 40_000; // next window
    expect(run(limiter, 'a').passed).toBe(true);
    vi.restoreAllMocks();
  });

  it('counts by the trusted proxy header when configured, not by the proxy address', () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const t = 1_800_000_000_000;
    const limiter = rateLimit({
      globalPerMinute: 100,
      clientPerMinute: 2,
      clientIpHeader: 'cf-connecting-ip',
      now: () => t,
    });
    // Same caller behind three different proxy addresses: still one client.
    expect(run(limiter, 'proxy-1', 'caller').passed).toBe(true);
    expect(run(limiter, 'proxy-2', 'caller').passed).toBe(true);
    expect(run(limiter, 'proxy-3', 'caller')).toMatchObject({ passed: false, status: 429 });
    expect(run(limiter, 'proxy-1', 'someone-else').passed).toBe(true);
    // No header: falls back to the connection address.
    expect(run(limiter, 'direct').passed).toBe(true);
    vi.restoreAllMocks();
  });
});

describe('server in public mode', () => {
  let running: RunningServer;
  const logged: string[] = [];

  beforeAll(async () => {
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      logged.push(String(chunk));
      return true;
    });
    running = await startServer(0, {
      dbPath: buildFixtureDb(),
      public: {
        allowedHosts: [PUBLIC],
        globalPerMinute: 100,
        clientPerMinute: 4,
        clientIpHeader: null,
      },
    });
  });
  afterAll(async () => {
    await running.close();
    vi.restoreAllMocks();
  });

  it('logs that it started in public mode on all interfaces', () => {
    const started = logged
      .map((l) => JSON.parse(l) as Record<string, unknown>)
      .find((e) => e.event === 'server_started');
    expect(started).toMatchObject({ mode: 'public', host: '0.0.0.0' });
  });

  it('answers the health check for the public host, revealing nothing but "ok"', async () => {
    const r = await send(running.port, { method: 'GET', path: '/healthz', host: PUBLIC });
    expect(r).toMatchObject({ status: 200, text: 'ok' });
    expect(r.headers['strict-transport-security']).toBe('max-age=31536000');
    const other = await send(running.port, { method: 'GET', path: '/healthz', host: 'x.test' });
    expect(other.status).toBe(403);
  });

  it('serves MCP for the public host name', async () => {
    const r = await send(running.port, {
      method: 'POST',
      path: '/mcp',
      host: PUBLIC,
      body: listTools,
    });
    expect(r.status).toBe(200);
    expect(r.text).toContain('resolve_comune_history');
  });

  it.each(['evil.example.com', 'localhost', '127.0.0.1'])(
    'refuses MCP requests for another host (%s)',
    async (host) => {
      const r = await send(running.port, { method: 'POST', path: '/mcp', host, body: listTools });
      expect(r.status).toBe(403);
    },
  );

  it('rate limits with 429, Retry-After and a clear message, logging no address', async () => {
    let last = { status: 0, headers: {} as Record<string, unknown>, text: '' };
    for (let i = 0; i < 6; i++) {
      last = await send(running.port, {
        method: 'POST',
        path: '/mcp',
        host: PUBLIC,
        body: listTools,
      });
    }
    expect(last.status).toBe(429);
    expect(Number(last.headers['retry-after'])).toBeGreaterThan(0);
    expect(last.text).toMatch(/Too many requests\. Try again in \d+ seconds\./);
    const limited = logged.filter((l) => l.includes('"rate_limited"'));
    expect(limited.length).toBeGreaterThan(0);
    expect(limited.join('')).not.toMatch(/127\.0\.0\.1|::ffff|"ip"/);
  });
});

describe('local mode is unchanged', () => {
  it('binds 127.0.0.1, refuses other hosts, and has the health check', async () => {
    const running = await startServer(0, { dbPath: buildFixtureDb() });
    try {
      expect(running.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
      const health = await send(running.port, {
        method: 'GET',
        path: '/healthz',
        host: '127.0.0.1',
      });
      expect(health).toMatchObject({ status: 200, text: 'ok' });
      const other = await send(running.port, {
        method: 'POST',
        path: '/mcp',
        host: PUBLIC,
        body: listTools,
      });
      expect(other.status).toBe(403);
    } finally {
      await running.close();
    }
  });
});
