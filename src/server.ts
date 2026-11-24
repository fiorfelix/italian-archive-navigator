import type { Server as HttpServer } from 'node:http';
import type express from 'express';
import type { AddressInfo } from 'node:net';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import {
  DB_PATH,
  HEALTH_PATH,
  HOST,
  MCP_PATH,
  PUBLIC_BIND_HOST,
  type PublicConfig,
  REGISTER_GUIDE_PATH,
  RULES_DIR,
  SERIES_DIR,
  SERVER_NAME,
  SERVER_VERSION,
} from './config.js';
import { SqliteStore } from './data/sqlite-store.js';
import type { Store } from './data/store.js';
import { rateLimit } from './http/rate-limit.js';
import { log } from './log.js';
import type { StoreProvider } from './tools/common.js';
import { registerCiteSource } from './tools/cite-source.js';
import { registerDraftRequestLetter } from './tools/draft-request-letter.js';
import { registerFindArchiveContact } from './tools/find-archive-contact.js';
import { registerHealthTool } from './tools/health.js';
import { registerResolveComuneHistory } from './tools/resolve-comune-history.js';
import { registerWhichRecordsExist } from './tools/which-records-exist.js';
import { registerMatchSurnames } from './tools/match-surnames.js';
import { registerRegisterGuide } from './tools/register-guide.js';
import { loadRegisterGuide, type RegisterGuide } from './rules/register-guide.js';
import { loadRules } from './rules/loader.js';
import { loadSeries, type SeriesFile } from './rules/series.js';
import type { Rule } from './rules/schema.js';

/** Builds a fresh MCP server with every tool registered. Called once per HTTP request. */
export function buildMcpServer(
  getStore: StoreProvider,
  getRules: () => Rule[],
  getSeries: () => SeriesFile[] = () => [],
  getGuide: () => RegisterGuide = () => loadRegisterGuide(REGISTER_GUIDE_PATH),
): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerHealthTool(server);
  registerResolveComuneHistory(server, getStore);
  registerFindArchiveContact(server, getStore);
  registerWhichRecordsExist(server, getStore, getRules, getSeries);
  registerDraftRequestLetter(server, getStore);
  registerCiteSource(server);
  registerRegisterGuide(server, getStore, getRules, getGuide, getSeries);
  registerMatchSurnames(server);
  return server;
}

/** Opens the database on first use and keeps it open; retries on the next call if it was missing. */
export function lazyStore(path: string): StoreProvider & { close: () => void } {
  let store: Store | undefined;
  const get = (() => (store ??= new SqliteStore(path))) as StoreProvider & { close: () => void };
  get.close = () => {
    store?.close();
    store = undefined;
  };
  return get;
}

export interface RunningServer {
  port: number;
  url: string;
  close: () => Promise<void>;
}

/**
 * Starts the Streamable HTTP endpoint. Stateless: 2026-07-28 clients are served per request,
 * and 2025-era clients through the SDK's stateless fallback.
 *
 * Local mode (default): binds 127.0.0.1; `createMcpExpressApp` rejects (403) any Host or
 * Origin header that is not localhost.
 *
 * Public mode (`options.public`, from PUBLIC_HOST): binds 0.0.0.0 behind the hosting
 * service's HTTPS proxy. Every path accepts only the configured host names (403 otherwise),
 * and the MCP path is rate limited. Origin is not checked: the Host allow-list already defeats DNS
 * rebinding, and the tools serve public data without sign-in.
 */
export async function startServer(
  port: number,
  options: { dbPath?: string; rulesDir?: string; public?: PublicConfig | null } = {},
): Promise<RunningServer> {
  const getStore = lazyStore(options.dbPath ?? DB_PATH);
  let rules: Rule[] | undefined;
  const getRules = () => (rules ??= loadRules(options.rulesDir ?? RULES_DIR));
  let series: SeriesFile[] | undefined;
  const getSeries = () => (series ??= loadSeries(SERIES_DIR));
  let guide: RegisterGuide | undefined;
  const getGuide = () => (guide ??= loadRegisterGuide(REGISTER_GUIDE_PATH));
  const handler = createMcpHandler(() => buildMcpServer(getStore, getRules, getSeries, getGuide));
  const node = toNodeHandler(handler);

  const pub = options.public ?? null;
  const bindHost = pub ? PUBLIC_BIND_HOST : HOST;
  // In public mode the SDK checks every request's Host against the allowed names (403
  // otherwise), the health check included: Render's probe sends the custom domain or the
  // service's onrender.com name, and both are on the list.
  const app = createMcpExpressApp(
    pub ? { host: bindHost, allowedHosts: pub.allowedHosts } : { host: bindHost },
  );
  if (pub) {
    // Public mode is HTTPS only (the host terminates TLS): tell browsers to stay on HTTPS.
    app.use((_req, res, next) => {
      res.set('Strict-Transport-Security', 'max-age=31536000');
      next();
    });
  }
  app.get(HEALTH_PATH, (_req, res) => {
    res.type('text/plain').send('ok');
  });
  if (pub) {
    // The caller's address comes from the trusted proxy's header when one is configured (on
    // Render, Cloudflare sits in front and sets cf-connecting-ip, replacing any value a caller
    // sends); otherwise from the connection.
    app.set('trust proxy', 1);
    app.use(
      MCP_PATH,
      rateLimit({
        globalPerMinute: pub.globalPerMinute,
        clientPerMinute: pub.clientPerMinute,
        clientIpHeader: pub.clientIpHeader,
      }),
    );
  }
  app.all(MCP_PATH, (req, res) => void node(req, res, req.body));
  // Body-parser failures (oversized or malformed JSON): answer briefly, log only a code.
  app.use(
    (
      err: { status?: number; type?: string },
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (res.headersSent) return next(err);
      const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
      const code = (err.type ?? 'internal_error').replace(/[^a-z._]/gi, '_');
      log({ event: 'http_error', status, error_code: code });
      res.status(status).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32600,
          message: status === 413 ? 'Request too large.' : 'Invalid request.',
        },
      });
    },
  );

  const http: HttpServer = await new Promise((resolve, reject) => {
    const s = app.listen(port, bindHost, (err?: Error) => (err ? reject(err) : resolve(s)));
  });
  const actualPort = (http.address() as AddressInfo).port;
  log({
    event: 'server_started',
    host: bindHost,
    port: actualPort,
    path: MCP_PATH,
    mode: pub ? 'public' : 'local',
  });

  return {
    port: actualPort,
    url: `http://${HOST}:${actualPort}${MCP_PATH}`,
    close: async () => {
      await handler.close?.();
      getStore.close();
      await new Promise<void>((resolve, reject) =>
        http.close((err) => (err ? reject(err) : resolve())),
      );
      log({ event: 'server_stopped' });
    },
  };
}
